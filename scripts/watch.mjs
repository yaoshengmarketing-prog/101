// 自動更新「沒啟動」和「啟動後失敗」都要有人收到通知：用 GitHub Issue（@ 站長，GitHub 會寄信）
// 恢復後由下一次成功的 run 在同一則 issue 留言並關閉，issue 串就是事件紀錄。
// 只在 GitHub Actions 內執行（需要 GITHUB_TOKEN：issues: write、actions: read）：
//   node scripts/watch.mjs gap           開始時：距上一次成功的 run 超過 6 小時 → 開／更新「超過 6 小時沒有成功更新」
//   node scripts/watch.mjs fail "<摘要>"  失敗時：開／更新「自動更新失敗」
//   node scripts/watch.mjs ok            成功時：還開著的上述 issue 留言「已恢復」並關閉
// 通知本身出錯只記 warning，不讓資料更新因此失敗。
const E = process.env, API = `${E.GITHUB_API_URL}/repos/${E.GITHUB_REPOSITORY}`;
const RUN = `${E.GITHUB_SERVER_URL}/${E.GITHUB_REPOSITORY}/actions/runs/${E.GITHUB_RUN_ID}`;
const TITLE = { gap: "[live-data] 超過 6 小時沒有成功更新", fail: "[live-data] 自動更新失敗" };
const tw = ms => new Date(ms + 8 * 36e5).toISOString().slice(5, 16).replace("T", " ");
// GitHub 排程常延遲，晚一兩小時不通知；超過 6 小時沒有任何成功的更新才開 issue（網頁的「資料較舊」提示另計，門檻較短）
export const limitMin = () => 360;

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
      await report("gap", `上一次成功更新是台灣 ${tw(at)}（${prev.html_url}），到本次 ${me} 開始，中間 ${min} 分鐘沒有成功的更新（通知門檻 ${limitMin()} 分鐘）。\n原因可能是 GitHub 排程延遲或沒有觸發，也可能是中間的執行失敗；尚未確認是故障。這段期間網站顯示的是 ${tw(at)} 取得的資料。\n本次 run：${RUN}`);
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
