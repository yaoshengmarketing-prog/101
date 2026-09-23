// 自動更新「沒啟動」和「啟動後失敗」都要有人收到通知：用 GitHub Issue（@ 站長，GitHub 會寄信）
// 恢復後由下一次成功的 run 在同一則 issue 留言並關閉，issue 串就是事件紀錄。
// 只在 GitHub Actions 內執行（需要 GITHUB_TOKEN：issues: write、actions: read）：
//   node scripts/watch.mjs gap           開始時：距上一次成功的 run 太久 → 開／更新「排程缺口」
//   node scripts/watch.mjs fail "<摘要>"  失敗時：開／更新「自動更新失敗」
//   node scripts/watch.mjs ok            成功時：還開著的上述 issue 留言「已恢復」並關閉
// 通知本身出錯只記 warning，不讓資料更新因此失敗。
const E = process.env, API = `${E.GITHUB_API_URL}/repos/${E.GITHUB_REPOSITORY}`;
const RUN = `${E.GITHUB_SERVER_URL}/${E.GITHUB_REPOSITORY}/actions/runs/${E.GITHUB_RUN_ID}`;
const TITLE = { gap: "[live-data] 排程缺口", fail: "[live-data] 自動更新失敗" };
const tw = ms => new Date(ms + 8 * 36e5).toISOString().slice(5, 16).replace("T", " ");
// 台灣 21:00–11:59 每 30 分鐘一次 → 容許 90 分鐘；其他時段每 3 小時 → 容許 5 小時（與網頁警示門檻相同）
export const limitMin = (d = new Date()) => { const h = d.getUTCHours(); return h >= 13 || h <= 3 ? 90 : 300; };

async function gh(path, opt = {}) {
  const r = await fetch(API + path, { ...opt, headers: { authorization: `Bearer ${E.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json" } });
  if (!r.ok) throw new Error(`GitHub API ${r.status} ${path}`);
  return r.json();
}
const openIssue = async kind => (await gh(`/issues?state=open&per_page=100`)).find(i => i.title === TITLE[kind] && !i.pull_request);
async function report(kind, text) {
  const i = await openIssue(kind);
  if (i) await gh(`/issues/${i.number}/comments`, { method: "POST", body: JSON.stringify({ body: text }) });
  else await gh(`/issues`, { method: "POST", body: JSON.stringify({ title: TITLE[kind], body: `@${E.GITHUB_REPOSITORY_OWNER}\n\n${text}` }) });
}

const [mode, detail] = process.argv.slice(2);
try {
  const now = Date.now(), me = `run ${E.GITHUB_RUN_ID}（${E.GITHUB_EVENT_NAME}，台灣 ${tw(now)}）`;
  if (mode === "gap") {
    const wf = (E.GITHUB_WORKFLOW_REF || "").split("@")[0].split("/").pop();
    const prev = (await gh(`/actions/workflows/${wf}/runs?status=success&per_page=1`)).workflow_runs[0];
    const at = prev ? Date.parse(prev.run_started_at || prev.created_at) : null, min = at ? Math.round((now - at) / 6e4) : null;
    console.log(`距上一次成功 ${min ?? "（無紀錄）"} 分鐘，容許 ${limitMin()} 分鐘`);
    if (min !== null && min > limitMin())
      await report("gap", `偵測到排程缺口：上一次成功是台灣 ${tw(at)}（${prev.html_url}），本次 ${me} 才開始，中間 ${min} 分鐘沒有成功的自動更新（容許 ${limitMin()} 分鐘）。\n可能是排程沒有觸發，或中間的 run 都失敗。網站在這段期間顯示的是 ${tw(at)} 的資料。\n本次 run：${RUN}`);
  } else if (mode === "fail") {
    await report("fail", `自動更新失敗：${me}\n失敗步驟：${detail || "未知"}\n網站保留上一版資料並顯示紅色警示；下一個排程時段會自動重試。\n本次 run：${RUN}`);
  } else if (mode === "ok") {
    for (const kind of ["gap", "fail"]) {
      const i = await openIssue(kind); if (!i) continue;
      await gh(`/issues/${i.number}/comments`, { method: "POST", body: JSON.stringify({ body: `已恢復：${me} 成功。${RUN}` }) });
      await gh(`/issues/${i.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
      console.log(`已關閉 #${i.number}`);
    }
  } else throw new Error("用法：gap | fail <摘要> | ok");
} catch (e) {
  console.log(`::warning::通知（${mode}）沒有送出：${e.message}`);
}
