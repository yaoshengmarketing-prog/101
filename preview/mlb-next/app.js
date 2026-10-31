(function previewApp(){
  "use strict";
  const qs=new URLSearchParams(location.search);
  const trialKey=qs.get("trial");
  const T=window.MLB_CROSS_SEASON_TRIAL;
  const F=window.MLB_SAME_GAME_TRIAL, flow=trialKey==="same-game"&&!!F;
  const flowIndex=Math.max(0,Math.min(F?.stages?.length-1||0,Number(qs.get("step"))||0));
  const flowStage=flow?F.stages[flowIndex]:null;
  const pipelineTrial=flow||!!T&&["opening","transition","small"].includes(trialKey);
  if(trialKey&&!pipelineTrial)return; // other diagnostic cases remain in trial-reader.js
  const D=window.PREVIEW_DATA, root=document.getElementById("app");
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateLabel=s=>`${Number(s.slice(5,7))} 月 ${Number(s.slice(8,10))} 日`;
  const twDateLabel=s=>s?`${s.slice(0,4)}/${Number(s.slice(5,7))}/${Number(s.slice(8,10))}`:"日期未取得";
  const state=qs.get("state")||"official", mode=qs.get("mode")==="post"?"post":"pre";
  const legit=["official","projection","partial","new","small","official_empty","bp_missing"].includes(state)?state:"official";
  const test=legit!=="official";
  const newSeason=["new","small","official_empty"].includes(legit);
  const fmtOut=o=>o==null?"—":`${Math.floor(o/3)}.${o%3}`;
  const base=(p)=>`<div class="source-ribbon"><span class="source-dot"></span><span>${p}／第一版閱讀草案已成形</span><strong>${pipelineTrial?"人工來源輸入・實際程式輸出":"固定歷史資料，不是即時頁面"}</strong></div>`;
  const link=(title,href,active)=>`<a href="${href}" class="${active?"active":""}" ${active?'aria-current="page"':""}>${title}</a>`;
  const trialCase=flow?{...flowStage,
    liveGame:flowStage.game.status.code==="pre"?flowStage.game:flowStage.pregame?.game||flowStage.game,
    context:Object.fromEntries((flowStage.game.status.code==="pre"?flowStage.context:flowStage.pregame?.context||flowStage.context).checks.map(x=>[x.id,x])),
    bullpen:flowStage.game.status.code==="pre"?flowStage.bullpen:flowStage.pregame?.bullpen||flowStage.bullpen,
    priorReference:F.priorReference}
    :pipelineTrial?(trialKey==="opening"?T.opening:T.cases[trialKey]):null;
  const g=pipelineTrial?(trialCase.liveGame||trialCase.game):D.game;
  const researchPair=side=>trialCase?.matchupStatus==="current"?trialCase.matchup?.pairs?.find(x=>x.pitcherSide===side):null;
  const prior=()=>trialCase?.priorReference;
  const priorStatus=s=>s==="no_record"?"上季確定無紀錄":s==="scope_unconfirmed"?"上季例行賽範圍未確認":"上季資料未取得";
  const heroTeams=(post)=>`<div class="match-header">
    <div class="club"><span class="club-code">${esc(g.away.ab)}</span><strong>${esc(g.away.name)}</strong><small>客隊</small></div>
    <div class="versus">${post?`<span class="score">${(flowStage?.post||D.post).final.away.runs}<i>:</i>${(flowStage?.post||D.post).final.home.runs}</span><small>已結束</small>`:`<span class="at">對</span><small>賽前資料</small>`}</div>
    <div class="club home-club"><span class="club-code">${esc(g.home.ab)}</span><strong>${esc(g.home.name)}</strong><small>主隊</small></div>
  </div>`;
  function renderHome(){
    if(flow){
      const x=F.stages[0].game;
      root.innerHTML=`${base("設計預覽 / 賽事入口")}
        <section class="page-title"><div><p class="overline">MLB / 同場連續試跑</p><h1>同一場，從賽前到賽後</h1><p>以下七個閱讀狀態共用人工 gamePk ${x.pk}，每輪承接前一輪保存結果。</p></div></section>
        <div class="test-notice"><b>獨立人工試跑，非正式網站</b><span>${esc(F.meta.warning)}</span></div>
        <section class="list-heading"><h2>2027 例行賽・人工案例</h2><span>台灣時間；美國賽程日另列</span></section>
        <article class="game-row"><div class="game-time"><strong>${esc(x.twTime)}</strong><span>${esc(twDateLabel(x.twDate))} 台灣時間</span><small>美國賽程日 ${esc(x.usDate)}</small></div><div class="game-clubs"><div><b>${esc(x.away.ab)}</b><strong>${esc(x.away.name)}</strong></div><div><b>${esc(x.home.ab)}</b><strong>${esc(x.home.name)}</strong></div></div><div class="game-essential"><span>同一 gamePk ${x.pk}</span><p>從官方打線未取得到完賽補齊</p><small>資料由 build-live、matchup、ctx、post 等處理</small></div><div class="game-action"><a class="action-link" href="game.html?trial=same-game&step=0">從第一步閱讀 <span aria-hidden="true">↗</span></a></div></article>`;
      return;
    }
    if(pipelineTrial){
      const cases=[["opening",T.opening.game,"開幕零樣本"],["transition",T.cases.transition.liveGame,"春訓銜接"],["small",T.cases.small.liveGame,"本季少樣本"]];
      root.innerHTML=`${base("設計預覽 / 賽事入口")}
        <section class="page-title"><div><p class="overline">MLB / 跨季資料試跑</p><h1>從賽事進入研究</h1><p>以下三場為人工輸入，資料由本分支實際處理程式產出。</p></div></section>
        <div class="test-notice"><b>固定跨季試跑</b><span>${esc(T.meta.warning)}</span></div>
        <section class="list-heading"><h2>2027 例行賽・人工案例</h2><span>賽季與賽別取自程式輸出</span></section>
        ${cases.map(([key,x,label])=>`<article class="game-row"><div class="game-time"><strong>${esc(x.twTime||"未定")}</strong><span>${esc(twDateLabel(x.twDate))} 台灣時間</span><small>美國賽程日 ${esc(x.usDate)}</small></div><div class="game-clubs"><div><b>${esc(x.away.ab)}</b><strong>${esc(x.away.name)}</strong></div><div><b>${esc(x.home.ab)}</b><strong>${esc(x.home.name)}</strong></div></div><div class="game-essential"><span>${esc(label)}</span><p>${esc(x.away.sp?.name??"先發未取得")}／${esc(x.home.sp?.name??"先發未取得")}</p><small>本場打線：${x.lineup==="official"?"官方九棒已取得":"未完整取得"}</small></div><div class="game-action"><a class="action-link" href="game.html?trial=${key}">看單場研究 <span aria-hidden="true">↗</span></a></div></article>`).join("")}
        <p class="page-note">2026 春訓固定回查與其他診斷案例見 <a href="index.html?trial=r_off_day">試跑閱讀器</a>；不把 2027 人工輸入當成真實賽程。</p>`;
      return;
    }
    const quiet=qs.get("view")==="quiet";
    const homeLink=`game.html?mode=pre`;
    const recent=D.recent.map((r,i)=>`<li class="recent-row"><span class="recent-date">${dateLabel(r.twDate)}</span><span class="recent-pair">${esc(r.away.ab)} <b>${r.away.score} : ${r.home.score}</b> ${esc(r.home.ab)}</span>${i===0?`<a href="game.html?mode=post" aria-label="查看 ${esc(r.away.ab)} 對 ${esc(r.home.ab)} 的單場回放">單場回放</a>`:`<a href="../../live/game.html?pk=${r.pk}" aria-label="查看 ${esc(r.away.ab)} 對 ${esc(r.home.ab)} 的既有單場資料">既有資料頁</a>`}</li>`).join("");
    const S=window.SPRING_PREVIEW_DATA;
    const spring=S?`<section id="spring-example" class="spring-section"><div class="section-head"><h2>春訓｜完賽回看示例</h2><span>2026/3/24 美國賽程日・與例行賽分開</span></div><article class="game-row"><div class="game-time"><strong>${esc(S.game.twTime)}</strong><span>完賽後回查</span><small>春訓 S・台灣 3/25</small></div><div class="game-clubs"><div><b>${esc(S.game.away.ab)}</b><strong>${esc(S.game.away.name)}</strong><span>客</span></div><div><b>${esc(S.game.home.ab)}</b><strong>${esc(S.game.home.name)}</strong><span>主</span></div></div><div class="game-essential"><span>最終比分</span><p>${S.game.away.score}：${S.game.home.score}</p><small>原先發九棒、逐局與實際用球可回看</small></div><div class="game-action"><a href="spring.html" class="action-link">看春訓單場 <span aria-hidden="true">↗</span></a><small>不是當時賽前快照</small></div></article><p class="page-note">本區只示範春訓賽別入口；資料是賽後回查，不代表 2027 賽前來源已驗證。</p></section>`:"";
    root.innerHTML=`${base("設計預覽 / 賽事入口")}
      <section class="page-title"><div><p class="overline">MLB 比賽資料</p><h1>從賽事進入研究</h1><p>首頁只顯示找比賽需要的資料；完整脈絡留在單場頁。</p></div><div class="date-stamp"><b>2026.10.29</b><span>固定回放日</span></div></section>
      <nav class="segment-tabs" aria-label="預覽情境">${link("賽事入口示例","./",!quiet)}${link("近期無賽", "?view=quiet",quiet)}</nav>
      ${quiet?`<section class="quiet-intro"><h2>目前沒有近期賽事</h2><p>人工情境測試：假設今天、明天和之後七天均無賽程。保留最近完賽入口，不推定球季已結束。</p></section>`:
      `<div class="test-notice"><b>歷史賽前閱讀示例</b><span>以已保存的 2026 賽前欄位重建頁面；不是當時整頁快照，也不是今天有賽事。</span></div><section class="list-heading"><h2>10 月 29 日</h2><span>世界大賽　1 場・台灣時間</span></section>
      <article class="game-row"><div class="game-time"><strong>08:00</strong><span>賽前回放</span><small>世界大賽 G5</small></div><div class="game-clubs"><div><b>${esc(g.away.ab)}</b><strong>${esc(g.away.name)}</strong><span>客</span></div><div><b>${esc(g.home.ab)}</b><strong>${esc(g.home.name)}</strong><span>主</span></div></div><div class="game-essential"><span>先發</span><p>${esc(g.away.sp.name)}<br>${esc(g.home.sp.name)}</p><small>雙方官方打線已存・當時版本</small></div><div class="game-action"><a href="${homeLink}" class="action-link">看單場研究 <span aria-hidden="true">↗</span></a><a href="game.html?mode=post" class="text-link">直接看賽後</a></div></article>`}
      ${spring}
      <section class="recent-section"><div class="section-head"><h2>最近完賽</h2><span>固定快照中的 10 場・日期與比分</span></div><ul class="recent-list">${recent}</ul></section>
      <p class="page-note">本草案的單場研究示例為 gamePk ${g.pk}。其他完賽列連到既有 /live/ 資料頁，用於檢查回看入口。</p>`;
  }
  function testNotice(){
    const title={projection:"預估打線狀態測試",partial:"部分未取得狀態測試",new:"新一季零樣本狀態測試",small:"開季少樣本狀態測試",official_empty:"官方九棒已公布／本季無成績狀態測試",bp_missing:"牛棚部分用球未取得狀態測試"}[legit];
    const desc={projection:"以人工測試球員示範第三方預估的版面；不是任何來源的真實預估。",partial:"模擬主隊官方打線尚未取得；未取得不填 0，也不沿用作本場官方。",new:"借用這場對戰名稱測試新季空值呈現；不代表 2027 賽程或統計。",small:"人工示範開季少量局數與打席；數字不是 2027 真實成績，也不新增統計門檻。",official_empty:"人工假設官方九棒已公布，但本季打者與投手都尚無例行賽成績；名單姓名不是 2027 真實公告。",bp_missing:"人工假設釀酒人 10/27 的 DL Hall 用球未取得；其他賽事、打線及對位沿用 2026 固定資料，不是真實來源缺漏。"}[legit];
    return `<div class="test-notice" role="status"><b>人工測試資料：${title}</b><span>${desc} 此狀態不進正式資料或研究樣本。</span></div>`;
  }
  const trialState=s=>s==="no_record"?"本季尚無紀錄":s==="scope_unconfirmed"?"當季例行賽資料未確認":s==="stale"?"沿用舊值（見取得時間）":s==="value"?"已取得":"未取得";
  const trialType=x=>({R:"例行賽",S:"春訓",F:"外卡賽",D:"分區賽",L:"聯盟冠軍賽",W:"世界大賽"}[x]||"賽別未確認");
  function pitcherRow(){
    if(pipelineTrial){
      const card=(team,side)=>{
        const p=team.sp, s=p?.s, status=trialState(p?.statStatus), pair=researchPair(side);
        const split=(code,label)=>{const v=pair?.splits?.[code],st=pair?.splitStatus?.[code];
          return v?`${label}被打 OPS ${esc(v.ops)}（${esc(v.pa)} 打席）`:`${label}被打 OPS：${pair?trialState(st):"對位版本未確認"}`};
        const starts=pair?.recent?.starts||[];
        const recent=pair?.recentStatus==="value"
          ?`${starts.length?`<ol class="recent-starts">${[...starts].reverse().map(x=>`<li><b>${esc(x.date)}</b><span>${esc(x.ha??"")}對${esc(x.opp??"對手未取得")}・${trialType(x.gameType)}</span><span>${esc(x.ip??"?")} 局／${x.np==null?"?":esc(x.np)} 球／${x.er==null?"?":esc(x.er)} 自責</span></li>`).join("")}</ol>`:"<p>已取得登板，尚無先發紀錄。</p>"}<small>最近先發逐筆標賽別；不同於近期所有登板。記錄 ${pair.recent.totalStarts} 次先發，最多列最近三次。</small>`
          :`<p>最近先發：${pair?trialState(pair.recentStatus):"對位版本未確認"}；近期所有登板另看下方用量。</p>`;
        const old=prior()?.pitchers?.[p?.id];
        const previous=p?.statStatus==="no_record"
          ?`<p class="last-season-line">上季參考｜${esc(prior()?.season??"上季")} 例行賽：${old?.status==="value"?`ERA ${esc(old.value.era)}、WHIP ${esc(old.value.whip)}，${esc(old.value.ip)} 局`:priorStatus(old?.status)}。非本季成績。</p><details class="last-season"><summary>展開上季完整資料</summary><p>${old?.status==="value"?`${esc(prior().season)} 例行賽：ERA ${esc(old.value.era)}、WHIP ${esc(old.value.whip)}、${esc(old.value.ip)} 局／${esc(old.value.gs??"?")} 場先發。`:priorStatus(old?.status)} 資料只作獨立參考，不參與本季情境。</p></details>`:"";
        return `<div class="pitcher"><span class="pitcher-label">${esc(team.ab)} 預計先發</span><strong>${esc(p?.name??"未取得")}</strong><span>${p?.hand==="R"?"右投":p?.hand==="L"?"左投":"慣用手未取得"}</span>
          ${s?`<div class="pitcher-metrics"><span>ERA <b>${esc(s.era??"?")}</b></span><span>WHIP <b>${esc(s.whip??"?")}</b></span><span>IP <b>${esc(s.ip??"?")}</b></span></div><small>${esc(g.season)} 例行賽・${esc(s.gs??"?")} 場先發；小樣本仍顯示數字與分母。</small>`:`<div class="sample-message"><b>${status}</b><span>ERA、WHIP、局數沒有可確認的當季 R 數字；不補 0。</span></div>`}
          ${previous}<details class="pitcher-research"><summary>對左右打與最近三次先發</summary><p>${split("vl","對左打")}；${split("vr","對右打")}。手別分項為 ${esc(g.season)} 例行賽。</p>${recent}</details></div>`;
      };
      return `<section class="primary-block"><div class="section-head"><h2>先發投手</h2><span>客隊在左・主隊在右</span></div><div class="pitcher-grid">${card(g.away,"away")}${card(g.home,"home")}</div></section>`;
    }
    const t=(team,side)=>{
      const sample=D.testOnly.small.pitchers[side];
      const stats=legit==="small"?`<div class="pitcher-metrics"><span>ERA <b>${sample.era}</b></span><span>WHIP <b>${sample.whip}</b></span><span>IP <b>${sample.ip}</b></span></div><small>2027 例行賽・人工測試：${sample.er} 自責分／${sample.outs} 出局；${sample.h} 安＋${sample.bb} 保送。樣本少，不下高低結論。</small>`:newSeason?`<div class="sample-message"><b>2027 例行賽確定尚無出賽</b><span>ERA、WHIP 尚無計算基礎；不填 0。</span></div><p class="last-season-line">上季參考｜2026 例行賽：ERA ${team.sp.era}、WHIP ${team.sp.whip}，${team.sp.ip} 局。非 2027 成績。</p>`:`<div class="pitcher-metrics"><span>ERA <b>${team.sp.era}</b></span><span>WHIP <b>${team.sp.whip}</b></span><span>IP <b>${team.sp.ip}</b></span></div><small>2026 大聯盟例行賽・${team.sp.gs} 場先發</small>`;
      const pair=D.matchup.find(x=>x.pitcherSide===side);
      const research=newSeason?`<p>2027 本季最近先發與對左右打分項未取得；不挪用 2026 紀錄。</p>`:`<p>2026 例行賽對左打被打 OPS ${esc(pair.splits.vl?.ops??"?")}（${esc(pair.splits.vl?.pa??"?")} 打席）；對右打被打 OPS ${esc(pair.splits.vr?.ops??"?")}（${esc(pair.splits.vr?.pa??"?")} 打席）。</p><ol class="recent-starts">${pair.recent.map(x=>`<li><b>${esc(x.date)}</b><span>${esc(x.ha)}對${esc(x.opp)}・${({D:"分區賽",L:"聯盟冠軍賽",W:"世界大賽",R:"例行賽"}[x.gameType]||esc(x.gameType))}</span><span>${esc(x.ip)} 局／${esc(x.np)} 球／${esc(x.er)} 自責</span></li>`).join("")}</ol><small>最近三次先發包含季後賽，賽別逐筆標示；上方手別分項只取 2026 例行賽。</small>`;
      return `<div class="pitcher"><span class="pitcher-label">${esc(team.ab)} 預計先發</span><strong>${esc(team.sp.name)}</strong><span>${team.sp.hand==="R"?"右投":"左投"}</span>${stats}<details class="pitcher-research"><summary>對左右打與最近三次先發</summary>${research}</details>${newSeason?`<details class="last-season"><summary>展開上季完整資料</summary><p>2026 例行賽固定快照：ERA ${team.sp.era}、WHIP ${team.sp.whip}、${team.sp.ip} 局／${team.sp.gs} 先發。這不是 2027 成績。</p></details>`:""}</div>`;
    };
    return `<section class="primary-block"><div class="section-head"><h2>先發投手</h2><span>客隊在左・主隊在右</span></div><div class="pitcher-grid">${t(g.away,"away")}${t(g.home,"home")}</div></section>`;
  }
  const nameKey=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const twTime=s=>s?new Date(s).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}):"未取得";
  function previousLineup(side){
    if(newSeason)return "<p>人工 2027 情境未提供上一場正式打線；不能把 2026 的上一場當成本季上一場。</p>";
    const prev=D.lineupResearch[side].previous;
    if(!prev?.slots?.length)return "<p>這場固定版本未保存上一場逐棒資料。</p>";
    return `<p class="research-note">上一場實際打線參考｜美國賽程日 ${esc(prev.date)}，${esc(prev.ha)}對${esc(prev.opp)}，比分 ${esc(prev.score)}。這不是本場的預估或官方九棒。</p><ol class="reference-lineup">${prev.slots.map(x=>`<li><b>${x.n}</b><strong>${esc(x.name)}</strong><span>${esc(x.pos)}</span></li>`).join("")}</ol><a class="research-link" href="../../live/game.html?pk=${prev.pk}">查看上一場既有單場頁 ↗</a>`;
  }
  function compareProjection(version,official){
    const projected=version?.slots||[],officialSlots=official?.slots||[];
    if(!projected.length||!officialSlots.length)return "<p>這個版本缺少完整預估或官方逐棒快照，無法逐棒比對。</p>";
    const pm=new Map(projected.map(x=>[nameKey(x.name),x])),om=new Map(officialSlots.map(x=>[nameKey(x.name),x]));
    const entered=officialSlots.filter(x=>!pm.has(nameKey(x.name))),left=projected.filter(x=>!om.has(nameKey(x.name)));
    const moved=officialSlots.filter(x=>pm.has(nameKey(x.name))&&pm.get(nameKey(x.name)).n!==x.n);
    const people=entered.length||left.length?`官方新增：${entered.map(x=>esc(x.name)).join("、")||"無"}；預估未入官方：${left.map(x=>esc(x.name)).join("、")||"無"}。`:"九棒人選相同。";
    const order=moved.length?moved.map(x=>`${esc(x.name)} 預估 ${pm.get(nameKey(x.name)).n} 棒 → 官方 ${x.n} 棒`).join("；")+"。":"共同人選棒次相同。";
    return `<p class="research-note">本站保存 ${twTime(version.at)} 的 ${esc(version.status||"預估")}；官方首次取得 ${twTime(official.at)}。兩者都是本站時間，來源發布時刻未取得。</p><div class="source-diff"><p><b>人選差異</b>${people}</p><p><b>棒次差異</b>${order}</p></div><div class="source-table"><div class="source-table-head"><b>棒次</b><b>預估・${esc(version.status||"Expected")}</b><b>MLB 官方</b></div>${officialSlots.map(x=>{const p=projected.find(y=>y.n===x.n);return `<div class="${nameKey(p?.name)===nameKey(x.name)?"":"changed"}"><b>${x.n}</b><span>${esc(p?.name??"未取得")}</span><strong>${esc(x.name)}</strong></div>`}).join("")}</div>`;
  }
  function sourceComparison(side){
    if(newSeason)return "<p>人工 2027 情境沒有真實預估、第三方確認、官方與臨場異動的逐棒版本；本場固定的 2026 來源不得移作新季來源。</p>";
    if((legit==="projection"&&side==="home")||(legit==="partial"&&side==="home"))return "<p>此隊打線是人工測試狀態，沒有可核對的本測試預估與官方逐棒來源。切回「官方打線」可看 2026 固定版本。</p>";
    const r=D.lineupResearch[side],p=r.projected,o=r.official;
    const versions=p.versions.filter(v=>new Date(v.at)<=new Date(p.frozenAt));
    const latest=versions.at(-1),first=versions[0];
    return `<p class="research-note">預估：${esc(p.source)}／${esc(p.status)}；MLB 官方：另存九棒。以下只使用賽前已保存的版本，不拿賽後結果改寫。</p>${compareProjection(latest,o)}${versions.length>1?`<details class="source-earlier"><summary>查看最早保存預估（${twTime(first.at)}）</summary>${compareProjection(first,o)}</details>`:""}<div class="source-status"><p><b>第三方交叉來源｜${esc(p.crossSource||"未取得")}</b>固定檔只有人選／棒次彙總 ${esc(p.crossCmp?.people??"?")}／9、${esc(p.crossCmp?.order??"?")}／9；未保存可展示的逐棒快照。第三方「已確認官方」狀態：${p.confirmed?"有保存":"未取得"}。</p><p><b>MLB 官方</b>本站首次取得 ${twTime(o.at)}；來源發布時刻未取得。</p><p><b>臨場異動</b>${o.lateAt?`本站記錄 ${twTime(o.lateAt)}`:"此固定快照沒有記錄異動時間；不能推定之後絕無異動。"} </p></div>`;
  }
  function lineupFor(team,side){
    if(pipelineTrial){
      const slots=team.lineup?.slots||[], status=team.lineup?.state;
      const prev=team.prev;
      const pair=researchPair(side==="away"?"home":"away"), hand=pair?.pitcher?.hand;
      const vsLabel=hand==="L"?"對左投":hand==="R"?"對右投":"對手先發手別未取得";
      const vsText=x=>{const v=pair?.lineup?.slots?.find(y=>y.id===x.id&&y.n===x.n);
        if(!pair)return "本場對位版本未確認";
        if(!hand)return "對手先發手別未取得";
        if(v?.vs?.pa===0)return `${vsLabel} 0 打席・OPS 尚無計算基礎`;
        if(v?.vs?.ops!=null)return `${vsLabel} OPS ${esc(v.vs.ops)}・${esc(v.vs.pa)} 打席`;
        return `${vsLabel}：${v?.why==="scope_unconfirmed"?"本季例行賽範圍未確認":v?.why==="nosplit"?"本季尚無手別紀錄":"資料未取得"}`;};
      const noSeason=slots.length>0&&slots.every(x=>x.statStatus==="no_record");
      const lastTeam=prior()?.teams?.[team.id]?.ops, lastSeason=prior()?.season;
      const previous=noSeason?`<p class="last-season-line">上季參考｜${esc(lastSeason??"上季")} 例行賽團隊 OPS ${lastTeam?.status==="value"?esc(lastTeam.value):priorStatus(lastTeam?.status)}；逐棒上季數字可展開。非本季成績。</p><details class="last-season"><summary>展開上季逐棒參考</summary><ol class="reference-lineup">${slots.map(x=>{const old=prior()?.batters?.[x.id];return `<li><b>${x.n}</b><strong>${esc(x.name)}</strong><span>${old?.status==="value"?`OPS ${esc(old.value.ops)}／${esc(old.value.pa)} 打席`:priorStatus(old?.status)}</span></li>`}).join("")}</ol><p>${esc(lastSeason??"上季")} 例行賽；不填入本季欄位或情境。</p></details>`:"";
      const prevText=prev?`<p>上一場打線參考：${esc(prev.date)} ${trialType(prev.gameType)}，對${esc(prev.opp)}；僅作參考，不作開幕名單增減基準。</p>${prev.slots?.length?`<ol class="reference-lineup">${prev.slots.map(x=>`<li><b>${x.n}</b><strong>${esc(x.name)}</strong><span>${esc(x.pos??"?")}</span></li>`).join("")}</ol>`:"<p>上一場逐棒未取得。</p>"}`:"<p>沒有可確認的上一場逐棒資料。</p>";
      return `<div class="lineup-panel"><div class="lineup-title"><h3>${esc(team.ab)} ${esc(team.name)}</h3><span class="status-tag ${slots.length?"confirmed":"muted"}">${status==="official"?"MLB 官方九棒":status==="late"?"臨場異動":status==="withdrawn"?"來源撤回":"本場打線未取得"}</span></div>
        ${slots.length?`<ol class="lineup-list">${slots.map(x=>`<li><span>${x.n}</span><strong>${esc(x.name)}</strong><em>${esc(x.pos??"?")}</em><small>本季總 ${x.ops!=null?`OPS ${esc(x.ops)}・${esc(x.pa??"?")} 打席`:trialState(x.statStatus)}<br>${vsText(x)}</small></li>`).join("")}</ol>`:"<p class=\"empty-copy\">本場九棒尚未取得；不從上一場填入。</p>"}
        <p class="lineup-foot">${esc(g.season)} 例行賽；手別成績是對左／右投，不是對本場先發的生涯交手。名單為人工來源輸入。</p>
        ${previous}
        <details class="lineup-more"><summary>整體成績與計算基礎</summary><p>${slots.map(x=>`${esc(x.name)}：${x.ops!=null?`OPS ${esc(x.ops)}／${esc(x.pa??"?")} 打席`:trialState(x.statStatus)}`).join("；")||"尚無可確認的當季 R 成績"}。</p></details>
        <details class="lineup-more"><summary>預估與官方來源狀態</summary><p>本次程式輸出僅提供官方打線；第三方預估、確認及來源發布時刻未取得，不補逐棒版本。本站首次取得：${esc(team.lineup.firstSeen??"未取得")}（人工時鐘）。</p></details>
        <details class="lineup-more"><summary>上一場打線參考</summary>${prevText}</details></div>`;
    }
    const missing=legit==="new"||(legit==="partial"&&side==="home");
    const projected=legit==="projection"&&side==="home";
    const synthetic=newSeason||projected;
    if(missing)return `<div class="lineup-panel"><div class="lineup-title"><h3>${esc(team.ab)} ${esc(team.name)}</h3><span class="status-tag muted">本場打線未取得</span></div><p class="empty-copy">本場沒有可確認的 1–9 棒；其他已取得資料仍可讀。上一場打線不充當本場官方名單。</p><details class="lineup-more"><summary>預估／官方來源狀態</summary>${sourceComparison(side)}</details><details class="lineup-more"><summary>上一場打線參考</summary>${previousLineup(side)}</details></div>`;
    const slots=synthetic?Array.from({length:9},(_,i)=>({n:i+1,name:`測試球員 ${i+1}`,pos:["CF","2B","RF","1B","DH","3B","LF","C","SS"][i]})):team.lineup.slots;
    const pair=D.matchup.find(x=>x.battingSide===side);
    const vsById=new Map(pair.lineup.map(x=>[x.id,x.vs]));
    const seasonCell=(x)=>{
      if(legit==="small"){
        const h=D.testOnly.small.hitters[side], z=D.testOnly.small.hitters.validZero;
        if(x.n===1)return `<small>OPS ${h.ops}・${h.pa} 打席</small>`;
        if(x.n===2&&side==="away")return `<small>OPS ${z.ops}・${z.pa} 打席（有效 0）</small>`;
        return "<small>本季尚無成績</small>";
      }
      if(legit==="official_empty")return "<small>本季尚無成績</small>";
      if(projected)return "<small>人工預估・無本季統計</small>";
      const vs=vsById.get(x.id);
      return `<small>對本場先發${pair.starterHand==="R"?"右":"左"}投：OPS ${esc(vs?.ops??"?")}・${esc(vs?.pa??"?")} 打席</small>`;
    };
    const row=x=>`<li><span>${x.n}</span><strong>${esc(x.name)}</strong><em>${esc(x.pos)}</em>${seasonCell(x)}</li>`;
    const status=synthetic?(projected?"人工預估名單測試":"官方九棒情境・人工測試"):"MLB 官方打線";
    
    const more=legit==="small"?`<p>人工小樣本第一棒：${side==="away"?"OPS .762 = OBP .429（2 安＋1 保送／7）＋SLG .333（2 壘打／6 打數）":"OPS .788 = OBP .333（3 安＋1 保送／12）＋SLG .455（5 壘打／11 打數）"}；只列數值和分母，不下高低結論。</p>${side==="away"?"<p>第二棒 OPS .000：5 打席、5 打數、0 安、0 保送、0 壘打，是有效的 0，不是未取得。</p>":""}`:legit==="official_empty"?"<p>本季確定尚無出賽與打席，OPS 尚無計算基礎；不填 0。春訓另列。</p>":projected?"<p>人工預估示例沒有真實球員成績。</p>":`<p>2026 例行賽 AVG／OPS：${slots.map(x=>`${esc(x.name)} ${esc(x.avg)} / ${esc(x.ops)}`).join("；")}。</p>`;
    return `<div class="lineup-panel"><div class="lineup-title"><h3>${esc(team.ab)} ${esc(team.name)}</h3><span class="status-tag ${synthetic?"projected":"confirmed"}">${status}</span></div><ol class="lineup-list">${slots.map(row).join("")}</ol><p class="lineup-foot">${newSeason?"2027 例行賽版型測試；人工名單和人工成績不進正式資料。":projected?"這組預估姓名是人工測試，不是第三方來源內容。":"對本場先發手別 OPS／打席取 2026 例行賽；不是兩人直接對戰。"}</p><details class="lineup-more"><summary>整體成績與計算基礎</summary>${more}</details><details class="lineup-more"><summary>預估與官方逐棒來源對照</summary>${sourceComparison(side)}</details><details class="lineup-more"><summary>上一場打線參考</summary>${previousLineup(side)}</details></div>`;
  }
  function historyList(id){
    const h=D.history.byRule[id];
    if(!h)return "<p>此固定賽前版本沒有保存這項條件的逐筆清單。</p>";
    const type=x=>x==="R"?"例行賽":"季後賽";
    const caseRow=x=>{
      const match=x.scope==="team"&&x.teams?.length?x.teams.map(t=>`${esc(t.ab)}（${t.side==="home"?"主":"客"}）`).join("、"):"整場條件（雙方）";
      const score=`${esc(x.score.away.ab)} ${x.score.away.runs}：${x.score.home.runs} ${esc(x.score.home.ab)}`;
      const late=`第 ${x.lateFrom} 局起：${esc(x.score.away.ab)} ${x.score.away.lateRuns} 分／${esc(x.score.home.ab)} ${x.score.home.lateRuns} 分`;
      return `<li><div><b>${esc(x.twDate)}</b><span>${type(x.gameType)}・符合方：${match}</span></div><strong>${score}</strong><small>${late}</small><a href="../../live/game.html?pk=${x.pk}">既有單場頁 ↗</a></li>`;
    };
    const counts=`例行賽 ${h.byType?.R??0}、季後賽 ${h.byType?.post??0}${h.byType?.unknown?`、其他 ${h.byType.unknown}`:""}`;
    return `<div class="history-list"><p>符合條件共 ${h.n} 場（${counts}）；本賽前快照保留最近 ${h.listed} 場明細${h.listed<10?"（最多 10 場）":""}。</p><ol>${h.games.map(caseRow).join("")}</ol><p><b>查證註記：</b>僅納入同規則、同門檻且賽後完整的案例，不換算勝率。${h.listed<h.n?"未逐筆列出的案例已計入上方總數；不以後來資料補寫舊快照。":""}規則版本 ${esc(h.rules)}；849799 賽前情境凍結於 ${twTime(D.history.frozenAt)}。日期為台灣賽事日；比分與第 7 局起得分是本場賽前清單已保存的案例結果，沒有改寫案例各自的賽前快照。「既有單場頁」連到目前 /live/，不是案例當時的賽前版本。</p></div>`;
  }
  function contextSection(){
    if(pipelineTrial){
      const c=trialCase.context, rows=[c.bp_load,c.bp_streak];
      return `<section class="context-block"><div class="section-head"><h2>值得一起看的條件</h2><span>依既有規則輸出；暫不判定不等於未達門檻</span></div><div class="context-list">${rows.map(x=>`<div class="context-row"><div><span class="context-rule">${esc(x.title)}</span><strong>${x.state==="na"?"暫不判定":x.state==="hit"?"符合門檻":"未達門檻"}</strong></div><details><summary>依據與範圍</summary><p>${esc(x.why||x.value||"")}</p><p>既有門檻：${esc(x.threshold)}</p></details></div>`).join("")}</div><p class="page-note">其他情境條件未納入這些人工案例的頁面接入，不借 2026 結果填入。</p></section>`;
    }
    if(test&&legit!=="bp_missing")return `<section class="context-block"><div class="section-head"><h2>值得一起看的條件</h2><span>固定規則產生的事實提示</span></div><div class="empty-copy inset">此測試狀態未用真實輸入重算情境卡，因此不顯示條件判斷。</div></section>`;
    return `<section class="context-block"><div class="section-head"><h2>值得一起看的條件</h2><span>成立 ${D.context.length} 項・只列事實</span></div><div class="context-list">${D.context.map(x=>`<div class="context-row"><div><span class="context-rule">${esc(x.title)}</span><strong>${esc(x.value)}</strong></div><details><summary>依據與歷史例子</summary><p>門檻：${esc(x.threshold)}</p><p>${esc(x.says?.[0]||"")}</p>${historyList(x.id)}</details></div>`).join("")}</div></section>`;
  }
  function bullpenHistorical(){
    const windowDates=D.bullpen.window, dates=[...windowDates.full,windowDates.today];
    const missing=legit==="bp_missing"?D.testOnly.bullpenMissing:null;
    const box=(side,team)=>{
      const source=D.bullpen[side];
      const days=source.days.map(x=>{
        if(missing?.side===side&&missing.date===x.date){
          const lost=source.pitchers.find(p=>p.id===missing.pitcherId)?.days[x.date]?.pitches;
          return {...x,state:"partial",complete:false,pitches:Number.isFinite(lost)?x.pitches-lost:null};
        }
        return x;
      });
      const pitchers=source.pitchers.map(p=>{
        if(missing?.side===side&&p.id===missing.pitcherId){
          const copy={...p,days:{...p.days}};
          copy.days[missing.date]={...p.days[missing.date],pitches:null};
          return copy;
        }
        return p;
      });
      const full=days.filter(x=>windowDates.full.includes(x.date));
      const known=full.reduce((sum,x)=>sum+(Number.isFinite(x.pitches)?x.pitches:0),0);
      const incomplete=full.some(x=>x.state==="partial"||(!x.complete&&x.state!=="off")||(x.state!=="off"&&!Number.isFinite(x.pitches)));
      const amount=incomplete?`已取得部分小計 ${known} 球（資料未齊，實際可能更多）`:`前三個完整日 ${known} 球`;
      const playerKnown=p=>windowDates.full.reduce((sum,date)=>sum+(Number.isFinite(p.days[date]?.pitches)?p.days[date].pitches:0),0);
      const leaders=[...pitchers].filter(p=>playerKnown(p)>0).sort((x,y)=>playerKnown(y)-playerKnown(x)).slice(0,2);
      const day=x=>`<div><b>${dateLabel(x.date)}${x.date===windowDates.today?"・本日":""}</b><span>${x.state==="off"?"無賽程":x.state==="partial"?`已知 ${Number.isFinite(x.pitches)?x.pitches+" 球":"?"}・部分未取得`:Number.isFinite(x.pitches)?x.pitches+" 球":"?"}</span></div>`;
      const cell=(p,date)=>{
        const dayState=days.find(x=>x.date===date);
        if(dayState?.state==="off")return "無賽程";
        const v=p.days[date]?.pitches;
        if(Number.isFinite(v))return v+" 球";
        if(p.days[date]||!dayState?.complete)return "?";
        return "—";
      };
      const player=p=>{
        const n=playerKnown(p),hasMissing=windowDates.full.some(date=>days.find(x=>x.date===date)?.state!=="off"&&p.days[date]&&!Number.isFinite(p.days[date].pitches));
        return `<div class="bp-player"><div><strong>${esc(p.name)}</strong><small>${hasMissing&&n===0?"前三日部分未取得；已知日未登板":`前三日 ${hasMissing?"已知 ":""}${n} 球${hasMissing?"・部分未取得":""}`}${p.streak>=2?`・連 ${p.streak} 日登板`:""}</small></div><div class="bp-day-grid">${dates.map(date=>`<span><small>${dateLabel(date)}</small><b>${cell(p,date)}</b></span>`).join("")}</div></div>`;
      };
      return `<div class="bp-team"><h3>${esc(team.ab)} ${esc(team.name)}</h3><p class="bp-summary">${amount}；${incomplete?"已取得資料中，用球最多的是":"主要承擔者："}${leaders.map(p=>`${esc(p.name)} ${playerKnown(p)} 球`).join("、")}。這是用量紀錄，不推論今天可否登板。</p><div class="bp-calendar">${days.map(day).join("")}</div><details class="bp-details"><summary>展開逐投手用球（${pitchers.length} 人）</summary>${pitchers.map(player).join("")}<p class="lineup-foot">無賽程＝確定沒比賽；—＝確定沒登板；0 球＝有效 0；?＝未取得。有缺值時僅顯示已取得部分小計。</p></details></div>`;
    };
    return `<div class="bp-grid">${box("away",g.away)}${box("home",g.home)}</div>`;
  }
  function bullpenSection(){
    if(pipelineTrial){
      const B=trialCase.bullpen;
      const card=(side,team)=>{
        const s=B.summary[side], usage=s.recentUsage||[], known=usage.filter(x=>Number.isFinite(x.pitches));
        const count=known.reduce((n,x)=>n+x.pitches,0), missing=usage.length-known.length+B.summary[side].days.reduce((n,x)=>n+x.gamesMissing,0);
        const days=s.days.map(x=>{const type=[...new Set(x.games.map(y=>trialType(y.gameType)))].join("、");
          const label=x.st==="off"?"確認無賽程":x.st==="played"?"已完賽":x.st==="error"?"資料未取得":x.st==="incomplete"?"部分資料未取得":esc(x.st);
          return `<div><b>${dateLabel(x.d)}${x.d===B.window.today?"・本日":""}</b><span>${label}${type?"・"+esc(type):""}</span></div>`;});
        return `<div class="bp-team"><h3>${esc(team.ab)} ${esc(team.name)}</h3><p class="bp-summary">已取得 ${usage.length} 筆實際登板；已取得球數小計 ${count} 球${missing?"，仍有 "+missing+" 項未取得":""}。${usage.some(x=>x.gameType==="S")?"含春訓時僅供閱讀，不當例行賽牛棚情境輸入。":"本視窗為例行賽，情境仍依完整度與既有門檻判定。"}</p><div class="bp-calendar">${days.join("")}</div><details class="bp-details"><summary>展開逐筆登板（${usage.length} 筆）</summary>${usage.length?usage.map(x=>`<div class="bp-player"><div><strong>${esc(x.name??"姓名未取得")}</strong><small>${esc(x.day)}・${trialType(x.gameType)}</small></div><div class="bp-day-grid"><span><small>實際局數</small><b>${esc(x.ip??"?")}</b></span><span><small>用球</small><b>${x.pitches==null?"?":esc(x.pitches)} 球</b></span></div></div>`).join(""):"<p>這個視窗沒有已取得的登板明細；請看每日狀態，不直接判成零登板。</p>"}<p class="lineup-foot">確認無賽程是已知狀態；? 是未取得；有效 0 球保留。出場順序不推定固定牛棚角色。</p></details></div>`;
      };
      return `<section class="primary-block bullpen-section"><div class="section-head"><h2>近期實際登板與用量</h2><span>前三完整美國賽程日 ${B.window.full.map(x=>x.slice(5)).join("、")}；本日 ${B.window.today.slice(5)} 另列</span></div><div class="bp-grid">${card("away",g.away)}${card("home",g.home)}</div></section>`;
    }
    return `<section class="primary-block bullpen-section"><div class="section-head"><h2>牛棚近期使用</h2><span>美國賽程日：前三個完整日 10/25–10/27；本日 10/28 另列</span></div>${newSeason?`<div class="empty-copy inset">本測試情境未提供 2027 本場牛棚資料：前 3 個完整日、本日與逐投手用球均標「未取得」，不沿用 2026 當作新季數字。<details class="bp-reference"><summary>查看 2026 固定案例（非 2027）</summary>${bullpenHistorical()}</details></div>`:bullpenHistorical()}</section>`;
  }
  function deepSection(){
    if(pipelineTrial){
      const roster=["away","home"].map(side=>{const t=g[side],people=t.roster||[];return `<h4>${esc(t.ab)} 本場名單（已取得 ${people.length} 人）</h4><p>${people.length?people.map(x=>esc(x.name)).join("、"):"名單未取得"}</p>`}).join("");
      const basis=trialKey==="opening"?"上一場為春訓，沒有同季例行賽合理基準；本場名單可讀，不報增減 0。":"此場名單比較尚未由本次最小試跑產出；本場名單照實列出，不推定增減。";
      return `<section class="deep-section"><div class="section-head"><h2>再往下查</h2><span>各資料依自身狀態呈現</span></div><div class="deep-list"><details><summary><span>球場天氣</span><small>${g.weather?"已取得":"本場未取得"}</small></summary><div class="deep-item"><p>${g.weather?esc(g.weather.condition??"條件未取得"):"本場天氣尚未取得；不拿其他場次補入。"}</p></div></details><details><summary><span>本場名單與比較基準</span><small>官方名單照列；比較另看適用性</small></summary><div class="deep-item"><p>${basis}</p>${roster}</div></details></div></section>`;
    }
    const weather=newSeason?"本場 2027 天氣未取得；此人工情境不拿 2026 固定場次天氣冒充。":`${esc(g.venue)}：${esc(D.weather.condition)}；${esc(D.weather.tempF)}°F；風 ${esc(D.weather.wind)}。此場為 Dome，不解讀風向優勢。`;
    const roster=newSeason?"此人工新季情境未提供球員名單異動；標為未取得，不能把舊季零異動當新季現況。":`2026 固定場次：${["away","home"].map(s=>`${esc(g[s].ab)}：${D.roster[s].changes.length?D.roster[s].changes.map(x=>esc(x.name)+" 有近期傷兵回歸紀錄").join("；"):"沒有列出第一層新增／減少人物"}（基準 ${esc(D.roster[s].basis)}）`).join("；")}`;
    return `<section class="deep-section"><div class="section-head"><h2>再往下查</h2><span>各區塊按自身資料狀態呈現</span></div><div class="deep-list"><details><summary><span>球場天氣</span><small>${newSeason?"本場未取得":"2026 固定場次官方資料"}</small></summary><div class="deep-item"><p>${weather}</p></div></details><details><summary><span>名單變動</span><small>${newSeason?"本場未取得":"與合理名單基準比較"}</small></summary><div class="deep-item"><p>${roster}</p></div></details></div></section>`;
  }
  function comparison(){
    if(pipelineTrial){
      const cell=(t,key)=>t.statStatus?.[key]==="value"?`${esc(t[key])}${key==="rec"&&t.gp!=null?`（${t.gp} 場）`:""}`:trialState(t.statStatus?.[key]);
      const line=(left,label,right)=>`<div class="compare-row"><strong>${left}</strong><span>${esc(label)}</span><strong>${right}</strong></div>`;
      const previous=["away","home"].map(side=>{const t=g[side],row=prior()?.teams?.[t.id];return `${esc(t.ab)}：OPS ${row?.ops?.status==="value"?esc(row.ops.value):priorStatus(row?.ops?.status)}、ERA ${row?.era?.status==="value"?esc(row.era.value):priorStatus(row?.era?.status)}`}).join("；");
      return `<section class="comparison primary-block"><div class="section-head"><h2>比賽總覽</h2><span>客隊　｜　項目　｜　主隊</span></div><div class="compare-table"><div class="compare-team"><b>${esc(g.away.ab)} ${esc(g.away.name)}</b><span>客｜主</span><b>${esc(g.home.ab)} ${esc(g.home.name)}</b></div>${line(cell(g.away,"rec"),g.season+" 例行賽戰績",cell(g.home,"rec"))}${line(cell(g.away,"ops"),g.season+" 例行賽 OPS",cell(g.home,"ops"))}${line(cell(g.away,"era"),g.season+" 例行賽團隊 ERA",cell(g.home,"era"))}</div><details class="season-reference"><summary>查看 ${esc(prior()?.season??"上季")} 例行賽團隊參考</summary><p>${previous}。這些是獨立參考，不參與本季欄位或情境。</p></details><p class="season-scope">春訓統計不併入例行賽；上季參考另列。</p></section>`;
    }
    const next=newSeason;
    const row=(left,label,right,note="")=>`<div class="compare-row"><strong>${esc(left)}</strong><span>${esc(label)}${note?`<small>${esc(note)}</small>`:""}</span><strong>${esc(right)}</strong></div>`;
    return `<section class="comparison primary-block"><div class="section-head"><h2>比賽總覽</h2><span>客隊　｜　項目　｜　主隊</span></div><div class="compare-table"><div class="compare-team"><b>${esc(g.away.ab)} ${esc(g.away.name)}</b><span>客｜主</span><b>${esc(g.home.ab)} ${esc(g.home.name)}</b></div>${next?row(legit==="small"?"未取得":"尚無","2027 例行賽戰績",legit==="small"?"未取得":"尚無",legit==="small"?"未提供戰績測試值，不填 0":"尚未開打，不填 0")+row(legit==="small"?"3.2 局":"尚無","本季先發局數",legit==="small"?"8.0 局":"尚無",legit==="small"?"人工測試・局數少，先看分母":"沒有本季先發紀錄"):row(g.away.rec,"2026 例行賽戰績",g.home.rec)+row(g.away.l10,"近十場",g.home.l10)+row(g.away.sp.era,"先發 ERA",g.home.sp.era,"2026 例行賽")}</div>${next?`<details class="season-reference"><summary>查看上一季資料（參考，與新季分開）</summary><div class="compare-table">${row(g.away.rec,"2026 例行賽戰績",g.home.rec)+row(g.away.sp.whip,"2026 先發 WHIP",g.home.sp.whip)}</div><p>此處為 2026 固定快照；不能當成 2027 本季數字。</p></details><p class="season-scope">春訓另列，不併入例行賽；此草案沒有匯入春訓數據。</p>`:""}</section>`;
  }
  function preBody(){
    return `${comparison()}${pitcherRow()}<section class="primary-block"><div class="section-head"><h2>本場打線</h2><span>${pipelineTrial?"本場程式輸出・官方九棒":legit==="new"?"新季狀態示意":legit==="projection"?"一隊官方、一隊人工預估測試":legit==="partial"?"一隊官方、一隊未取得":legit==="small"?"人工少樣本示意":legit==="official_empty"?"人工官方九棒情境・本季無成績":"雙方 MLB 官方已確認"}</span></div><div class="lineup-grid">${lineupFor(g.away,"away")}${lineupFor(g.home,"home")}</div></section>${contextSection()}${bullpenSection()}${deepSection()}`;
  }
  function innings(){
    const P=flowStage?.post||D.post, missing=(i,s)=>P.missing?.some(x=>x.n===i.n&&x.side===s), notPlayed=(i,s)=>P.notPlayed?.some(x=>x.n===i.n&&x.side===s);
    const cell=(i,s)=>notPlayed(i,s)?"未打":missing(i,s)?"?":i[s]==null?"?":esc(i[s]);
    return `<section class="primary-block"><div class="section-head"><h2>逐局比分</h2><span>${flowStage?(P.complete?"完賽・資料完整":"已完賽・資料未齊"):"MLB 官方賽後資料・完整"}</span></div><div class="inning-grid">${P.innings.map(i=>`<div class="inning"><b>${i.n} 局</b><span>${esc(g.away.ab)}　${cell(i,"away")}</span><span>${esc(g.home.ab)}　${cell(i,"home")}</span></div>`).join("")}</div>${flowStage?`<p class="page-note">0＝有效零分；未打＝已確認不需打該半局；?＝來源未取得。${P.incomplete?.length?" 尚缺："+esc(P.incomplete.join("、"))+"；下次可再補。":""}</p>`:""}</section>`;
  }
  function pitchingPost(){
    const P=flowStage?.post||D.post;
    const box=(s,t)=>{const p=P.pitching?.[s];return `<div class="result-pitch"><h3>${esc(t.ab)} ${esc(t.name)}</h3><div><span>先發 ${esc(p?.sp?.name??"未取得")}</span><strong>${p?.sp?.outs==null?"?":fmtOut(p.sp.outs)} 局 / ${p?.sp?.pitches??"?"} 球</strong></div><div><span>牛棚 ${p?.rp?.apps??"?"} 人次</span><strong>${p?.rp?.outs==null?"?":fmtOut(p.rp.outs)} 局 / ${p?.rp?.pitches??"?"} 球</strong></div></div>`};
    return `<section class="primary-block"><div class="section-head"><h2>實際投手使用</h2><span>與賽前預計分開保存</span></div><div class="result-grid">${box("away",g.away)}${box("home",g.home)}</div></section>`;
  }
  function renderGame(){
    if(flow){
      const post=!!flowStage.post, current=flowStage.game, old=flowStage.matchup;
      const steps=F.stages.map((x,i)=>link(esc(x.label),`game.html?trial=same-game&step=${i}`,i===flowIndex)).join("");
      const stale=flowStage.matchupStatus==="stale"
        ?`<div class="test-notice" role="status"><b>新對位重算失敗</b><span>目前先發／九棒已變；舊對位取得於 ${esc(old?.fetchedAt??"未取得")}，只保留追溯，不顯示為新版本的手別成績。錯誤：${esc(flowStage.matchupError??"來源未取得")}</span></div>`:"";
      root.innerHTML=`${base("設計預覽 / 單場研究")}
        <nav class="crumb"><a href="index.html?trial=same-game">賽事入口</a><span>／</span><span>gamePk ${g.pk}・人工測試</span></nav>
        <nav class="state-controls flow-steps" aria-label="同場試跑階段"><span>試跑階段</span><div>${steps}</div></nav>
        <div class="mode-nav" aria-label="閱讀模式"><span class="${post?"":"active"}">賽前研究</span><span class="${post?"active":""}">賽後結果</span></div>
        <div class="test-notice"><b>人工來源輸入・實際程式輸出</b><span>第 ${flowIndex+1}／${F.stages.length} 個保存狀態；本站取得時間 ${esc(flowStage.at)}。來源發布時刻未取得。此案例非真實賽程。</span></div>
        ${stale}
        <section class="match-hero"><div class="match-meta"><span>${esc(g.season)} ${trialType(g.gameType)}・${esc(flowStage.label)}；${post?(flowStage.post.complete?"資料已補齊":"賽後資料未齊"):current.status.code==="live"?"比賽進行中・賽前已凍結":"賽前更新"}</span><span>${esc(twDateLabel(g.twDate))} ${esc(g.twTime)} 台灣時間・${esc(g.venue)}</span></div>${heroTeams(post)}<p class="hero-caption">美國賽程日 ${esc(g.usDate)}。${post?"先看賽後結果，再展開最後成功保存的賽前研究。":current.status.code==="live"?"比賽已開始；下方為最後成功的賽前版本，不含本場賽後數字。":"比賽資料依本階段實際程式輸出顯示。"}</p></section>
        ${post?`${innings()}${pitchingPost()}<details class="pregame-archive"><summary><span>展開當時保存的賽前研究資料</span><small>最後成功版本 ${esc(flowStage.pregame?.context?.updatedAt??"未取得")}；賽後未改寫</small></summary>${preBody()}</details>`:preBody()}
        <div class="end-note"><b>保存與範圍</b><p>人工 gamePk ${g.pk} 的七個狀態共用一筆研究紀錄；賽前情境凍結於 ${esc(flowStage.context.frozen?.at??"尚未開賽")}。賽前 SHA-256 ${esc(F.meta.frozenPregameSha256.slice(0,16))}…，賽後回看相同；賽後結果只進獨立 post 欄位。</p></div>`;
      return;
    }
    if(pipelineTrial){
      root.innerHTML=`${base("設計預覽 / 單場研究")}
        <nav class="crumb"><a href="index.html?trial=opening">賽事入口</a><span>／</span><span>gamePk ${g.pk}・人工測試</span></nav>
        <div class="mode-nav" aria-label="閱讀模式"><a class="active" aria-current="page" href="game.html?trial=${trialKey}">賽前研究</a><span>賽後結果未取得</span></div>
        <div class="test-notice"><b>人工來源輸入・實際程式輸出</b><span>${esc(T.meta.warning)}</span></div>
        <section class="match-hero"><div class="match-meta"><span>${esc(g.season)} ${trialType(g.gameType)}・${trialKey==="opening"?"開幕零樣本":trialKey==="transition"?"春訓銜接":"本季少樣本"}</span><span>${esc(twDateLabel(g.twDate))} ${esc(g.twTime)} 台灣時間・${esc(g.venue)}</span></div>${heroTeams(false)}<p class="hero-caption">美國賽程日 ${esc(g.usDate)}。先核對比賽、先發與官方九棒，再看條件及近期實際用量。賽後資料在此人工案例未取得。</p></section>
        ${preBody()}
        <div class="end-note"><b>資料與限制</b><p>本頁直接讀取本分支 build-live、bullpen、ctx、matchup 的固定試跑輸出；2027 賽程、球員、登板及 2026 上季參考是人工測試輸入，不能當真實來源證據。2026 賽前快照與正式資料沒有改寫。</p></div>`;
      return;
    }
    const stateLinks=["official","projection","partial","new","small","official_empty","bp_missing"].map((s,i)=>link(["官方打線","預估示例","部分未取得","新季零樣本","開季少樣本","官方九棒・無成績","牛棚缺值"][i],`game.html?mode=pre&state=${s}`,mode==="pre"&&legit===s)).join("");
    root.innerHTML=`${base("設計預覽 / 單場研究")}
      <nav class="crumb"><a href="./">賽事入口</a><span>／</span><span>gamePk ${g.pk}</span></nav>
      <div class="mode-nav" aria-label="閱讀模式">${link("賽前研究","game.html?mode=pre",mode==="pre")}${link("賽後回看","game.html?mode=post",mode==="post")}</div>
      ${mode==="pre"?`<div class="state-controls"><span>版型狀態檢查</span><nav aria-label="賽前資料狀態">${stateLinks}</nav></div>`:""}
      ${test&&mode==="pre"?testNotice():""}
      <section class="match-hero"><div class="match-meta"><span>${newSeason&&mode==="pre"?"新季樣本版型測試":`2026 世界大賽・第 ${g.series.n} 戰`}</span><span>${dateLabel(g.twDate)} ${g.twTime} 台灣時間 / ${esc(g.venue)}</span></div>${heroTeams(mode==="post")}<p class="hero-caption">${mode==="post"?"賽後結果優先；下方仍能展開當時保存的賽前資料。":"先核對比賽、先發與打線，再看條件與細節。"}</p></section>
      ${mode==="post"?`${innings()}${pitchingPost()}<details class="pregame-archive"><summary><span>展開當時的賽前研究資料</span><small>賽前快照，未用賽後結果改寫</small></summary>${preBody()}</details>`:preBody()}
      <div class="end-note"><b>資料範圍</b><p>真實示例固定於 101 commit ${D.meta.snapshotCommit.slice(0,7)}，台灣日期 ${g.twDate}。條件卡為賽前保存版本；比分與投手實際使用來自獨立賽後資料。人工測試狀態只檢查版型，不代表歷史事實。</p></div>`;
  }
  function keepReadingPlace(){
    try{
      const prior=window.history.state&&typeof window.history.state==="object"?window.history.state:{};
      const id=prior.mlbPreviewEntry||String(Date.now())+"-"+Math.random().toString(36).slice(2);
      if(!prior.mlbPreviewEntry)window.history.replaceState({...prior,mlbPreviewEntry:id},"");
      const key="mlb-preview-reading:"+id;
      const details=()=>[...document.querySelectorAll("details")];
      const save=()=>window.sessionStorage.setItem(key,JSON.stringify({y:window.scrollY,open:details().flatMap((x,i)=>x.open?[i]:[])}));
      const raw=window.sessionStorage.getItem(key);
      if(raw){
        const saved=JSON.parse(raw);
        details().forEach((x,i)=>{x.open=Array.isArray(saved.open)&&saved.open.includes(i)});
        window.history.scrollRestoration="manual";
        window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>window.scrollTo(0,Number(saved.y)||0)));
      }
      window.addEventListener("pagehide",save);
      document.addEventListener("click",e=>{if(e.target.closest?.("a[href]"))save()},true);
    }catch(_){/* Storage can be unavailable; ordinary navigation still works. */}
  }
  if(pipelineTrial){
    document.querySelector(".mast-id").textContent="MLB / "+g.season+" 人工試跑";
    document.querySelector(".brand").href=flow?"index.html?trial=same-game":"index.html?trial=opening";
    document.querySelector(".site-foot").innerHTML='獨立分支試跑，2027 為人工輸入；正式 /live/、資料與排程未變。<a href="README.md">資料與版本說明</a>';
  }
  if(document.body.dataset.page==="home")renderHome();else renderGame();
  keepReadingPlace();
})();
