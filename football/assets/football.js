const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = iso => iso ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)) : '時間未取得';
const day = iso => iso ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) : '日期未取得';
const gap = minutes => Number.isFinite(minutes) ? `${Math.floor(minutes / 60)} 小時${minutes % 60 ? ` ${minutes % 60} 分` : ''}` : '未取得';
const roleLabel = { starter: '先發', sub_on: '替補上場', bench_unused: '列替補未上', not_listed: '本次來源名單未列', not_acquired: '本次未取得' };
const teamName = name => ({ 'Tottenham Hotspur': '熱刺', 'Crystal Palace': '水晶宮', 'Brighton & Hove Albion': '布萊頓', 'Newcastle United': '紐卡索', 'Coventry City': '考文垂', 'Chelsea': '切爾西', 'Fulham': '富勒姆', Besiktas: '貝西克塔斯' }[name] || name);
const sides = g => `${teamName(g.away.name)} @ ${teamName(g.home.name)}`;
const ownScore = g => g.goalsFor === null ? '比分未取得' : `${g.goalsFor}–${g.goalsAgainst}`;
const gameLabel = g => `${g.side === 'home' ? '主' : '客'}對${teamName(g.opponent.name)}`;
const getJson = async file => { const r = await fetch(`./data/${file}?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`${file} HTTP ${r.status}`); return r.json(); };
const expired = status => !Number.isFinite(Date.parse(status?.expiresAt)) || Date.now() > Date.parse(status.expiresAt);
const phaseLabel = { pre: '賽前', live: '比賽進行中', final: '已完賽', postponed: '延期／取消' };

async function renderOverview() {
  const node = $('#overview');
  try {
    const status = await getJson('status.json');
    if (status.status === 'failed' || expired(status)) {
      node.innerHTML = `<div class="empty">足球資料${status.status === 'failed' ? '本次更新失敗' : '已逾期'}，暫停顯示賽程。本次狀態時間：${esc(fmt(status.generatedAt))}（台灣）。</div>`;
      return;
    }
    const o = await getJson('overview.json');
    const dateGroups = o.dates.map(date => {
      const games = o.games.filter(g => g.twDate === date);
      return `<section class="day-group"><h2>${esc(date)}（台灣）</h2>${games.length ? games.map(g => {
        const content = `<span class="meta">${esc(fmt(g.kickoffUTC))} · ${esc(phaseLabel[g.phase] || '狀態未取得')}</span><b>${esc(sides(g))}</b><span class="visit">${g.dataStatus === 'ready' ? '查看固定單場頁 →' : '這場資料本次未取得'}</span>`;
        return g.dataStatus === 'ready' ? `<a class="overview-card featured" href="game.html?id=${esc(g.id)}">${content}</a>` : `<div class="overview-card disabled">${content}</div>`;
      }).join('') : '<div class="empty">這一天沒有已知英超賽程。</div>'}</section>`;
    }).join('');
    node.innerHTML = `<p class="meta">本次取得：${esc(fmt(o.generatedAt))}（台灣） · ${o.games.filter(g => g.dataStatus === 'ready').length}/${o.games.length} 場有單場資料</p>
      ${status.status === 'partial' ? '<p class="notice">部分來源本次未取得；各場缺漏請看單場頁。</p>' : ''}${dateGroups}`;
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

function resultBlock(t, snapshotThreshold = null) {
  const form = venueResults(t.leagueFive);
  return `<div class="team-block"><h3>${esc(teamName(t.team.name))} · 已取得 ${t.leagueFive.length}/5 場</h3>
    ${t.leagueFive.length ? `<div class="venue-form"><p class="venue-form-title">這 ${t.leagueFive.length} 場英超中的主客成績</p>
      <p>${venueLine('主場', form.home)}</p><p>${venueLine('客場', form.away)}</p>
      ${form.unknown ? `<p>另有 ${form.unknown} 場主客場本次未取得。</p>` : ''}</div>` : ''}
    ${t.leagueFive.length ? t.leagueFive.map(g => `<article class="result">
      <div class="result-top"><small>${esc(fmt(g.kickoffUTC))} · ${esc(gameLabel(g))}</small><span class="total">${g.totalGoals === null ? '總進球未取得' : `${g.totalGoals} 球`}</span></div>
      <div class="result-bottom"><span class="score">${esc(ownScore(g))}</span>${snapshotThreshold !== null && g.totalGoals !== null ? `<span class="tiny">對照本場快照 ${snapshotThreshold}：${g.totalGoals > snapshotThreshold ? '大' : g.totalGoals < snapshotThreshold ? '小' : '恰等門檻'}</span>` : ''}<button class="text-button" type="button" data-context="${esc(g.key)}">比賽背景 ↗</button></div>
    </article>`).join('') : '<p class="empty">英超逐場紀錄本次未取得。</p>'}</div>`;
}

export function venueResults(games) {
  const blank = () => ({ games: 0, complete: 0, wins: 0, draws: 0, losses: 0 });
  const form = { home: blank(), away: blank(), unknown: 0 };
  for (const game of games) {
    const bucket = game.side === 'home' ? form.home : game.side === 'away' ? form.away : null;
    if (!bucket) { form.unknown++; continue; }
    bucket.games++;
    if (!Number.isFinite(game.goalsFor) || !Number.isFinite(game.goalsAgainst)) continue;
    bucket.complete++;
    if (game.goalsFor > game.goalsAgainst) bucket.wins++;
    else if (game.goalsFor < game.goalsAgainst) bucket.losses++;
    else bucket.draws++;
  }
  return form;
}

export function venueLine(label, tally) {
  if (!tally.games) return `${label} 0 場：這批沒有${label}比賽`;
  if (!tally.complete) return `${label} ${tally.games} 場：比分本次未取得`;
  const coverage = tally.complete < tally.games ? `（比分完整 ${tally.complete}/${tally.games} 場）` : '';
  return `${label} ${tally.games} 場${coverage}：${tally.wins} 勝、${tally.draws} 和、${tally.losses} 敗`;
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
      + (laterStarter && (a === 'sub_on' || b === 'sub_on' || a === 'bench_unused' || b === 'bench_unused') ? 5 : 0)
      + (a === 'sub_on' && b === 'sub_on' && laterStarter ? 12 : 0) + variety;
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

function lineupBlock(d) {
  const target = d.target, detail = d.details[target.key];
  if (d.lineupStatus === 'fetch_failed') return `<p class="notice">本場名單本次取得失敗；查詢 ${esc(fmt(d.lineupCheckedAt))}（台灣）。以下只看近期用人。</p>`;
  if (d.lineupStatus === 'unannounced') return `<p class="status">本場來源尚無正式名單；查詢 ${esc(fmt(d.lineupCheckedAt))}（台灣）。以下只看近期用人。</p>`;
  return `<section class="section"><h2>本場名單與近期用人</h2><p class="section-sub">${d.lineupStatus === 'source_listed' ? '兩隊已列出 11 名先發' : '來源只提供部分名單'}；替補名單完整性尚未核實。查詢 ${esc(fmt(d.lineupCheckedAt))}（台灣）。</p>
    ${[target.away, target.home].map(team => {
      const roster = detail.rosters?.[team.id] || [];
      const starts = roster.filter(p => p.role === 'starter');
      const bench = roster.filter(p => p.role !== 'starter');
      const pair = d.teamData[team.id]?.pairs?.at(-1);
      return `<details class="expander"><summary class="action">${esc(teamName(team.name))} · 先發 ${starts.length}/11 人</summary><div class="expander-body">
        <p>${starts.length ? starts.map(p => esc(p.name)).join('、') : '先發名單本次未取得'}</p>
        <p class="tiny">來源列出替補 ${bench.length} 人；不能由 11 名先發推定替補名單完整。</p>
        ${bench.length ? `<p class="tiny">${bench.map(p => esc(p.name)).join('、')}</p>` : ''}
        <p class="facts">${pair?.continuation === null || pair?.continuation === undefined ? '與前場先發延續：本次不能判定' : `與前場沿用 ${pair.continuation}/11 名先發`}</p>
      </div></details>`;
    }).join('')}</section>`;
}

async function renderGame() {
  const node = $('#game');
  try {
    const id = new URLSearchParams(location.search).get('id') || '401878761';
    if (!/^\d+$/.test(id)) throw new Error('賽事 ID 格式不正確');
    const status = await getJson('status.json');
    if (status.status === 'failed' || expired(status)) {
      node.innerHTML = `<div class="empty">賽事 ${esc(id)} 的足球資料${status.status === 'failed' ? '本次更新失敗' : '已逾期'}，暫停顯示。本次狀態時間：${esc(fmt(status.generatedAt))}（台灣）。<a href="./">返回英超總覽</a></div>`;
      return;
    }
    const d = await getJson(`games/${id}.json`);
    if (d.target.id !== id) throw new Error('賽事 ID 與資料不符，已停止顯示');
    if (expired(d)) {
      node.innerHTML = `<div class="empty">賽事 ${esc(id)} 的足球資料已逾期，暫停顯示。上次取得：${esc(fmt(d.generatedAt))}（台灣）。<a href="./">返回英超總覽</a></div>`;
      return;
    }
    pageData = d;
    const target = d.target, away = d.teamData[target.away.id], home = d.teamData[target.home.id];
    const odds = d.lottery;
    const totalMarket = odds.status === 'snapshot' ? odds.markets.find(m => m.play === '大小' && Number.isFinite(Number(m.threshold))) : null;
    const threshold = totalMarket ? Number(totalMarket.threshold) : null;
    const market = odds.status === 'snapshot' ? `<div class="panel"><strong>官方賠率快照 · 賽事編號 ${esc(odds.lotteryEventId)}</strong>
      <p class="meta">本站取得：${esc(fmt(odds.capturedAt))}（台灣）；非即時報價，最新賠率請看台彩。</p>
      ${odds.markets.map(m => `<div class="market-grid"><div><div class="market-label">${esc(m.play)}${m.threshold === null || m.threshold === undefined ? '' : ` · 門檻 ${esc(m.threshold)}`}</div><div class="market-number">${m.odds.map(o => `${esc(o.choice)} ${esc(o.price)}`).join('　')}</div></div></div>`).join('')}
      <a class="source-link" href="${esc(odds.sourcePage)}" target="_blank" rel="noopener noreferrer">前往台彩查看最新賠率 ↗</a></div>`
      : `<div class="panel missing"><strong>台彩官方賠率快照：本場未取得</strong><p class="meta">${esc(odds.reason)}不顯示舊樣本賠率。</p><a class="source-link" href="${esc(odds.source)}" target="_blank" rel="noopener noreferrer">前往台彩查看最新賠率 ↗</a></div>`;
    node.innerHTML = `<div class="sample">當季資料試行 · 本次取數 ${esc(fmt(d.generatedAt))}（台灣） · 非即時 · 賽事 ID ${esc(id)}</div>
      <p class="match-meta">英超 · ${esc(phaseLabel[target.phase] || '狀態未取得')} · 賽前研究資料</p><h1>${esc(sides(target))}</h1>
      <p class="match-time">預定開球 ${esc(day(target.kickoffUTC))} ${esc(fmt(target.kickoffUTC).slice(-5))}（台灣）</p>
      ${target.score ? `<p class="status">目前來源比分：${esc(scoreAt(target.score, target))}</p>` : ''}
      ${target.phase === 'pre' ? '' : '<p class="tiny">本頁保留賽前研究脈絡；賽事狀態會更新，並非即時戰況頁。</p>'}
      ${lineupBlock(d)}
      <section class="section"><h2>台灣運彩官方賠率快照</h2>${market}</section>
      <section class="section"><h2>兩隊英超近況</h2><div class="number-grid">
        ${[away, home].map(t => `<div class="number-card"><small>${esc(teamName(t.team.name))} · ${t.goals.games}/${t.goals.requested} 場比分完整</small><b>${t.goals.for === null ? '進失球本次未能完整合計' : `${t.goals.for} 進 ${t.goals.against} 失`}</b></div>`).join('')}</div>
        <p class="compare-note">分母是各隊開球前最近取得的英超比賽；不是勝率或本場預測。</p></section>
      <section class="section"><h2>逐場紀錄 · 英超</h2><p class="section-sub">兩隊分開列，比分為本隊–對手；總進球由程式相加。${threshold === null ? '本場無大小快照門檻，不標大／小。' : `以下以本場快照 ${threshold} 球門檻對照歷史總進球，非各場當時盤口結果。`}</p>
        ${resultBlock(away, threshold)}${resultBlock(home, threshold)}<p class="tiny">xG 本次未取得；每列「比賽背景」與下方球員紀錄連到同一場事件。</p></section>
      <section class="section"><h2>近期用人 · 近 14 日跨賽事</h2><p class="section-sub">已查英超、歐冠、歐聯、歐協、足總盃與聯賽盃；只列取得的已完賽。替補是當場狀態。</p>
        ${[away, home].map((t, i) => `<div class="usage-card${i ? ' alt' : ''}"><h3>${esc(teamName(t.team.name))} · 已取得 ${t.recent14.length} 場</h3><p>${esc(summarizeUsage(t))}</p></div>`).join('')}
        <details class="expander" id="pairs"><summary class="action">查看相鄰場次與開球間隔 <span>⌄</span></summary><div class="expander-body">${pairBlock(away, d)}${pairBlock(home, d)}</div></details>
        <details class="expander" id="people"><summary class="action">直接查看球員逐場紀錄 <span>⌄</span></summary><div class="expander-body">${personBlock(away)}${personBlock(home)}</div></details>
      </section>
      <section class="section"><h2>來源、時間與缺漏</h2><p class="meta">賽事與歷史資料查詢：${esc(fmt(d.generatedAt))}（台灣）；本場名單查詢：${esc(fmt(d.lineupCheckedAt))}（台灣）；台彩${odds.status === 'snapshot' ? `快照取得：${esc(fmt(odds.capturedAt))}（台灣）` : '快照未取得'}。本次來源錯誤 ${d.errors.length} 筆。</p>
        <ul class="source-list"><li><a href="https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-season-2026-27" target="_blank" rel="noopener noreferrer">英超官方賽程</a>（目標場核對）</li><li><a href="${esc(target.source)}" target="_blank" rel="noopener noreferrer">ESPN 目標賽事</a>（本次自動資料）</li><li><a href="${esc(odds.source)}" target="_blank" rel="noopener noreferrer">台彩官方入口</a>（最新賠率由讀者查看）</li></ul>
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
  } catch (e) {
    const id = new URLSearchParams(location.search).get('id') || '401878761';
    node.innerHTML = `<div class="empty">賽事 ${esc(id)} 的資料本次未取得或已超出保存期：${esc(e.message)}。<a href="./">返回英超總覽</a></div>`;
  }
}

export { renderOverview, renderGame };
if (typeof document !== 'undefined') {
  if ($('#game')) renderGame(); else if ($('#overview')) renderOverview();
}
