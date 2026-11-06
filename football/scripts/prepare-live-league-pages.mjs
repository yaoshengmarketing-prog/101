// 只產生靜態入口；資料由足球 Actions 短期 artifact 發布，沒有球賽 JSON 進 Git。
import fs from 'node:fs/promises';
import path from 'node:path';
import { LIVE_LEAGUE_IDS, LEAGUES } from './football-leagues.mjs';

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nav = current => `<nav class="league-switch" aria-label="聯賽切換">${LIVE_LEAGUE_IDS.map(id =>
  `<a href="${id === 'eng.1' ? '../../' : `../${id}/`}"${id === current ? ' aria-current="page"' : ''}>${esc(LEAGUES[id].label)}</a>`).join('')}</nav>`;
for (const league of LIVE_LEAGUE_IDS.filter(id => id !== 'eng.1')) {
  const label = LEAGUES[league].label;
  const dir = path.resolve('football/leagues', league);
  await fs.mkdir(dir, { recursive: true });
  for (const game of [false, true]) {
    const html = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>運彩 101｜${esc(label)}${game ? '單場研究' : '每日總覽'}</title>
<link rel="stylesheet" href="../../assets/football.css?v=five-live-1"></head>
<body data-football-data-base="../../data/leagues/${league}" data-default-game-id="0">
<header class="top"><div class="wrap top-inner"><a class="brand" href="../../">運彩 101 <span>足球</span></a><span class="top-tag">當季資料試行</span></div></header>
<main class="wrap"><p class="crumb"><a href="${game ? './' : '../../'}">← ${game ? `${esc(label)}每日總覽` : '足球總覽'}</a></p>
${nav(league)}${game ? `<div id="game" class="loading">正在讀取當次產生的資料…</div>`
  : `<p class="eyebrow">每日賽程總覽 · 台灣時間</p><h1>${esc(label)}賽程</h1>
<p class="lead">台灣時間近期${esc(label)}賽程；每場連到自己的固定網址與當次資料。</p>
<div id="overview" class="loading">正在讀取當次產生的資料…</div>
<p class="foot">資料依足球獨立流程更新；開球時間可能更動，請以聯賽公告為準。</p>`}</main>
${game ? '<dialog id="context" class="context"><div id="context-body"></div><button id="close-context" class="close-context" type="button">返回原來位置</button></dialog>' : ''}
<script type="module" src="../../assets/football.js?v=five-live-1"></script></body></html>\n`;
    await fs.writeFile(path.join(dir, game ? 'game.html' : 'index.html'), html);
  }
}
