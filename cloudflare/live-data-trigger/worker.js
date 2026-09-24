// live-data-trigger：Cloudflare Worker（免費方案），只負責「定時按按鈕」和留紀錄。
// 台灣 21:00–11:45 每 15 分鐘呼叫 GitHub workflow_dispatch，觸發 yaoshengmarketing-prog/101 的 live-data。
// 抓資料、檢查、寫回 GitHub 仍全由 GitHub Actions 做；GitHub 原生排程照舊，兩者並存。
//
// 紀錄（D1，binding DB，表 triggers，一次觸發一列）：
//   id＝"cf <排定時間 UTC>"，也放進 run 名稱（live-data cf 2026-09-24T13:15Z），GitHub 那邊看得到是哪一次觸發
//   送出：sent_at、http（GitHub 回應碼；null＝沒有回應）、ms（耗時）、error（逾時／錯誤內容）
//   對應：run_id；之後每次觸發會回頭補查未結束的 run：run_status、conclusion、run_started_at、run_updated_at
//         conclusion＝cancelled 通常是「排隊時被更新的觸發取代」，這是預期行為（只需要最新的一次跑完）
//   判定：run 成功後讀它的步驟紀錄，result＝changed（資料有變動並提交）／unchanged（成功檢查、資料沒變、不提交）／
//         unknown（找不到判定步驟，例如舊版 workflow）；這是該次 run 自己的判定，不是從 manifest 時間推測
// 公開：GET /log 回傳最近 200 列 JSON（不含任何密鑰）。101 的 live-data 會讀它做健康檢查，並隨資料一起存進 repo。
// 密鑰：GH_TOKEN＝站長自建的 fine-grained token（只限 101、Actions 讀寫），設在 Cloudflare Secret，不進 repo。
const REPO = "yaoshengmarketing-prog/101", WF = "live-data.yml", API = "https://api.github.com";
const call = (env, path, init = {}) => fetch(API + path, { ...init, signal: AbortSignal.timeout(15000),
  headers: { authorization: `Bearer ${env.GH_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "live-data-trigger" } });
const errText = e => e?.name === "TimeoutError" ? "逾時（15 秒沒有回應）" : String(e?.message || e).slice(0, 300);

async function trigger(env, scheduledTime) {
  const at = new Date(scheduledTime).toISOString(), id = `cf ${at.slice(0, 16)}Z`;
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO triggers (id, scheduled_at) VALUES (?, ?)").bind(id, at).run();
  if (!ins.meta.changes) return; // Cloudflare 對同一時段重送：不重複觸發
  const t0 = Date.now(), sent = new Date().toISOString();
  let http = null, error = null, runId = null;
  try {
    if (!env.GH_TOKEN) throw new Error("GH_TOKEN 尚未設定");
    const r = await call(env, `/repos/${REPO}/actions/workflows/${WF}/dispatches`, { method: "POST",
      body: JSON.stringify({ ref: "main", inputs: { trigger: id }, return_run_details: true }) });
    http = r.status; const body = await r.text();
    if (r.ok) { try { runId = JSON.parse(body).workflow_run_id ?? null; } catch {} } else error = body.slice(0, 300);
  } catch (e) { error = errText(e); }
  await env.DB.prepare("UPDATE triggers SET sent_at=?, http=?, ms=?, error=?, run_id=? WHERE id=?").bind(sent, http, Date.now() - t0, error, runId, id).run();
}

// 回頭補查：24 小時內送出成功、還沒有最終結果的觸發 → 對到 GitHub run（有 run_id 用 id，沒有就用 run 名稱裡的觸發編號）
async function resolve(env) {
  const { results } = await env.DB.prepare("SELECT id, run_id FROM triggers WHERE http BETWEEN 200 AND 299 AND (conclusion IS NULL OR (conclusion = 'success' AND result IS NULL)) AND scheduled_at > ?")
    .bind(new Date(Date.now() - 864e5).toISOString()).all();
  if (!results.length) return;
  const r = await call(env, `/repos/${REPO}/actions/workflows/${WF}/runs?event=workflow_dispatch&per_page=60`);
  if (!r.ok) throw new Error(`runs HTTP ${r.status}`);
  const runs = (await r.json()).workflow_runs, now = new Date().toISOString();
  for (const t of results) {
    const run = runs.find(x => t.run_id ? x.id === t.run_id : (x.display_title || "").endsWith(t.id));
    if (!run) { await env.DB.prepare("UPDATE triggers SET checked_at=? WHERE id=?").bind(now, t.id).run(); continue; }
    let result = null;
    if (run.status === "completed" && run.conclusion === "success") {
      const j = await call(env, `/repos/${REPO}/actions/runs/${run.id}/jobs`);
      if (j.ok) {
        const steps = (await j.json()).jobs.flatMap(x => x.steps || []), ran = p => steps.some(s => s.name.startsWith(p) && s.conclusion === "success");
        result = ran("判定：資料有變動") ? "changed" : ran("判定：資料沒有變動") ? "unchanged" : "unknown";
      }
    }
    await env.DB.prepare("UPDATE triggers SET run_id=?, run_status=?, conclusion=?, run_created_at=?, run_started_at=?, run_updated_at=?, result=?, checked_at=? WHERE id=?")
      .bind(run.id, run.status, run.conclusion, run.created_at, run.run_started_at, run.updated_at, result, now, t.id).run();
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try { await resolve(env); } catch (e) { console.log("resolve 失敗：" + errText(e)); } // 補查失敗不影響這次觸發
      await trigger(env, event.scheduledTime);
      await env.DB.prepare("DELETE FROM triggers WHERE scheduled_at < ?").bind(new Date(Date.now() - 30 * 864e5).toISOString()).run(); // 只留 30 天
    })());
  },
  async fetch(req, env) {
    if (new URL(req.url).pathname !== "/log") return new Response("live-data-trigger：GET /log 看最近的觸發紀錄\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
    const { results } = await env.DB.prepare("SELECT * FROM triggers ORDER BY scheduled_at DESC LIMIT 200").all();
    return Response.json({ now: new Date().toISOString(), triggers: results }, { headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } });
  },
};
