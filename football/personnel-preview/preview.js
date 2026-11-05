const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const tw = iso => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const statusText = {
  schedule_incomplete: '跨賽事賽程未齊，本次不能確認前一場。',
  previous_game_unavailable: '近 14 日未取得可比較的前一場。',
  previous_fetch_failed: '前一場名單本次取得失敗。',
  previous_lineup_incomplete: '前一場先發不足 11 人，本次不比較。',
  target_fetch_failed: '本場名單本次取得失敗。',
  target_lineup_unavailable: '本場正式先發尚未列齊，本次不比較。',
  lineup_inconsistent: '名單資料互相矛盾，本次不比較。',
};
const name = value => ({ 'Tottenham Hotspur': '熱刺', 'Crystal Palace': '水晶宮',
  Liverpool: '利物浦', Arsenal: '阿森納' })[value] || value;
const listNames = people => people.map(player => escapeHtml(player.name)).join('、') || '無可確認的轉換';

function teamCard(team) {
  const change = team.change;
  const source = team.previousGame?.source;
  if (change.status !== 'available') return `<article class="personnel-card"><div class="personnel-body">
    <h3>${escapeHtml(name(team.name))}</h3><p class="empty-note">${escapeHtml(statusText[change.status] || '本次無法比較名單。')}</p></div></article>`;
  const before = change.fromStarterToBench;
  const after = change.fromBenchToStarter;
  const roleHeadline = before.length + after.length <= 2
    ? [before.length ? `${listNames(before)}：先發轉替補` : '', after.length ? `${listNames(after)}：替補轉先發` : ''].filter(Boolean).join('；')
    : `先發轉替補 ${before.length} 人；替補轉先發 ${after.length} 人`;
  return `<details class="personnel-card" data-team-id="${escapeHtml(team.id)}"><summary><h3>${escapeHtml(name(team.name))}</h3>
    <span class="personnel-count">上場 11 名先發，${change.continued} 名本場續先發</span>
    <span class="personnel-roles">${roleHeadline || '兩場已列名單中，無先發與替補之間的轉換。'}</span>
    <span class="personnel-open">查看前場與球員名單 ↓</span></summary>
    <div class="personnel-body"><p><strong>上一場：</strong>${escapeHtml(tw(change.previous.kickoffUTC))} · ${escapeHtml(change.previous.leagueLabel)} · ${escapeHtml(name(team.previousGame.home.name))} 對 ${escapeHtml(name(team.previousGame.away.name))}</p>
      <div class="role-row"><strong>上場先發 → 本場替補 · ${before.length} 人</strong><span>${listNames(before)}</span></div>
      <div class="role-row"><strong>上場替補 → 本場先發 · ${after.length} 人</strong><span>${listNames(after)}</span></div>
      <p class="name-list"><strong>本場 11 名先發：</strong>${listNames(team.currentRoster.filter(player => player.role === 'starter'))}</p>
      <p class="name-list"><strong>本場來源列出替補：</strong>${listNames(team.currentRoster.filter(player => player.role !== 'starter'))}</p>
      <p class="source-note">角色依 ESPN 兩場球員 ID 與名單比較。來源列出 11 名先發，不代表替補名單完整；未列名單與未上場不推斷受傷、輪休或停賽。<br>
      <a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">上一場 ESPN ↗</a></p>
    </div></details>`;
}

const id = new URLSearchParams(location.search).get('id') || '401878761';
for (const link of document.querySelectorAll('.sample-switch a')) {
  if (link.dataset.id === id) link.setAttribute('aria-current', 'page');
}
try {
  if (!/^\d+$/.test(id)) throw new Error('賽事 ID 格式不正確');
  const response = await fetch(`./data/${id}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`候選資料 HTTP ${response.status}`);
  const data = await response.json();
  if (data.target.id !== id) throw new Error('候選賽事 ID 不符');
  $('#preview').className = '';
  $('#preview').innerHTML = `<p class="match-line">${escapeHtml(name(data.target.home.name))} 對 ${escapeHtml(name(data.target.away.name))}</p>
    <p class="meta">英超 · ${escapeHtml(tw(data.target.kickoffUTC))} 開球 · ESPN 歷史名單回讀 ${escapeHtml(tw(data.sourceCheckedAt))}</p>
    <section class="personnel-section"><h2>本場名單與近期用人</h2>
      <p class="section-sub">先看前一場實際先發，再展開本場正式名單。跨賽事依開球時間排序。</p>
      ${data.teams.map(teamCard).join('')}
      <p class="notice">這是歷史資料候選，用於試看閱讀方式。球會公告的傷停、停賽及回歸原因未接入本候選。</p>
      <p class="tiny">資料來源：<a href="${escapeHtml(data.target.source)}" target="_blank" rel="noopener noreferrer">ESPN 本場賽事 ↗</a>。本頁不追蹤即時名單。</p>
    </section>`;
  const requestedTeam = new URLSearchParams(location.search).get('team');
  const card = [...document.querySelectorAll('.personnel-card')].find(element => element.dataset.teamId === requestedTeam);
  if (card) {
    card.open = true;
    requestAnimationFrame(() => card.scrollIntoView({ block: 'start' }));
  }
} catch (error) {
  $('#preview').className = 'empty';
  $('#preview').textContent = `候選資料本次未取得：${error.message}`;
}
