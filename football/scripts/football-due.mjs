// Actions 排程閘門：每日兩次完整重建；其餘半小時排程只在開球前約 90／30 分鐘重建。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = '7 10,22 * * *';
const VERIFY = '57 15 30 10 *';
const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard';
const ymd = d => d.toISOString().slice(0, 10).replaceAll('-', '');
const minutesUntil = (kickoff, at) => (Date.parse(kickoff) - at.getTime()) / 60000;
export function dueWindow(kickoff, at) {
  const minutes = minutesUntil(kickoff, at);
  if (minutes >= 60 && minutes <= 105) return '90';
  if (minutes >= 0 && minutes <= 45) return '30';
  return null;
}

async function main() {
  const schedule = process.env.FOOTBALL_SCHEDULE || '';
  let build = true, reason = schedule === VERIFY ? '一次性自然排程驗證' : schedule ? '每日固定更新' : 'push／手動更新';
  if (schedule && schedule !== BASE && schedule !== VERIFY) {
    const now = new Date();
    const days = [ymd(now), ymd(new Date(now.getTime() + 86400000))];
    const boards = await Promise.all(days.map(async day => {
      const response = await fetch(`${API}?dates=${day}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`賽前排程查詢 ${day} HTTP ${response.status}`);
      return response.json();
    }));
    const due = [...new Map(boards.flatMap(board => board.events || []).map(event => [String(event.id), event])).values()]
      .map(event => ({ id: String(event.id), window: dueWindow(event.date, now) })).filter(event => event.window);
    build = due.length > 0;
    reason = build ? `賽前 ${due.map(event => `${event.id}:${event.window}分`).join(', ')}` : '目前無開球前 90／30 分鐘場次';
  }
  const line = `build=${build}\n`;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, line);
  console.log(JSON.stringify({ build, reason, checkedAt: new Date().toISOString(), schedule }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
