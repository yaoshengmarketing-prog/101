const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = iso => iso ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '時間未取得';
const day = iso => iso ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) : '日期未取得';
const gap = minutes => Number.isFinite(minutes) ? `${Math.floor(minutes / 60)} 小時${minutes % 60 ? ` ${minutes % 60} 分` : ''}` : '未取得';
const roleLabel = { starter: '先發', sub_on: '替補上場', bench_unused: '列替補未上', not_listed: '未列來源名單', not_acquired: '本次未取得' };
const teamName = name => ({ 'Tottenham Hotspur': '熱刺', 'Crystal Palace': '水晶宮', 'Brighton & Hove Albion': '布萊頓', 'Newcastle United': '紐卡索', 'Coventry City': '考文垂', 'Chelsea': '切爾西', 'Fulham': '富勒姆', Besiktas: '貝西克塔斯' }[name] || name);
const sides = g => `${teamName(g.away.name)} @ ${teamName(g.home.name)}`;
const ownScore = g => g.goalsFor === null ? '比分未取得' : `${g.goalsFor}–${g.goalsAgainst}`;
const gameLabel = g => `${g.side === 'home' ? '主' : '客'}對${teamName(g.opponent.name)}`;
const getJson = async file => { const r = await fetch(`./data/${file}?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`${file} HTTP ${r.status}`); return r.json(); };

async function renderOverview() {
  const node = $('#overview');
  try {
    const o = await getJson('overview.json');
    const dateGroups = o.dates.map(date => {
      const games = o.games.filter(g => g.twDate === date);
      return `<section class="day-group"><h2>${esc(date)}（台灣）</h2>${games.length ? games.map(g => {
        const selected = g.key === o.target;
        const content = `<span class="meta">${esc(fmt(g.kickoffUTC))} · ${esc(g.status)}</span><b>${esc(sides(g))}</b><span class="visit">${selected ? '查看完整單場頁 →' : '本包尚未產生這場的單場資料'}</span>`;
        return selected ? `<a class="overview-card featured" href="game.html">${content}</a>` : `<div class="overview-card disabled">${content}</div>`;
      }).join('') : '<div class="empty">這一天沒有已知英超賽程。</div>'}</section>`;
    }).join('');
    node.innerHTML = `<p class="meta">本次建置：${esc(fmt(o.generatedAt))}（台灣） · 範圍：英超</p>${dateGroups}
      <section class="day-group"><h2>本包完整單場頁</h2><a class="overview-card featured" href="game.html"><span class="meta">${esc(fmt(o.targetGame.kickoffUTC))}（台灣）</span><b>${esc(sides(o.targetGame))}</b><span class="visit">開啟已取數的單場頁 →</span></a></section>
      <p class="notice">其他總覽場次目前只有賽程，單場資料尚未建置；頁面沒有用舊樣本填補。</p>`;
  } catch (e) { node.innerHTML = `<div class="empty">賽程資料載入失敗：${esc(e.message)}</div>`; }
}

let pageData = null, lastOpener = null;
function scoreAt(score, g) { return score ? `${teamName(g.home.name)} ${score.home}–${score.away} ${teamName(g.away.name)}` : '當時比分未取得'; }
function openContext(key, opener) {
  const d = pageData, g = d?.games?.[key], context = d?.details?.[key];
  if (!g) return;
  lastOpener = opener;
  const events = context?.events || [];
  const items = events.length ? events.map(e => {
    const label = e.type === 'goal' ? '進球' : e.type === 'substitution' ? '換人' : '紅牌';
    const when = e.scoreAt || e.scoreAfter;
    const sub = e.type === 'substitution' && e.in && e.out ? `${esc(e.in.name)} 換上，${esc(e.out.name)} 換下。` : esc(e.text);
    return `<li><span class="minute">${esc(e.minute || '時間未取得')} · ${label}</span><div>${sub}</div><div class="event-score">${e.type === 'goal' ? '事件後' : '事件當時'}：${esc(scoreAt(when, g))}</div></li>`;
  }).join('') : '<li>這場的事件本次未取得。</li>';
  $('#context-body').innerHTML = `<p class="eyebrow">${esc(g.leagueLabel)} · ${esc(fmt(g.kickoffUTC))}（台灣）</p>
    <h2>${esc(sides(g))}</h2><p class="score">${g.score ? esc(scoreAt(g.score, g)) : '比分未取得'}</p>
    <p class="tiny">僅列來源提供的進球、換人與紅牌；這不是完整個人事件統計，也不把比分變化歸因於換人。</p>
    <ol class="timeline">${items}</ol><a class="source-link" href="${esc(context?.source || g.source)}" target="_blank" rel="noopener noreferrer">查看原始比賽資料 ↗</a>`;
  $('#context').showModal();
  $('#close-context').focus();
}

function resultBlock(t) {
  return `<div class="team-block"><h3>${esc(teamName(t.team.name))} · 已取得 ${t.leagueFive.length}/5 場</h3>
    ${t.leagueFive.length ? t.leagueFive.map(g => `<article class="result">
      <div class="result-top"><small>${esc(fmt(g.kickoffUTC))} · ${esc(gameLabel(g))}</small><span class="total">${g.totalGoals === null ? '總進球未取得' : `${g.totalGoals} 球`}</span></div>
      <div class="result-bottom"><span class="score">${esc(ownScore(g))}</span><button class="text-button" type="button" data-context="${esc(g.key)}">比賽背景 ↗</button></div>
    </article>`).join('') : '<p class="empty">英超逐場紀錄本次未取得。</p>'}</div>`;
}

function summarizeUsage(t) {
  const actual = t.pairs.filter(p => p.continuation !== null);
  if (!actual.length) return '相鄰場次的先發延續本次未取得；展開可看已取得的場次。';
  const selected = actual.slice(-2);
  return selected.map(p => `開球隔 ${gap(p.kickoffGapMinutes)}、沿用 ${p.continuation}/11 名先發`).join('；') + '。';
}

function pairPeople(t, pair) {
  const ranked = t.players.map(p => {
    const a = p.games.find(g => g.key === pair.from)?.role;
    const b = p.games.find(g => g.key === pair.to)?.role;
    const variety = new Set(p.games.map(g => g.role)).size;
    const pairIndex = p.games.findIndex(g => g.key === pair.to);
    const laterStarter = pairIndex >= 0 && p.games.slice(pairIndex + 1).some(g => g.role === 'starter');
    const score = (a && b && a !== b ? 4 : 0) + (a === 'sub_on' || b === 'sub_on' ? 2 : 0)
      + (laterStarter && (a === 'sub_on' || b === 'sub_on' || a === 'bench_unused' || b === 'bench_unused') ? 5 : 0) + variety;
    return { p, score };
  }).filter(x => x.score > 1).sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));
  return ranked.slice(0, 2).map(({ p }) => `<button type="button" data-person="${esc(t.team.id)}-${esc(p.id)}">查看 ${esc(p.name)} 逐場</button>`).join('');
}

function fixtureLine(g) {
  const forGoals = g.score ? (g.side === 'home' ? g.score.home : g.score.away) : null;
  const against = g.score ? (g.side === 'home' ? g.score.away : g.score.home) : null;
  return `${fmt(g.kickoffUTC)} · ${g.leagueLabel} · ${gameLabel(g)}${g.finished && forGoals !== null ? ` · ${forGoals}–${against}` : ' · 預定'}`;
}

function pairBlock(t, d) {
  return `<div class="pair-team"><h3>${esc(teamName(t.team.name))} · ${t.recent14.length} 場跨賽事</h3>
    ${t.pairs.length ? t.pairs.map(p => {
      const from = d.games[p.from], to = d.games[p.to];
      return `<article class="pair-card"><p class="fixture-line">${esc(fixtureLine({ ...from, side: from.home.id === t.team.id ? 'home' : 'away', opponent: from.home.id === t.team.id ? from.away : from.home }))}</p>
        <p class="fixture-line">${esc(fixtureLine({ ...to, side: to.home.id === t.team.id ? 'home' : 'away', opponent: to.home.id === t.team.id ? to.away : to.home }))}</p>
        <div class="facts">開球間隔 ${esc(gap(p.kickoffGapMinutes))}<br>${p.continuation === null ? '先發沿用：本場名單未公布／資料未取得' : `沿用 ${p.continuation}/11 人續先發`}</div>
        <div class="pair-actions">${pairPeople(t, p) || '<span class="tiny">球員入口請見下方逐場紀錄。</span>'}</div></article>`;
    }).join('') : '<p class="empty">相鄰場次本次未取得。</p>'}</div>`;
}

function personBlock(t) {
  return `<div class="pair-team"><h3>${esc(teamName(t.team.name))} · 已列 ${t.players.length} 名球員</h3>
    ${t.players.map(p => `<details class="person-card" id="person-${esc(t.team.id)}-${esc(p.id)}"><summary>${esc(p.name)}　<span class="tiny">${p.games.filter(g => g.role === 'starter').length}/${t.recent14.length} 場先發</span></summary>
      <div class="person-rows">${p.games.map(rec => {
        const g = t.recent14.find(x => x.key === rec.key);
        const extra = [rec.subOnMinute ? `${rec.subOnMinute} 換上` : '', rec.subOffMinute ? `${rec.subOffMinute} 換下` : '', rec.goals ? `${rec.goals} 球` : '', rec.assists ? `${rec.assists} 助攻` : ''].filter(Boolean).join(' · ');
        return `<div class="person-row"><strong>${esc(fmt(g.kickoffUTC))} · ${esc(g.leagueLabel)} · ${esc(gameLabel(g))}</strong>
          <span class="role">${esc(roleLabel[rec.role] || rec.role)}${extra ? ` · ${esc(extra)}` : ''}</span>
          <button class="text-button" type="button" data-context="${esc(rec.key)}">這場背景 ↗</button></div>`;
      }).join('')}</div></details>`).join('')}</div>`;
}

async function renderGame() {
  const node = $('#game');
  try {
    const d = await getJson('game.json'); pageData = d;
    const target = d.target, away = d.teamData[target.away.id], home = d.teamData[target.home.id];
    const odds = d.lottery;
    const market = odds.markets ? `<div class="panel"><div class="market-grid"><div><div class="market-label">總進球</div><div class="market-number">${esc(odds.markets.total || '未取得')}</div></div><div><div class="market-label">不讓分</div><div class="market-number">${esc(odds.markets.normal || '未取得')}</div></div></div></div>`
      : `<div class="panel missing"><strong>台彩盤口：本次未取得</strong><p class="meta">${esc(odds.reason)}<br>查詢：${esc(fmt(odds.checkedAt))}（台灣）。不顯示舊樣本賠率。</p><a class="source-link" href="${esc(odds.source)}" target="_blank" rel="noopener noreferrer">查看台彩官方賽事表 ↗</a></div>`;
    node.innerHTML = `<div class="sample">當季資料試作 · 本次取數 ${esc(fmt(d.generatedAt))}（台灣） · 非即時</div>
      <p class="match-meta">英超 · 賽前資料</p><h1>${esc(sides(target))}</h1>
      <p class="match-time">預定開球 ${esc(day(target.kickoffUTC))} ${esc(fmt(target.kickoffUTC).slice(-5))}（台灣）</p>
      <p class="status">本場正式名單：取數時尚未公布；以下為近期實際用人。</p>
      <section class="section"><h2>台灣運彩盤口</h2>${market}</section>
      <section class="section"><h2>兩隊英超近況</h2><div class="number-grid">
        ${[away, home].map(t => `<div class="number-card"><small>${esc(teamName(t.team.name))} · ${t.goals.games}/5 場</small><b>${t.goals.for} 進 ${t.goals.against} 失</b></div>`).join('')}</div>
        <p class="compare-note">分母是各隊開球前最近取得的英超比賽；不是勝率或本場預測。</p></section>
      <section class="section"><h2>逐場紀錄 · 英超</h2><p class="section-sub">兩隊分開列，比分為本隊–對手；總進球由程式相加。盤口未取得時不標大／小。</p>
        ${resultBlock(away)}${resultBlock(home)}<p class="tiny">xG 本次未取得；每列「比賽背景」與下方球員紀錄連到同一場事件。</p></section>
      <section class="section"><h2>近期用人 · 近 14 日跨賽事</h2><p class="section-sub">已查英超、歐冠、歐聯、歐協、足總盃與聯賽盃；只列取得的已完賽。替補是當場狀態。</p>
        ${[away, home].map((t, i) => `<div class="usage-card${i ? ' alt' : ''}"><h3>${esc(teamName(t.team.name))} · 已取得 ${t.recent14.length} 場</h3><p>${esc(summarizeUsage(t))}</p></div>`).join('')}
        <details class="expander" id="pairs"><summary class="action">查看相鄰場次與開球間隔 <span>⌄</span></summary><div class="expander-body">${pairBlock(away, d)}${pairBlock(home, d)}</div></details>
        <details class="expander" id="people"><summary class="action">直接查看球員逐場紀錄 <span>⌄</span></summary><div class="expander-body">${personBlock(away)}${personBlock(home)}</div></details>
      </section>
      <section class="section"><h2>來源、時間與缺漏</h2><p class="meta">歷史資料查詢：${esc(fmt(d.generatedAt))}（台灣）；台彩查詢：${esc(fmt(odds.checkedAt))}（台灣）。本次來源錯誤 ${d.errors.length} 筆。</p>
        <ul class="source-list"><li><a href="https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-season-2026-27" target="_blank" rel="noopener noreferrer">英超官方賽程</a>（核對目標場）</li><li><a href="${esc(target.source)}" target="_blank" rel="noopener noreferrer">ESPN 目標賽事</a>（本次自動資料）</li><li><a href="${esc(odds.source)}" target="_blank" rel="noopener noreferrer">台彩官方賽事表</a>（本次請求受阻）</li></ul>
        <p class="notice">${d.limitations.map(esc).join(' ')}來源失敗時本次欄位留空並標查詢時間，不沿用上次結果。</p></section>`;
    node.addEventListener('click', event => {
      const context = event.target.closest('[data-context]');
      if (context) { openContext(context.dataset.context, context); return; }
      const person = event.target.closest('[data-person]');
      if (person) {
        const parent = $('#people'), targetPerson = document.getElementById(`person-${person.dataset.person}`);
        if (parent && targetPerson) { parent.open = true; targetPerson.open = true; targetPerson.scrollIntoView({ block: 'center', behavior: 'smooth' }); targetPerson.querySelector('summary')?.focus(); }
      }
    });
    $('#close-context').addEventListener('click', () => $('#context').close());
    $('#context').addEventListener('close', () => lastOpener?.focus({ preventScroll: true }));
  } catch (e) { node.innerHTML = `<div class="empty">單場資料載入失敗：${esc(e.message)}</div>`; }
}

if ($('#game')) renderGame(); else if ($('#overview')) renderOverview();
