import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const source = path.join(root, '.site');
const output = path.join(root, '.backup-site');
// PR #85's reviewed navigation remains separate from main until it is merged.
const candidate = process.env.BACKUP_NAV_SHA || '1c47294622906605090f2a8aa430cc76b1bcfab8';

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

async function copy(relative) {
  const target = path.join(output, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(path.join(source, relative), target);
}

async function copyTree(relative) {
  await fs.cp(path.join(source, relative), path.join(output, relative), { recursive: true });
}

async function candidateFile(relative) {
  const bytes = execFileSync('git', ['show', `${candidate}:${relative}`], { maxBuffer: 5_000_000 });
  const target = path.join(output, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
}

for (const file of ['style.css', 'site-publication.json']) await copy(file);
for (const file of ['site/index.html', 'site/sport.html', 'site/nav.css', 'site/site.css', 'site/site.js',
  'football/index.html', 'football/game.html', 'football/assets/football.js',
  'football/leagues/esp.1/index.html', 'football/leagues/esp.1/game.html',
  'football/leagues/ita.1/index.html', 'football/leagues/ita.1/game.html',
  'football/leagues/ger.1/index.html', 'football/leagues/ger.1/game.html',
  'football/leagues/fra.1/index.html', 'football/leagues/fra.1/game.html',
  'live/index.html', 'live/game.html', 'live/proj.html', 'live/assets/app.js']) await candidateFile(file);
for (const file of ['football/assets/football.css', 'football/scripts/football-leagues.mjs',
  'football/scripts/football-team-names.mjs', 'live/assets/live.css']) await copy(file);
for (const dir of ['football/data', 'live/data']) await copyTree(dir);
await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>運彩 101 備援入口</title><meta http-equiv="refresh" content="0;url=site/"><a href="site/">進入運彩 101 賽事資料</a></html>');
const publication = JSON.parse(await fs.readFile(path.join(source, 'site-publication.json'), 'utf8'));
const baseball = JSON.parse(await fs.readFile(path.join(source, 'live/data/status.json'), 'utf8'));
const football = JSON.parse(await fs.readFile(path.join(source, 'football/data/manifest.json'), 'utf8'));
if (Date.parse(football.expiresAt) <= Date.now()) throw new Error('備援足球批次已逾期，不得發布');
if (football.status === 'failed') throw new Error('備援足球批次取數失敗，不得覆蓋有效資料');
if (String(publication.football?.runId) !== String(football.runId)) throw new Error('備援來源批次不一致');
await fs.writeFile(path.join(output, 'backup-source.json'), JSON.stringify({
  assembledAt: new Date().toISOString(), mainSha: publication.sourceSha,
  navigationCandidateSha: candidate, footballRunId: publication.football?.runId,
  footballGeneratedAt: football.generatedAt, footballExpiresAt: football.expiresAt,
  baseballRunId: baseball.runId, baseballGeneratedAt: baseball.generatedAt ?? null,
  publicationKey: publication.publicationKey
}, null, 2));
const files = await fs.readdir(output, { recursive: true });
let count = 0, bytes = 0;
for (const relative of files) {
  const stat = await fs.stat(path.join(output, relative));
  if (stat.isFile()) { count++; bytes += stat.size; }
}
console.log(JSON.stringify({ output, count, bytes }));
