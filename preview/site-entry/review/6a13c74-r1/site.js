(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pathPrefix = location.pathname.includes('/preview/site-entry/') ? location.pathname.split('/preview/site-entry/')[0] + '/' : '/101/';
  const publicPath = p => pathPrefix + p;
  const now = Date.now();
  const fmt = (iso, options = {}) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('zh-TW', {timeZone:'Asia/Taipei', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false, ...options}).format(d) : '時間未取得';
  };
  const todayTW = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  const phaseLabel = {pre:'賽前',live:'比賽進行中',final:'已完賽',postponed:'延期／取消'};
  const sportLabel = sport => sport === 'mlb' ? 'MLB 棒球' : '足球';
  const numberId = x => /^\d+$/.test(String(x ?? '')) ? String(x) : null;
  const readHref = (sport,id) => `read.html?sport=${sport}&${sport === 'mlb' ? 'pk' : 'id'}=${encodeURIComponent(id)}`;
  const sportHref = sport => `sport.html?sport=${sport}`;
  const label = (name,value) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`;
  const facts = rows => `<dl class="fact-list">${rows.map(([name,value]) => label(name,value)).join('')}</dl>`;
  const nav = sport => document.querySelectorAll('[data-nav]').forEach(a => {
    if(a.dataset.nav === sport) a.setAttribute('aria-current','page');
  });
  async function json(path){
    const response = await fetch(publicPath(path), {cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  async function loadMlb(includeDates = false){
    const [manifestResult,statusResult] = await Promise.allSettled([json('live/data/manifest.json'),json('live/data/status.json')]);
    if(manifestResult.status !== 'fulfilled') return {ok:false,reason:'本站 MLB 賽程資料未取得',status:statusResult.status === 'fulfilled' ? statusResult.value : null};
    const manifest = manifestResult.value;
    const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
    let games = [];
    if(includeDates){
      const days = (manifest.days || []).filter(d => Number(d.count) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.date));
      const results = await Promise.allSettled(days.map(d => json(`live/data/dates/${d.date}.json`)));
      games = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value.games || []);
    }
    return {ok:true,manifest,status,games};
  }
  async function loadFootball(){
    let status;
    try{ status = await json('football/data/status.json'); }
    catch{ return {ok:false,reason:'足球本次資料狀態未取得'}; }
    if(status.status === 'failed') return {ok:false,reason:'足球本次更新失敗',status};
    if(!Number.isFinite(Date.parse(status.expiresAt)) || now > Date.parse(status.expiresAt)) return {ok:false,reason:'足球資料已逾期',status};
    let overview;
    try{ overview = await json('football/data/overview.json'); }
    catch{ return {ok:false,reason:'足球賽程檔未取得',status}; }
    if(overview.generatedAt !== status.generatedAt) return {ok:false,reason:'足球賽程與狀態版本不一致',status};
    return {ok:true,status,overview,games:Array.isArray(overview.games) ? overview.games : []};
  }
  function mlbSummary(d){
    if(!d.ok) return '賽程資料暫缺';
    const count = (d.manifest.days || []).reduce((n,x) => n + (Number(x.count) || 0),0);
    return count ? `台灣今天／明天有 ${count} 場` : '近期沒有已知 MLB 賽事';
  }
  function footballSummary(d){
    if(!d.ok) return d.reason;
    const ready = d.games.filter(g => g.dataStatus === 'ready').length;
    return `${ready}/${d.games.length} 場有可讀單場資料`;
  }
  function mlbFeature(d){
    const r = d.ok && Array.isArray(d.manifest.recent) ? d.manifest.recent.find(g => numberId(g.pk)) : null;
    if(!r) return {html:'<div class="feature"><small>最近完賽</small><strong>目前沒有可核對的單場回看入口</strong></div>',href:null};
    const score = r.away?.score != null && r.home?.score != null ? ` ${esc(r.away.score)}：${esc(r.home.score)}` : '';
    const names = `${esc(r.away?.name || r.away?.ab || '客隊')} @ ${esc(r.home?.name || r.home?.ab || '主隊')}`;
    return {html:`<div class="feature"><small>最近完賽 · ${esc(r.twDate || '日期未取得')}（台灣）</small><strong>${names}${score}</strong><span>歷史單場，非今日賽事</span></div>`,href:readHref('mlb',r.pk)};
  }
  function featuredFootball(d){
    if(!d.ok) return {html:`<div class="feature football"><small>近期賽事</small><strong>${esc(d.reason)}</strong><span>不顯示逾期或版本不明的比賽</span></div>`,href:null};
    const ready = d.games.filter(g => g.dataStatus === 'ready' && numberId(g.id));
    const upcoming = ready.filter(g => g.phase === 'live' || g.phase === 'pre').sort((a,b) => (a.phase === 'live' ? -1 : 0) - (b.phase === 'live' ? -1 : 0) || Date.parse(a.kickoffUTC) - Date.parse(b.kickoffUTC));
    const game = upcoming[0] || ready.filter(g => g.phase === 'final').sort((a,b) => Date.parse(b.kickoffUTC) - Date.parse(a.kickoffUTC))[0];
    if(!game) return {html:'<div class="feature football"><small>近期賽事</small><strong>本次沒有可讀單場</strong></div>',href:null};
    const title = `${esc(game.away?.name || '客隊')} @ ${esc(game.home?.name || '主隊')}`;
    return {html:`<div class="feature football"><small>${esc(fmt(game.kickoffUTC))}（台灣） · ${esc(phaseLabel[game.phase] || '狀態未取得')}</small><strong>${title}</strong><span>英超單場資料；比分與名單依原頁取得狀態顯示</span></div>`,href:readHref('football',game.id)};
  }
  function panelMlb(d){
    const f = mlbFeature(d), count = d.ok ? (d.manifest.days || []).reduce((n,x) => n + (Number(x.count)||0),0) : null;
    const update = d.ok ? fmt(d.manifest.generatedAt) : '未取得';
    const state = !d.ok ? '資料暫缺' : d.status?.lastAttemptOk === false ? '本次檢查失敗' : '賽程已查';
    return `<section class="sport-panel" aria-labelledby="mlb-title"><div class="panel-top"><div><span class="sport-mark">MLB</span><h2 id="mlb-title">棒球</h2><p>現有 MLB 試營運</p></div><span class="status-pill ${!d.ok || d.status?.lastAttemptOk === false ? 'warn':''}">${state}</span></div><p class="panel-summary">${esc(mlbSummary(d))}</p><p class="panel-sub">賽事時間與資料狀態取自本站已公開的 MLB 清單。</p>${facts([['台灣今天／明天',count === null ? '尚未取得' : `${count} 場`],['先發／打線',count ? '按各場資料顯示' : '近期無適用賽事'],['賽程資料更新',update+'（台灣）']])}${f.html}<div class="panel-actions"><a class="action primary" href="${sportHref('mlb')}">進入 MLB</a>${f.href?`<a class="action" href="${f.href}">回看這場</a>`:''}</div><p class="source-note">來源範圍：本站既有 /live/ 公開輸出；不使用人工 2027 試跑。</p></section>`;
  }
  function panelFootball(d){
    const f = featuredFootball(d), ready = d.ok ? d.games.filter(g => g.dataStatus === 'ready').length : null;
    const state = !d.ok ? '資料暫缺' : d.status.status === 'partial' ? '部分取得' : '資料有效';
    const update = d.status?.generatedAt ? fmt(d.status.generatedAt) : '未取得';
    return `<section class="sport-panel" aria-labelledby="football-title"><div class="panel-top"><div><span class="sport-mark football">FOOTBALL</span><h2 id="football-title">足球</h2><p>現有英超取數試作</p></div><span class="status-pill ${!d.ok || d.status?.status === 'partial' ? 'warn':''}">${state}</span></div><p class="panel-summary">${esc(footballSummary(d))}</p><p class="panel-sub">只列本次仍有效且有固定單場網址的英超資料。</p>${facts([['近期賽程',d.ok ? `${d.games.length} 場已列` : '暫停顯示'],['可讀單場',ready === null ? '尚未取得' : `${ready}/${d.games.length} 場`],['本次資料取得',update+'（台灣）']])}${f.html}<div class="panel-actions"><a class="action primary" href="${sportHref('football')}">進入足球</a>${f.href?`<a class="action" href="${f.href}">研究這場</a>`:''}</div><p class="source-note">來源範圍：本站既有 /football/ 短期公開快照；總覽缺比分時不補猜。</p></section>`;
  }
  async function renderHome(){
    nav('home');
    const [mlb,football] = await Promise.all([loadMlb(),loadFootball()]);
    $('#app').innerHTML = `<div class="hero"><div><p class="eyebrow">賽事入口 · ${esc(todayTW())} 台灣時間</p><h1>先找到比賽，再讀單場資料。</h1><p>棒球與足球各保留現有資料狀態。尚無賽事、來源未取得與資料逾期都照實呈現。</p></div><div class="hero-aside">兩條現有閱讀線<strong>MLB ／ 足球</strong>本站目前只整理已公開的賽事資料，不提供勝負預測。</div></div><nav class="sport-jumps" aria-label="選擇運動"><a href="${sportHref('mlb')}">MLB 棒球<small>${esc(mlbSummary(mlb))}</small></a><a href="${sportHref('football')}">足球<small>${esc(footballSummary(football))}</small></a></nav><div class="sport-grid">${panelMlb(mlb)}${panelFootball(football)}</div>`;
  }
  function mlbRow(g,historical = false){
    const id = numberId(g.pk); if(!id) return '';
    const date = esc(g.twDate || '日期未取得');
    const time = historical ? '完賽回看' : esc(g.twTime || '時間未取得') + ' 台灣時間';
    const away = esc(g.away?.name || g.away?.ab || '客隊'), home = esc(g.home?.name || g.home?.ab || '主隊');
    const result = historical && g.away?.score != null && g.home?.score != null ? ` · ${esc(g.away.score)}：${esc(g.home.score)}` : '';
    const status = historical ? '歷史完賽' : esc(g.status?.text || '狀態未取得');
    const detail = historical ? '已保存的舊場次，不是近期賽程' : `先發：${esc(g.away?.sp?.name || '尚未取得')}／${esc(g.home?.sp?.name || '尚未取得')}；打線：${esc(g.lineup || '尚未取得')}`;
    return `<a class="match-row" id="game-${id}" href="${readHref('mlb',id)}"><span class="match-date">${date}<small>${time}</small></span><span class="match-clubs"><strong>${away} @ ${home}${result}</strong><small>${status} · ${detail}</small></span><span class="match-action">查看單場資料 →</span></a>`;
  }
  function footballRow(g){
    const id = numberId(g.id); if(!id) return '';
    const ready = g.dataStatus === 'ready';
    const title = `${esc(g.away?.name || '客隊')} @ ${esc(g.home?.name || '主隊')}`;
    const when = esc(fmt(g.kickoffUTC));
    const content = `<span class="match-date">${when}<small>台灣時間</small></span><span class="match-clubs"><strong>${title}</strong><small>${esc(phaseLabel[g.phase] || '狀態未取得')} · ${ready ? '本次有單場資料' : '本次單場資料未取得'}；總覽比分未提供則不顯示</small></span><span class="match-action ${ready ? '' : 'missing'}">${ready ? '查看單場資料 →' : '單場暫缺'}</span>`;
    return ready ? `<a class="match-row" id="game-${id}" href="${readHref('football',id)}">${content}</a>` : `<div class="match-row" id="game-${id}">${content}</div>`;
  }
  function restoreHash(){
    if(!location.hash) return;
    const id = location.hash.slice(1);
    if(/^game-\d+$/.test(id)) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }
  async function renderSport(){
    const sport = new URLSearchParams(location.search).get('sport');
    if(sport !== 'mlb' && sport !== 'football') {$('#app').innerHTML = '<div class="empty-box">未指定運動。<a href="index.html">返回全部賽事</a></div>'; return;}
    nav(sport);
    if(sport === 'mlb'){
      const d = await loadMlb(true);
      const active = d.ok ? d.games.filter(g => numberId(g.pk)) : [];
      const past = d.ok ? (d.manifest.recent || []).filter(g => numberId(g.pk)).slice(0,8) : [];
      $('#app').innerHTML = `<p class="eyebrow"><a href="index.html">全部賽事</a> ／ MLB 棒球</p><div class="section-top"><div><h1>MLB 賽事</h1><p>${esc(mlbSummary(d))}。賽程與完賽回看分開閱讀。</p></div><a href="${publicPath('live/')}">開啟現有 MLB 試營運頁 ↗</a></div>${!d.ok ? `<div class="notice">${esc(d.reason)}；仍可由現有 MLB 頁確認最新狀態。</div>` : `<p class="source-note">賽程資料取得：${esc(fmt(d.manifest.generatedAt))}（台灣）；狀態依各場保存資料。${d.status?.lastAttemptOk === false ? '本次檢查失敗，已保存資料不代表剛剛成功更新。' : ''}</p>`}<h2>台灣今天與明天</h2>${active.length?`<div class="match-list">${active.map(g=>mlbRow(g)).join('')}</div>`:'<div class="empty-box">目前沒有已取得的近期 MLB 場次。這是已查賽程的空窗，不把缺賽事當資料 0。</div>'}<h2 style="margin-top:30px">最近完賽回看</h2>${past.length?`<div class="match-list">${past.map(g=>mlbRow(g,true)).join('')}</div>`:'<div class="empty-box">目前沒有可核對的歷史單場入口。</div>'}`;
    }else{
      const d = await loadFootball();
      $('#app').innerHTML = `<p class="eyebrow"><a href="index.html">全部賽事</a> ／ 足球</p><div class="section-top"><div><h1>英超賽程</h1><p>台灣時間；只列當次有效快照中已取得的賽事。</p></div><a href="${publicPath('football/')}">開啟現有足球試營運頁 ↗</a></div>${d.ok ? `<p class="source-note">本次取得：${esc(fmt(d.status.generatedAt))}（台灣）；${d.games.filter(g=>g.dataStatus==='ready').length}/${d.games.length} 場有固定單場資料。總覽比分未取得時不補寫。</p>${d.status.status==='partial'?'<div class="notice">部分來源本次未取得，請到單場查看個別缺項。</div>':''}<div class="match-list" style="margin-top:18px">${d.games.map(footballRow).join('')}</div>` : `<div class="notice">${esc(d.reason)}；不顯示逾期或版本不明的場次。可前往現有足球頁查看其最新狀態。</div>`}`;
    }
    restoreHash();
  }
  function renderRead(){
    const q = new URLSearchParams(location.search), sport = q.get('sport');
    const id = numberId(sport === 'mlb' ? q.get('pk') : q.get('id'));
    if((sport !== 'mlb' && sport !== 'football') || !id){ $('#app').innerHTML = '<div class="empty-box">單場編號無效。<a href="index.html">返回全部賽事</a></div>'; return; }
    nav(sport);
    const path = sport === 'mlb' ? `live/game.html?pk=${id}` : `football/game.html?id=${id}`;
    const original = publicPath(path);
    const back = `${sportHref(sport)}#game-${id}`;
    $('#app').innerHTML = `<div class="reader-bar"><div><a class="eyebrow" href="index.html">全部賽事</a><p>／ <a href="${back}">${sportLabel(sport)}</a> ／ 單場 ${id} · 現有公開試營運頁</p></div><div class="panel-actions"><a class="action subtle" href="${back}">返回${sportLabel(sport)}列表</a><a class="action" href="${original}">原頁直接開啟 ↗</a></div></div><iframe class="embedded" id="reading-frame" title="${sportLabel(sport)}既有單場資料" src="${original}"></iframe><p class="reader-fallback">此頁只加共用導覽。若內嵌頁未載入，使用「原頁直接開啟」。</p>`;
    const frame = $('#reading-frame');
    frame.addEventListener('load', () => {
      try{
        const doc = frame.contentDocument;
        if(!doc) return;
        const style = doc.createElement('style');
        style.textContent = '.top{display:none!important}';
        doc.head.appendChild(style);
        const resize = () => { frame.style.height = `${Math.max(doc.body.scrollHeight,doc.documentElement.scrollHeight,800)}px`; };
        resize();
        new ResizeObserver(resize).observe(doc.body);
      }catch{ /* The direct public page link remains available. */ }
    });
  }
  const page = document.body.dataset.page;
  if(page === 'home') renderHome();
  if(page === 'sport') renderSport();
  if(page === 'read') renderRead();
})();

