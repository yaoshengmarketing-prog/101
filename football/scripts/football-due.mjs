// Actions 排程閘門：每日兩次完整重建；其餘半小時排程只在開球前約 90／30 分鐘重建。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = '7 10,22 * * *';
const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard';
const ymd = d => d.toISOString().slice(0, 10).replaceAll('-', '');
const minutesUntil = (kickoff, at) => (Date.parse(kickoff) - at.getTime()) / 60000;
export function dueWindow(kickoff, at) {
  const minutes = minutesUntil(kickoff, at);
  if (minutes >= 60 && minutes <= 105) return '90';
  if (minutes >= 0 && minutes <= 45) return '30';
  return null;
}

export async function decide({ schedule = '', now = new Date(), fetcher = fetch } = {}) {
  let build = true, reason = schedule ? '每日固定更新' : 'push／手動更新';
  if (schedule && schedule !== BASE) {
    try {
    const days = [ymd(now), ymd(new Date(now.getTime() + 86400000))];
    const boards = await Promise.all(days.map(async day => {
      const response = await fetcher(`${API}?dates=${day}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`賽前排程查詢 ${day} HTTP ${response.status}`);
      return response.json();
    }));
    const due = [...new Map(boards.flatMap(board => board.events || []).map(event => [String(event.id), event])).values()]
      .map(event => ({ id: String(event.id), window: dueWindow(event.date, now) })).filter(event => event.window);
    build = due.length > 0;
    reason = build ? `賽前 ${due.map(event => `${event.id}:${event.window}分`).join(', ')}` : '目前無開球前 90／30 分鐘場次';
    } catch (error) {
      return { build: false, checkFailed: true, reason: `輕量賽程檢查失敗：${String(error?.message || error)}` };
    }
  }
  return { build, checkFailed: false, reason };
}

async function main() {
  const schedule = process.env.FOOTBALL_SCHEDULE || '';
  const result = await decide({ schedule });
  const checkedAt = new Date().toISOString();
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `build=${result.build}\ncheck_failed=${result.checkFailed}\n`);
  if (result.checkFailed) {
    console.log(`::warning::${result.reason}`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### 足球輕量賽程檢查失敗\n${checkedAt} UTC：${result.reason}。保留原公開快照與原期限；未執行完整重建。\n`);
  }
  console.log(JSON.stringify({ ...result, checkedAt, schedule }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
