(function previewApp(){
  "use strict";
  const D=window.PREVIEW_DATA, root=document.getElementById("app");
  const qs=new URLSearchParams(location.search);
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateLabel=s=>`${Number(s.slice(5,7))} 月 ${Number(s.slice(8,10))} 日`;
  const state=qs.get("state")||"official", mode=qs.get("mode")==="post"?"post":"pre";
  const legit=["official","projection","partial","new"].includes(state)?state:"official";
  const test=legit!=="official";
  const fmtOut=o=>o==null?"—":`${Math.floor(o/3)}.${o%3}`;
  const base=(p)=>`<div class="source-ribbon"><span class="source-dot"></span><span>${p}</span><strong>固定歷史資料，不是即時頁面</strong></div>`;
  const link=(title,href,active)=>`<a href="${href}" class="${active?"active":""}" ${active?'aria-current="page"':""}>${title}</a>`;
  const g=D.game;
  const heroTeams=(post)=>`<div class="match-header">
    <div class="club"><span class="club-code">${esc(g.away.ab)}</span><strong>${esc(g.away.name)}</strong><small>客隊</small></div>
    <div class="versus">${post?`<span class="score">${D.post.final.away.runs}<i>:</i>${D.post.final.home.runs}</span><small>已結束</small>`:`<span class="at">對</span><small>賽前資料</small>`}</div>
    <div class="club home-club"><span class="club-code">${esc(g.home.ab)}</span><strong>${esc(g.home.name)}</strong><small>主隊</small></div>
  </div>`;
  function renderHome(){
    const quiet=qs.get("view")==="quiet";
    const homeLink=`game.html?mode=pre`;
    const recent=D.recent.map((r,i)=>`<li class="recent-row"><span class="recent-date">${dateLabel(r.twDate)}</span><span class="recent-pair">${esc(r.away.ab)} <b>${r.away.score} : ${r.home.score}</b> ${esc(r.home.ab)}</span>${i===0?`<a href="game.html?mode=post" aria-label="查看 ${esc(r.away.ab)} 對 ${esc(r.home.ab)} 的單場回放">單場回放</a>`:`<a href="../../live/game.html?pk=${r.pk}" aria-label="查看 ${esc(r.away.ab)} 對 ${esc(r.home.ab)} 的既有單場資料">既有資料頁</a>`}</li>`).join("");
    root.innerHTML=`${base("設計預覽 / 賽事入口")}
      <section class="page-title"><div><p class="overline">MLB 比賽資料</p><h1>從賽事進入研究</h1><p>首頁只顯示找比賽需要的資料；完整脈絡留在單場頁。</p></div><div class="date-stamp"><b>2026.10.29</b><span>固定回放日</span></div></section>
      <nav class="segment-tabs" aria-label="預覽情境">${link("10 月 29 日・1 場","./",!quiet)}${link("近期無賽", "?view=quiet",quiet)}</nav>
      ${quiet?`<section class="quiet-intro"><h2>目前沒有近期賽事</h2><p>這是「今天、明天和之後七天均無賽程」的畫面示意。保留最近完賽入口，不推定球季已結束。</p></section>`:
      `<section class="list-heading"><h2>10 月 29 日</h2><span>世界大賽　1 場・台灣時間</span></section>
      <article class="game-row"><div class="game-time"><strong>08:00</strong><span>已結束</span><small>世界大賽 G5</small></div><div class="game-clubs"><div><b>${esc(g.away.ab)}</b><strong>${esc(g.away.name)}</strong><span>客</span></div><div><b>${esc(g.home.ab)}</b><strong>${esc(g.home.name)}</strong><span>主</span></div></div><div class="game-essential"><span>先發</span><p>${esc(g.away.sp.name)}<br>${esc(g.home.sp.name)}</p><small>雙方官方打線已存</small></div><div class="game-action"><a href="${homeLink}" class="action-link">看單場研究 <span aria-hidden="true">↗</span></a><a href="game.html?mode=post" class="text-link">直接看賽後</a></div></article>`}
      <section class="recent-section"><div class="section-head"><h2>最近完賽</h2><span>固定快照中的 10 場・日期與比分</span></div><ul class="recent-list">${recent}</ul></section>
      <p class="page-note">本草案的單場研究示例為 gamePk ${g.pk}。其他完賽列連到既有 /live/ 資料頁，用於檢查回看入口。</p>`;
  }
  function testNotice(){
    const title={projection:"預估打線狀態測試",partial:"部分未取得狀態測試",new:"新一季零樣本狀態測試"}[legit];
    const desc={projection:"以人工測試球員示範第三方預估的版面；不是任何來源的真實預估。",partial:"模擬主隊官方打線尚未取得；未取得不填 0，也不沿用作本場官方。",new:"借用這場對戰名稱測試新季空值呈現；不代表 2027 賽程或統計。"}[legit];
    return `<div class="test-notice" role="status"><b>人工測試資料：${title}</b><span>${desc} 此狀態不進正式資料或研究樣本。</span></div>`;
  }
  function pitcherRow(){
    const t=(team)=>`<div class="pitcher"><span class="pitcher-label">${esc(team.ab)} 預計先發</span><strong>${esc(team.sp.name)}</strong><span>${team.sp.hand==="R"?"右投":"左投"}</span>${legit==="new"?`<small>新季尚無大聯盟例行賽紀錄</small>`:`<div class="pitcher-metrics"><span>ERA <b>${team.sp.era}</b></span><span>WHIP <b>${team.sp.whip}</b></span><span>IP <b>${team.sp.ip}</b></span></div><small>2026 大聯盟例行賽・${team.sp.gs} 場先發</small>`}</div>`;
    return `<section class="primary-block"><div class="section-head"><h2>先發投手</h2><span>先確認今天預計由誰開局</span></div><div class="pitcher-grid">${t(g.away)}${t(g.home)}</div></section>`;
  }
  function lineupFor(team,side){
    const missing=legit==="new"||(legit==="partial"&&side==="home");
    const projected=legit==="projection"&&side==="home";
    if(missing)return `<div class="lineup-panel"><div class="lineup-title"><h3>${esc(team.ab)} ${esc(team.name)}</h3><span class="status-tag muted">官方打線未取得</span></div><p class="empty-copy">本場打線目前沒有可確認的 1–9 棒。上一場打線也不能充當本場名單。</p></div>`;
    const slots=projected?Array.from({length:9},(_,i)=>({n:i+1,name:`測試球員 ${i+1}`,pos:["CF","2B","RF","1B","DH","3B","LF","C","SS"][i]})):team.lineup.slots;
    const row=x=>`<li><span>${x.n}</span><strong>${esc(x.name)}</strong><em>${esc(x.pos)}</em>${projected||legit==="new"?"":`<small>OPS ${esc(x.ops)}</small>`}</li>`;
    return `<div class="lineup-panel"><div class="lineup-title"><h3>${esc(team.ab)} ${esc(team.name)}</h3><span class="status-tag ${projected?"projected":"confirmed"}">${projected?"人工預估測試":"MLB 官方打線"}</span></div><ol class="lineup-list">${slots.slice(0,3).map(row).join("")}</ol><details class="lineup-more"><summary>展開第 4–9 棒</summary><ol class="lineup-list" start="4">${slots.slice(3).map(row).join("")}</ol></details><p class="lineup-foot">${projected?"測試名單不含真實來源與球員成績。":"OPS 為 2026 例行賽整體成績；本站首次看到官方名單的時間另存於原資料。"}</p></div>`;
  }
  function contextSection(){
    if(test)return `<section class="context-block"><div class="section-head"><h2>值得一起看的條件</h2><span>固定規則產生的事實提示</span></div><div class="empty-copy inset">此測試狀態未用真實輸入重算情境卡，因此不顯示條件判斷。</div></section>`;
    return `<section class="context-block"><div class="section-head"><h2>值得一起看的條件</h2><span>成立 ${D.context.length} 項・只列事實</span></div><div class="context-list">${D.context.map(x=>`<div class="context-row"><div><span class="context-rule">${esc(x.title)}</span><strong>${esc(x.value)}</strong></div><details><summary>依據與歷史例子</summary><p>${esc(x.threshold)}</p><p>${esc(x.says?.[0]||"")}</p><p>本站同規則、同門檻且賽後完整的案例：${x.similar?.n??0} 場（例行賽 ${x.similar?.byType?.R??0}、季後賽 ${x.similar?.byType?.post??0}）。只列案例，不換算勝率。</p></details></div>`).join("")}</div></section>`;
  }
  function matchupContent(){
    return `<div class="detail-grid">${D.matchup.map(x=>`<div class="deep-item"><h4>${esc(x.pitcher)} × ${esc(x.batting)}打線</h4><p>對左打被打 OPS ${esc(x.splits.vl?.ops??"尚未取得")}（${esc(x.splits.vl?.pa??"—")} 打席）；對右打 ${esc(x.splits.vr?.ops??"尚未取得")}（${esc(x.splits.vr?.pa??"—")} 打席）。</p><small>${esc(x.splitScope)}，不代表對今天打者的直接交手。</small></div>`).join("")}</div>`;
  }
  function bullpenContent(){
    const box=(s,t)=>`<div class="deep-item"><h4>${esc(t.ab)} ${esc(t.name)}</h4><ul class="day-list">${D.bullpen[s].days.slice(-3).map(x=>`<li><span>${dateLabel(x.date)}</span><strong>${x.state==="off"?"無賽程":x.pitches==null?"未取得":x.pitches+" 球"}</strong></li>`).join("")}</ul><small>開賽前 3 個日曆日；無賽程不等於投球數 0。</small></div>`;
    return `<div class="detail-grid">${box("away",g.away)}${box("home",g.home)}</div>`;
  }
  function deepSection(){
    return `<section class="deep-section"><div class="section-head"><h2>再往下查</h2><span>細節按需要展開</span></div><div class="deep-list"><details><summary><span>投打對位</span><small>對左右打與最近先發</small></summary>${matchupContent()}</details><details><summary><span>牛棚使用</span><small>前三個完整日與本日分開</small></summary>${bullpenContent()}</details><details><summary><span>球場天氣</span><small>官方資料</small></summary><div class="deep-item"><p>${esc(g.venue)}：${esc(D.weather.condition)}；${esc(D.weather.tempF)}°F；風 ${esc(D.weather.wind)}。</p><small>此場為 Dome，不把風向解讀成打球優勢。</small></div></details><details><summary><span>名單變動</span><small>與上一個合理名單比較</small></summary><div class="detail-grid">${["away","home"].map(s=>`<div class="deep-item"><h4>${esc(g[s].ab)} ${esc(g[s].name)}</h4><p>${D.roster[s].changes.length?D.roster[s].changes.map(x=>esc(x.name)+"：近期傷兵回歸紀錄").join("；"):"這場沒有列出第一層新增／減少人物。"}</p><small>基準：${esc(D.roster[s].basis)}</small></div>`).join("")}</div></details><details><summary><span>歷史相似情境</span><small>案例列舉，不算機率</small></summary><div class="deep-item"><p>同規則版本、同門檻、賽前樣本且賽後完整，才列入相似紀錄。上方每項條件可展開看已存案例數。</p></div></details></div></section>`;
  }
  function preBody(){
    return `${pitcherRow()}<section class="primary-block"><div class="section-head"><h2>本場打線</h2><span>${legit==="new"?"新季狀態示意":legit==="projection"?"一隊官方、一隊人工預估測試":legit==="partial"?"一隊官方、一隊未取得":"雙方 MLB 官方已確認"}</span></div><div class="lineup-grid">${lineupFor(g.away,"away")}${lineupFor(g.home,"home")}</div></section>${contextSection()}${test?"":deepSection()}`;
  }
  function innings(){
    return `<section class="primary-block"><div class="section-head"><h2>逐局比分</h2><span>MLB 官方賽後資料・完整</span></div><div class="inning-grid">${D.post.innings.map(i=>`<div class="inning"><b>${i.n} 局</b><span>${esc(g.away.ab)}　${i.away}</span><span>${esc(g.home.ab)}　${i.home}</span></div>`).join("")}</div></section>`;
  }
  function pitchingPost(){
    const box=(s,t)=>{const p=D.post.pitching[s];return `<div class="result-pitch"><h3>${esc(t.ab)} ${esc(t.name)}</h3><div><span>先發 ${esc(p.sp.name)}</span><strong>${fmtOut(p.sp.outs)} 局 / ${p.sp.pitches} 球</strong></div><div><span>牛棚 ${p.rp.apps} 人次</span><strong>${fmtOut(p.rp.outs)} 局 / ${p.rp.pitches} 球</strong></div></div>`};
    return `<section class="primary-block"><div class="section-head"><h2>實際投手使用</h2><span>與賽前預計分開保存</span></div><div class="result-grid">${box("away",g.away)}${box("home",g.home)}</div></section>`;
  }
  function renderGame(){
    const stateLinks=["official","projection","partial","new"].map((s,i)=>link(["官方打線","預估示例","部分未取得","新季零樣本"][i],`game.html?mode=pre&state=${s}`,mode==="pre"&&legit===s)).join("");
    root.innerHTML=`${base("設計預覽 / 單場研究")}
      <nav class="crumb"><a href="./">賽事入口</a><span>／</span><span>gamePk ${g.pk}</span></nav>
      <div class="mode-nav" aria-label="閱讀模式">${link("賽前研究","game.html?mode=pre",mode==="pre")}${link("賽後回看","game.html?mode=post",mode==="post")}</div>
      ${mode==="pre"?`<div class="state-controls"><span>版型狀態檢查</span><nav aria-label="賽前資料狀態">${stateLinks}</nav></div>`:""}
      ${test&&mode==="pre"?testNotice():""}
      <section class="match-hero"><div class="match-meta"><span>${legit==="new"&&mode==="pre"?"新季空值版型測試":`2026 世界大賽・第 ${g.series.n} 戰`}</span><span>${dateLabel(g.twDate)} ${g.twTime} 台灣時間 / ${esc(g.venue)}</span></div>${heroTeams(mode==="post")}<p class="hero-caption">${mode==="post"?"賽後結果優先；下方仍能展開當時保存的賽前資料。":"先核對比賽、先發與打線，再看條件與細節。"}</p></section>
      ${mode==="post"?`${innings()}${pitchingPost()}<details class="pregame-archive"><summary><span>展開當時的賽前研究資料</span><small>賽前快照，未用賽後結果改寫</small></summary>${preBody()}</details>`:preBody()}
      <div class="end-note"><b>資料範圍</b><p>真實示例固定於 101 commit ${D.meta.snapshotCommit.slice(0,7)}，台灣日期 ${g.twDate}。條件卡為賽前保存版本；比分與投手實際使用來自獨立賽後資料。人工測試狀態只檢查版型，不代表歷史事實。</p></div>`;
  }
  if(document.body.dataset.page==="home")renderHome();else renderGame();
})();
