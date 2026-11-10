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
// PR #85's shared navigation predates the five-league snapshot. Keep its UI,
// but make its football data reader follow the current five-league manifest.
const navFile = path.join(output, 'site/site.js');
let nav = await fs.readFile(navFile, 'utf8');
const originalLoader = nav.match(/  async function loadFootball\(\)\{[\s\S]*?\n  \}\n  function mlbSummary/);
if (!originalLoader) throw new Error('PR #85 導覽讀取函式已改動，需要重新核對');
nav = nav.replace(originalLoader[0], `  async function loadFootball(){
    let status;
    try{ status = await json('football/data/manifest.json'); }
    catch{ return {ok:false,reason:'足球本次資料狀態未取得'}; }
    if(status.status === 'failed') return {ok:false,reason:'足球本次更新失敗',status};
    if(!Number.isFinite(Date.parse(status.expiresAt)) || now > Date.parse(status.expiresAt)) return {ok:false,reason:'足球資料已逾期',status};
    const games = [];
    for(const league of ['eng.1','esp.1','ger.1','ita.1','fra.1']){
      const row = status.leagues?.[league];
      if(!row || row.status === 'failed') continue;
      const base = league === 'eng.1' ? 'football/data' : 'football/data/leagues/' + league;
      let overview;
      try{ overview = await json(base + '/overview.json'); }
      catch{ return {ok:false,reason:league+' 賽程檔未取得',status}; }
      if(overview.generatedAt !== status.generatedAt || !Array.isArray(overview.games) || overview.games.length !== row.gameCount)
        return {ok:false,reason:league+' 賽程與狀態版本不一致',status};
      games.push(...overview.games.map(game => ({...game,league})));
    }
    return {ok:true,status,games};
  }
  function mlbSummary`);
const replaceOne = (a,b) => { if(!nav.includes(a)) throw new Error('PR #85 導覽預期內容已改動'); nav = nav.replace(a,b); };
replaceOne("const readHref = (sport,id) => `../${sport === 'mlb' ? 'live' : 'football'}/game.html?${sport === 'mlb' ? 'pk' : 'id'}=${encodeURIComponent(id)}`;",
  "const readHref = (sport,id,league='eng.1') => sport === 'mlb' ? `../live/game.html?pk=${encodeURIComponent(id)}` : `../football/${league === 'eng.1' ? '' : 'leagues/'+league+'/'}game.html?id=${encodeURIComponent(id)}`;");
nav = nav.replaceAll("readHref('football',game.id)","readHref('football',game.id,game.league)")
  .replaceAll("readHref('football',id)","readHref('football',id,g.league)")
  .replaceAll('現有英超取數試作','現有五聯賽取數試行')
  .replaceAll('只列本次仍有效且有固定單場網址的英超資料。','只列本次仍有效且有固定單場網址的五聯賽資料。')
  .replaceAll('英超單場資料','五聯賽單場資料')
  .replaceAll('英超賽程','五聯賽賽程')
  .replaceAll('此分類先列英超快照。西甲、義甲、德甲、法甲可由五聯賽入口閱讀。','此分類列出本批五聯賽中已取得的賽事。');
await fs.writeFile(navFile, nav);
await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>運彩 101 備援入口</title><meta http-equiv="refresh" content="0;url=site/"><a href="site/">進入運彩 101 賽事資料</a></html>');
const publication = JSON.parse(await fs.readFile(path.join(source, 'site-publication.json'), 'utf8'));
const baseball = JSON.parse(await fs.readFile(path.join(source, 'live/data/status.json'), 'utf8'));
const football = JSON.parse(await fs.readFile(path.join(source, 'football/data/manifest.json'), 'utf8'));
if (Date.parse(football.expiresAt) <= Date.now()) throw new Error('備援足球批次已逾期，不得發布');
if (football.status === 'failed') throw new Error('備援足球批次取數失敗，不得覆蓋有效資料');
if (String(publication.football?.runId) !== String(football.runId)) throw new Error('備援來源批次不一致');
await fs.writeFile(path.join(output, 'backup-source.json'), JSON.stringify({
  assembledAt: new Date().toISOString(), mainSha: publication.sourceSha,
  backupBuilderSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
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
