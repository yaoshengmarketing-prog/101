// Actions 排程閘門：每日兩次完整重建；其餘半小時排程只在開球前約 90／30 分鐘重建。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LIVE_LEAGUE_IDS, LEAGUES, PREMATCH_MINUTES } from './football-leagues.mjs';

const BASE = '7 10,22 * * *';
const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ymd = d => d.toISOString().slice(0, 10).replaceAll('-', '');
const minutesUntil = (kickoff, at) => (Date.parse(kickoff) - at.getTime()) / 60000;
export function dueWindow(kickoff, at) {
  const minutes = minutesUntil(kickoff, at);
  if (minutes >= PREMATCH_MINUTES[0] - 30 && minutes <= PREMATCH_MINUTES[0] + 15) return '90';
  if (minutes >= PREMATCH_MINUTES[1] - 30 && minutes <= PREMATCH_MINUTES[1] + 15) return '30';
  return null;
}

export async function decide({ schedule = '', now = new Date(), fetcher = fetch, leagueIds = LIVE_LEAGUE_IDS } = {}) {
  let build = true, reason = schedule ? '每日固定更新' : 'push／手動更新';
  let matches = [];
  let checkFailed = false;
  if (schedule && schedule !== BASE) {
    try {
    const days = [ymd(now), ymd(new Date(now.getTime() + 86400000))];
    const checked = await Promise.allSettled(leagueIds.flatMap(league => days.map(async day => {
      if (!LEAGUES[league]) throw new Error(`未知目標聯賽 ${league}`);
      const response = await fetcher(`${API}/${league}/scoreboard?dates=${day}`, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`賽前排程查詢 ${league} ${day} HTTP ${response.status}`);
      return { league, board: await response.json() };
    })));
    const boards = checked.filter(row => row.status === 'fulfilled').map(row => row.value);
    const failures = checked.filter(row => row.status === 'rejected').map(row => String(row.reason?.message || row.reason));
    if (!boards.length) throw new Error(failures.join('；'));
    checkFailed = failures.length > 0;
    const due = [...new Map(boards.flatMap(({ league, board }) => (board.events || [])
      .map(event => [`${league}:${event.id}`, { league, event }]))).values()]
      .map(({ league, event }) => ({ league, id: String(event.id), windowMinutes: Number(dueWindow(event.date, now)) })).filter(event => event.windowMinutes);
    matches = due;
    build = due.length > 0;
    reason = (build ? `賽前 ${due.map(event => `${event.league}/${event.id}:${event.windowMinutes}分`).join(', ')}` : '目前無開球前 90／30 分鐘場次')
      + (failures.length ? `；部分賽程查詢失敗：${failures.join('；')}` : '');
    } catch (error) {
      return { build: false, checkFailed: true, matches: [], reason: `輕量賽程檢查失敗：${String(error?.message || error)}` };
    }
  }
  return { build, checkFailed, matches, reason };
}

async function main() {
  const schedule = process.env.FOOTBALL_SCHEDULE || '';
  const result = await decide({ schedule });
  const checkedAt = new Date().toISOString();
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `build=${result.build}\ncheck_failed=${result.checkFailed}\nmatches_json=${JSON.stringify(result.matches)}\n`);
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
