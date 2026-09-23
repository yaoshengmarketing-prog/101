// 寫 live/data/status.json，讓網頁看得出「最近一次自動更新」是否成功
// 用法：node scripts/live-status.mjs ok            （發布成功後）
//       node scripts/live-status.mjs fail "<摘要>"  （失敗時；live/ 已還原成上一版，lastSuccessAt 沿用上一版）
import fs from "node:fs";
const f = "live/data/status.json", ok = process.argv[2] === "ok";
let prev = {}; try { prev = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
const now = new Date().toISOString(), E = process.env, run = E.GITHUB_RUN_ID || null;
fs.mkdirSync("live/data", { recursive: true });
fs.writeFileSync(f, JSON.stringify({
  lastAttemptAt: now, lastAttemptOk: ok, lastSuccessAt: ok ? now : prev.lastSuccessAt || null,
  runId: run, runUrl: run ? `${E.GITHUB_SERVER_URL}/${E.GITHUB_REPOSITORY}/actions/runs/${run}` : null,
  trigger: E.GITHUB_EVENT_NAME || null, failed: ok ? null : process.argv[3] || "unknown" }, null, 1) + "\n");
console.log(fs.readFileSync(f, "utf8"));
