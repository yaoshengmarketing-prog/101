// 將四場已核的短期取數輸出封成固定研究候選；不接正式足球更新排程。
// 先各別執行 build-football.mjs --league ... --event ... --single --out .football-build/five/<league>/data
import fs from 'node:fs/promises';
import path from 'node:path';
import { LEAGUES } from './football-leagues.mjs';

const root = path.resolve('football/five-leagues-preview');
const input = path.resolve('.football-build/five');
const samples = [
  { league: 'esp.1', id: '401882812' },
  { league: 'ita.1', id: '401874791' },
  { league: 'ger.1', id: '401884745' },
  { league: 'fra.1', id: '401876411' },
];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const page = ({ title, body, assetPrefix = '../../' }) => `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}｜運彩 101 足球研究候選</title>
<link rel="stylesheet" href="${assetPrefix}assets/football.css?v=20261105-five-1">
<link rel="stylesheet" href="${assetPrefix}five-leagues-preview/preview.css?v=1"></head>
<body data-five-leagues-candidate="true"><header class="top"><div class="wrap top-inner"><a class="brand" href="${assetPrefix}">運彩 101 <span>足球</span></a><span class="top-tag">五大聯賽候選</span></div></header>
<main class="wrap">${body}</main>
<script type="module" src="${assetPrefix}assets/football.js?v=20261105-five-1"></script></body></html>`;
const nav = current => `<nav class="league-switch" aria-label="聯賽切換"><a href="../../">目前英超</a>${samples.map(s =>
  `<a href="../${s.league}/"${s.league === current ? ' aria-current="page"' : ''}>${LEAGUES[s.league].label}</a>`).join('')}</nav>`;

const rows = [];
for (const sample of samples) {
  const { league, id } = sample;
  const source = path.join(input, league, 'data');
  const [status, overview, game] = await Promise.all(['status.json', 'overview.json', `games/${id}.json`]
    .map(async name => JSON.parse(await fs.readFile(path.join(source, name), 'utf8'))));
  if (status.gameCount !== 1 || status.gameIds[0] !== id || status.league !== league
    || overview.games[0]?.id !== id || game.target.id !== id || game.target.league !== league
    || game.generatedAt !== status.generatedAt) throw new Error(`${league} 候選 ID、聯賽或資料批次不一致`);
  const dir = path.join(root, league);
  await fs.mkdir(dir, { recursive: true });
  await fs.cp(source, path.join(dir, 'data'), { recursive: true, force: true });
  await fs.writeFile(path.join(dir, 'index.html'), page({ title: `${LEAGUES[league].label}總覽`, body:
    `<p class="crumb"><a href="../">← 五大聯賽候選總覽</a></p>${nav(league)}
    <p class="eyebrow">固定研究樣本 · 台灣時間</p><h1>${LEAGUES[league].label}賽程</h1>
    <p class="lead">此頁取數後固定保存供複核，並非持續更新。各隊近五場只含${LEAGUES[league].label}。</p>
    <div id="overview" class="loading">正在讀取固定樣本…</div>`, assetPrefix: '../../' }));
  await fs.writeFile(path.join(dir, 'game.html'), page({ title: `${LEAGUES[league].label}單場`, body:
    `<p class="crumb"><a href="./">← ${LEAGUES[league].label}候選總覽</a></p>${nav(league)}
    <div id="game" class="loading">正在讀取固定樣本…</div>
    <dialog id="context" class="context"><div id="context-body"></div><button id="close-context" class="close-context" type="button">返回原來位置</button></dialog>`, assetPrefix: '../../' }));
  rows.push({ ...sample, label: LEAGUES[league].label, target: game.target,
    generatedAt: status.generatedAt, sourceChecks: status.sourceChecks, httpAttempts: status.httpAttempts,
    durationMs: status.durationMs, errors: status.sourceErrors.length });
}
const cards = rows.map(row => `<a class="overview-card featured" href="./${row.league}/game.html?id=${row.id}">
  <span class="meta">${esc(row.label)} · ${esc(row.target.twDate)}（台灣） · ${esc({ pre: '賽前', live: '進行中', final: '已完賽', postponed: '延期／取消' }[row.target.phase] || '狀態未取得')}</span>
  <b>${esc(row.target.away.name)} @ ${esc(row.target.home.name)}</b>
  <span class="visit">開啟固定單場樣本 →</span></a>`).join('');
await fs.writeFile(path.join(root, 'index.html'), page({ title: '五大聯賽總覽', assetPrefix: '../', body:
  `<p class="crumb"><a href="../">← 目前足球總覽</a></p><p class="eyebrow">固定研究候選 · 台灣時間</p>
  <h1>五大聯賽單場研究</h1><p class="lead">英超沿用目前自動更新頁；西甲、義甲、德甲、法甲各取一場真實比賽作可操作候選。候選資料固定於畫面所列取得時間，並非當期自動更新。</p>
  <nav class="league-switch" aria-label="聯賽切換"><a href="../">目前英超</a>${samples.map(s => `<a href="./${s.league}/">${LEAGUES[s.league].label}</a>`).join('')}</nav>${cards}
  <p class="foot">四個新增聯賽尚未接入正式足球更新與賽前觸發；正式啟用須再核對資料與排程。</p>` }));
await fs.writeFile(path.join(root, 'sample-report.json'), JSON.stringify({ kind: 'fixed_research_preview', samples: rows }, null, 2) + '\n');
console.log(JSON.stringify({ samples: rows.map(({ league, id, sourceChecks, httpAttempts, durationMs, errors }) =>
  ({ league, id, sourceChecks, httpAttempts, durationMs, errors })) }));
