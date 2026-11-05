// 一批重建五聯賽短期快照；英超保留原 data/ 路徑，其餘各有獨立資料目錄。
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { LIVE_LEAGUE_IDS, LEAGUES } from './football-leagues.mjs';

const arg = key => { const i = process.argv.indexOf(key); return i < 0 ? null : process.argv[i + 1]; };
const root = path.resolve(arg('--out') || '.football-build/data');
const scratch = path.resolve('.football-build/parts');
const batchAt = new Date().toISOString();
const expiresAt = new Date(Date.parse(batchAt) + 18 * 3600000).toISOString();
const runId = process.env.GITHUB_RUN_ID || null;
const triggerId = process.env.TRIGGER_ID || null;
const legacyEvent = process.env.EVENT_ID || null;
const legacyLeague = process.env.EVENT_LEAGUE || 'eng.1';
const rawMatches = process.env.TRIGGER_MATCHES_JSON || '[]';
const supplied = JSON.parse(rawMatches);
if (!Array.isArray(supplied)) throw new Error('TRIGGER_MATCHES_JSON 必須為陣列');
const triggerMatches = supplied.map(row => ({ league: String(row.league), id: String(row.id),
  windowMinutes: Number(row.windowMinutes ?? row.window) }));
if (legacyEvent) triggerMatches.push({ league: legacyLeague, id: String(legacyEvent), windowMinutes: null });
for (const row of triggerMatches) if (!LEAGUES[row.league] || !/^\d+$/.test(row.id)
  || (row.windowMinutes !== null && ![90, 30].includes(row.windowMinutes))) {
  throw new Error(`無效目標賽事 ${JSON.stringify(row)}`);
}
const distinctMatches = [...new Map(triggerMatches.map(row => [`${row.league}:${row.id}`, row])).values()];
const run = (script, args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', errors = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { errors += chunk; });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve(output.trim())
    : reject(new Error(`${path.basename(script)} exit ${code}: ${(errors || output).slice(-1200)}`)));
});
const writeJson = (file, value) => fs.writeFile(file, JSON.stringify(value) + '\n');

if (!root.startsWith(path.resolve('.football-build') + path.sep)) throw new Error('輸出目錄須位於 .football-build');
await fs.rm(root, { recursive: true, force: true });
await fs.mkdir(root, { recursive: true });
const results = {};
for (const league of LIVE_LEAGUE_IDS) {
  const output = league === 'eng.1' ? root : path.join(root, 'leagues', league);
  const part = path.join(scratch, league, 'data');
  const matched = distinctMatches.filter(row => row.league === league);
  try {
    await fs.rm(part, { recursive: true, force: true });
    const args = ['--league', league, '--out', part, '--at', batchAt];
    if (matched.length) args.push('--event', matched[0].id);
    if (process.env.ODDS_FILE) args.push('--odds-file', process.env.ODDS_FILE);
    const buildOutput = await run('football/scripts/build-football.mjs', args);
    const qaOutput = await run('football/scripts/qa-football.mjs', [part]);
    const status = JSON.parse(await fs.readFile(path.join(part, 'status.json'), 'utf8'));
    const missing = matched.filter(row => !status.gameIds.includes(row.id));
    if (missing.length) throw new Error(`觸發 ID 未進入 ${league} 單場快照：${missing.map(x => x.id).join(',')}`);
    status.triggerId = triggerId;
    status.triggerMatches = matched;
    await writeJson(path.join(part, 'status.json'), status);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.cp(part, output, { recursive: true, force: true });
    results[league] = { status: status.status, gameIds: status.gameIds, gameCount: status.gameCount,
      generatedAt: status.generatedAt, sourceChecks: status.sourceChecks, httpAttempts: status.httpAttempts,
      durationMs: status.durationMs, sourceErrorCount: status.sourceErrors.length, qa: JSON.parse(qaOutput) };
    console.log(JSON.stringify({ league, build: JSON.parse(buildOutput), qa: results[league].qa }));
  } catch (error) {
    const reason = String(error?.message || error).slice(0, 1500);
    if (league !== 'eng.1') await fs.mkdir(output, { recursive: true });
    const failed = { status: 'failed', league, generatedAt: batchAt, expiresAt, runId, triggerId,
      triggerMatches: matched, reason, gameCount: 0, gameIds: [], sourceChecks: 0, httpAttempts: 0, sourceErrors: [] };
    await writeJson(path.join(output, 'status.json'), failed);
    results[league] = { status: 'failed', gameIds: [], gameCount: 0, generatedAt: batchAt,
      sourceChecks: 0, httpAttempts: 0, sourceErrorCount: 1, reason };
    console.error(JSON.stringify({ league, failed: reason }));
  }
}
const manifest = { status: Object.values(results).every(row => row.status === 'failed') ? 'failed'
  : Object.values(results).every(row => row.status === 'ok') ? 'ok' : 'partial',
  generatedAt: batchAt, expiresAt, runId, triggerId, triggerMatches: distinctMatches, leagues: results,
  gameCount: Object.values(results).reduce((n, row) => n + row.gameCount, 0),
  httpAttempts: Object.values(results).reduce((n, row) => n + row.httpAttempts, 0),
  durationMs: Date.now() - Date.parse(batchAt) };
await writeJson(path.join(root, 'manifest.json'), manifest);
console.log(JSON.stringify({ manifest: { status: manifest.status, runId, generatedAt: batchAt,
  gameCount: manifest.gameCount, httpAttempts: manifest.httpAttempts, durationMs: manifest.durationMs },
  leagues: Object.fromEntries(Object.entries(results).map(([id, row]) => [id, { status: row.status, gameCount: row.gameCount, httpAttempts: row.httpAttempts }])) }));
if (manifest.status === 'failed') process.exitCode = 1;
