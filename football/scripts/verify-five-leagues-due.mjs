// 唯讀使用當季 ESPN 賽程，驗證四聯賽的 90／30 分鐘候選觸發；不派送 Actions。
import fs from 'node:fs/promises';
import path from 'node:path';
import { decide } from './football-due.mjs';
import { footballDue } from '../../cloudflare/live-data-trigger/worker.js';
import { LIVE_LEAGUE_IDS } from './football-leagues.mjs';

const file = path.resolve('football/five-leagues-preview/sample-report.json');
const samples = JSON.parse(await fs.readFile(file, 'utf8')).samples;
const checkedAt = new Date().toISOString();
const results = [];
for (const { league, id, target } of samples) for (const [offset, window] of [[85, '90'], [25, '30']]) {
  const scheduledAt = new Date(Date.parse(target.kickoffUTC) - offset * 60000);
  let requests = 0;
  const started = Date.now();
  const result = await decide({ schedule: '5,35 * * * *', now: scheduledAt, leagueIds: [league],
    fetcher: (url, init) => { requests++; return fetch(url, init); } });
  const externalWindow = footballDue(target.kickoffUTC, scheduledAt.getTime());
  const matched = result.build && result.reason.includes(`${league}/${id}:${window}分`)
    && externalWindow === Number(window);
  results.push({ league, id, kickoffUTC: target.kickoffUTC,
    scheduledAt: scheduledAt.toISOString(), windowMinutes: Number(window), matched,
    githubGate: result, externalWindow, scoreboardRequests: requests, durationMs: Date.now() - started });
  if (!matched) throw new Error(`${league}/${id} ${window} 分鐘未匹配：${JSON.stringify(result)}`);
}
const output = { checkedAt, kind: 'read_only_candidate_trigger_check', liveLeagues: LIVE_LEAGUE_IDS,
  note: '僅驗證候選規則與真實 ESPN 賽程；正式 Cloudflare Worker 與 GitHub workflow 仍只啟用英超。', results };
await fs.writeFile(path.resolve('football/five-leagues-preview/trigger-check.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ checkedAt, cases: results.length, matched: results.filter(x => x.matched).length,
  requests: results.reduce((n, x) => n + x.scoreboardRequests, 0), liveLeagues: LIVE_LEAGUE_IDS }));
