(function previewApp(){
  "use strict";
  const D=window.PREVIEW_DATA, root=document.getElementById("app");
  const qs=new URLSearchParams(location.search);
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateLabel=s=>`${Number(s.slice(5,7))} 月 ${Number(s.slice(8,10))} 日`;
  const state=qs.get("state")||"official", mode=qs.get("mode")==="post"?"post":"pre";
  const legit=["official","projection","partial","new","small","official_empty","bp_missing"].includes(state)?state:"official";
  const test=legit!=="official";
  const newSeason=["new","small","official_empty"].includes(legit);
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
      <nav class="segment-tabs" aria-label="預覽情境">${link("賽事入口示例","./",!quiet)}${link("近期無賽", "?view=quiet",quiet)}</nav>
      ${quiet?`<section class="quiet-intro"><h2>目前沒有近期賽事</h2><p>人工情境測試：假設今天、明天和之後七天均無賽程。保留最近完賽入口，不推定球季已結束。</p></section>`:
      `<div class="test-notice"><b>歷史賽前閱讀示例</b><span>以已保存的 2026 賽前欄位重建頁面；不是當時整頁快照，也不是今天有賽事。</span></div><section class="list-heading"><h2>10 月 29 日</h2><span>世界大賽　1 場・台灣時間</span></section>
      <article class="game-row"><div class="game-time"><strong>08:00</strong><span>賽前回放</span><small>世界大賽 G5</small></div><div class="game-clubs"><div><b>${esc(g.away.ab)}</b><strong>${esc(g.away.name)}</strong><span>客</span></div><div><b>${esc(g.home.ab)}</b><strong>${esc(g.home.name)}</strong><span>主</span></div></div><div class="game-essential"><span>先發</span><p>${esc(g.away.sp.name)}<br>${esc(g.home.sp.name)}</p><small>雙方官方打線已存・當時版本</small></div><div class="game-action"><a href="${homeLink}" class="action-link">看單場研究 <span aria-hidden="true">↗</span></a><a href="game.html?mode=post" class="text-link">直接看賽後</a></div></article>`}
      <section class="recent-section"><div class="section-head"><h2>最近完賽</h2><span>固定快照中的 10 場・日期與比分</span></div><ul class="recent-list">${recent}</ul></section>
      <p class="page-note">本草案的單場研究示例為 gamePk ${g.pk}。其他完賽列連到既有 /live/ 資料頁，用於檢查回看入口。</p>`;
  }
  function testNotice(){
    const title={projection:"預估打線狀態測試",partial:"部分未取得狀態測試",new:"新一季零樣本狀態測試",small:"開季少樣本狀態測試",official_empty:"官方九棒已公布／本季無成績狀態測試",bp_missing:"牛棚部分用球未取得狀態測試"}[legit];
    const desc={projection:"以人工測試球員示範第三方預估的版面；不是任何來源的真實預估。",partial:"模擬主隊官方打線尚未取得；未取得不填 0，也不沿用作本場官方。",new:"借用這場對戰名稱測試新季空值呈現；不代表 2027 賽程或統計。",small:"人工示範開季少量局數與打席；數字不是 2027 真實成績，也不新增統計門檻。",official_empty:"人工假設官方九棒已公布，但本季打者與投手都尚無例行賽成績；名單姓名不是 2027 真實公告。",bp_missing:"人工假設釀酒人 10/27 的 DL Hall 用球未取得；其他賽事、打線及對位沿用 2026 固定資料，不是真實來源缺漏。"}[legit];
    return `<div class="test-notice" role="status"><b>人工測試資料：${title}</b><span>${desc} 此狀態不進正式資料或研究樣本。</span></div>`;
  }
  function pitcherRow(){
    const t=(team,side)=>{
      const sample=D.testOnly.small.pitchers[side];
      const stats=legit==="small"?`<div class="pitcher-metrics"><span>ERA <b>${sample.era}</b></span><span>WHIP <b>${sample.whip}</b></span><span>IP <b>${sample.ip}</b></span></div><small>2027 例行賽・人工測試：${sample.er} 自責分／${sample.outs} 出局；${sample.h} 安＋${sample.bb} 保送。樣本少，不下高低結論。</small>`:newSeason?`<div class="sample-message"><b>2027 例行賽確定尚無出賽</b><span>ERA、WHIP 尚無計算基礎；不填 0。</span></div><p class="last-season-line">上季參考｜2026 例行賽：ERA ${team.sp.era}、WHIP ${team.sp.whip}，${team.sp.ip} 局。非 2027 成績。</p>`:`<div class="pitcher-metrics"><span>ERA <b>${team.sp.era}</b></span><span>WHIP <b>${team.sp.whip}</b></span><span>IP <b>${team.sp.ip}</b></span></div><small>2026 大聯盟例行賽・${team.sp.gs} 場先發</small>`;
      const pair=D.matchup.find(x=>x.pitcherSide===side);
      const research=newSeason?`<p>2027 本季最近先發與對左右打分項未取得；不挪用 2026 紀錄。</p>`:`<p>2026 例行賽對左打 OPS ${esc(pair.splits.vl?.ops??"?")}（${esc(pair.splits.vl?.pa??"?")} 打席）；對右打 OPS ${esc(pair.splits.vr?.ops??"?")}（${esc(pair.splits.vr?.pa??"?")} 打席）。</p><ol class="recent-starts">${pair.recent.map(x=>`<li><b>${esc(x.date)}</b><span>${esc(x.ha)}對${esc(x.opp)}・${({D:"分區賽",L:"聯盟冠軍賽",W:"世界大賽",R:"例行賽"}[x.gameType]||esc(x.gameType))}</span><span>${esc(x.ip)} 局／${esc(x.np)} 球／${esc(x.er)} 自責</span></li>`).join("")}</ol><small>最近三次先發包含季後賽，賽別逐筆標示；上方手別分項只取 2026 例行賽。</small>`;
      return `<div class="pitcher"><span class="pitcher-label">${esc(team.ab)} 預計先發</span><strong>${esc(team.sp.name)}</strong><span>${team.sp.hand==="R"?"右投":"左投"}</span>${stats}<details class="pitcher-research"><summary>對左右打與最近三次先發</summary>${research}</details>${newSeason?`<details class="last-season"><summary>展開上季完整資料</summary><p>2026 例行賽固定快照：ERA ${team.sp.era}、WHIP ${team.sp.whip}、${team.sp.ip} 局／${team.sp.gs} 先發。這不是 2027 成績。</p></details>`:""}</div>`;
    };
    return `<section class="primary-block"><div class="section-head"><h2>先發投手</h2><span>客隊在左・主隊在右</span></div><div class="pitcher-grid">${t(g.away,"away")}${t(g.home,"home")}</div></section>`;
  }
  function lineupFor(team,side){
    const missing=legit==="new"||(legit==="partial"&&side==="home");
    const projected=legit==="projection"&&side==="home";
    const synthetic=newSeason||projected;
    if(missing)return `<div class="lineup-panel"><div class="lineup-title"><h3>${esc(team.ab)} ${esc(team.name)}</h3><span class="status-tag muted">本場打線未取得</span></div><p class="empty-copy">本場沒有可確認的 1–9 棒；此狀態不影響其他區塊。上一場打線不可充當本場官方名單。</p></div>`;
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
    const source=synthetic?"人工測試名單；沒有宣稱 2027 官方真的公布。":`2026 MLB 官方九棒；本站首次取得 ${esc(team.lineup.firstSeen)}。來源發布時刻未取得，不以本站時間代替。`;
    const more=legit==="small"?`<p>人工小樣本第一棒：${side==="away"?"OPS .762 = OBP .429（2 安＋1 保送／7）＋SLG .333（2 壘打／6 打數）":"OPS .788 = OBP .333（3 安＋1 保送／12）＋SLG .455（5 壘打／11 打數）"}；只列數值和分母，不下高低結論。</p>${side==="away"?"<p>第二棒 OPS .000：5 打席、5 打數、0 安、0 保送、0 壘打，是有效的 0，不是未取得。</p>":""}`:legit==="official_empty"?"<p>本季確定尚無出賽與打席，OPS 尚無計算基礎；不填 0。春訓另列。</p>":projected?"<p>人工預估示例沒有真實球員成績。</p>":`<p>2026 例行賽 AVG／OPS：${slots.map(x=>`${esc(x.name)} ${esc(x.avg)} / ${esc(x.ops)}`).join("；")}。</p>`;
    return `<div class="lineup-panel"><div class="lineup-title"><h3>${esc(team.ab)} ${esc(team.name)}</h3><span class="status-tag ${synthetic?"projected":"confirmed"}">${status}</span></div><ol class="lineup-list">${slots.map(row).join("")}</ol><p class="lineup-foot">${newSeason?"2027 例行賽版型測試；人工名單和人工成績不進正式資料。":projected?"這組預估姓名是人工測試，不是第三方來源內容。":"對本場先發手別 OPS／打席取 2026 例行賽；不是兩人直接對戰。"}</p><details class="lineup-more"><summary>整體成績與計算基礎</summary>${more}</details><details class="lineup-more"><summary>來源與預估對照</summary><p>${source}</p><p>預估／第三方確認／MLB 官方／臨場異動各自保留狀態；逐棒來源比對在本預覽待補，既有 /live/ 已接入。</p></details><details class="lineup-more"><summary>上一場打線參考</summary><p>既有 /live/ 已接入上一場打線；本預覽待補逐棒畫面。上一場名單不充當本場官方九棒。</p></details></div>`;
  }
  function contextSection(){
    if(test&&legit!=="bp_missing")return `<section class="context-block"><div class="section-head"><h2>值得一起看的條件</h2><span>固定規則產生的事實提示</span></div><div class="empty-copy inset">此測試狀態未用真實輸入重算情境卡，因此不顯示條件判斷。</div></section>`;
    return `<section class="context-block"><div class="section-head"><h2>值得一起看的條件</h2><span>成立 ${D.context.length} 項・只列事實</span></div><div class="context-list">${D.context.map(x=>`<div class="context-row"><div><span class="context-rule">${esc(x.title)}</span><strong>${esc(x.value)}</strong></div><details><summary>依據與歷史例子</summary><p>${esc(x.threshold)}</p><p>${esc(x.says?.[0]||"")}</p><p>本站同規則、同門檻且賽後完整的案例：${x.similar?.n??0} 場（例行賽 ${x.similar?.byType?.R??0}、季後賽 ${x.similar?.byType?.post??0}）。只列案例，不換算勝率。</p></details></div>`).join("")}</div></section>`;
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
        return `<div class="bp-player"><div><strong>${esc(p.name)}</strong><small>前三日 ${hasMissing?"已知 ":""}${n} 球${hasMissing?"・部分未取得":""}${p.streak>=2?`・連 ${p.streak} 日登板`:""}</small></div><div class="bp-day-grid">${dates.map(date=>`<span><small>${dateLabel(date)}</small><b>${cell(p,date)}</b></span>`).join("")}</div></div>`;
      };
      return `<div class="bp-team"><h3>${esc(team.ab)} ${esc(team.name)}</h3><p class="bp-summary">${amount}；主要承擔者：${leaders.map(p=>`${esc(p.name)} ${playerKnown(p)} 球`).join("、")}。這是用量紀錄，不推論今天可否登板。</p><div class="bp-calendar">${days.map(day).join("")}</div><details class="bp-details"><summary>展開逐投手用球（${pitchers.length} 人）</summary>${pitchers.map(player).join("")}<p class="lineup-foot">無賽程＝確定沒比賽；—＝確定沒登板；0 球＝有效 0；?＝未取得。有缺值時僅顯示已取得部分小計。</p></details></div>`;
    };
    return `<div class="bp-grid">${box("away",g.away)}${box("home",g.home)}</div>`;
  }
  function bullpenSection(){
    return `<section class="primary-block bullpen-section"><div class="section-head"><h2>牛棚近期使用</h2><span>美國賽程日：前三個完整日 10/25–10/27；本日 10/28 另列</span></div>${newSeason?`<div class="empty-copy inset">本測試情境未提供 2027 本場牛棚資料：前 3 個完整日、本日與逐投手用球均標「未取得」，不沿用 2026 當作新季數字。<details class="bp-reference"><summary>查看 2026 固定案例（非 2027）</summary>${bullpenHistorical()}</details></div>`:bullpenHistorical()}</section>`;
  }
  function deepSection(){
    const weather=newSeason?"本場 2027 天氣未取得；此人工情境不拿 2026 固定場次天氣冒充。":`${esc(g.venue)}：${esc(D.weather.condition)}；${esc(D.weather.tempF)}°F；風 ${esc(D.weather.wind)}。此場為 Dome，不解讀風向優勢。`;
    const roster=newSeason?"此人工新季情境未提供球員名單異動；標為未取得，不能把舊季零異動當新季現況。":`2026 固定場次：${["away","home"].map(s=>`${esc(g[s].ab)}：${D.roster[s].changes.length?D.roster[s].changes.map(x=>esc(x.name)+" 有近期傷兵回歸紀錄").join("；"):"沒有列出第一層新增／減少人物"}（基準 ${esc(D.roster[s].basis)}）`).join("；")}`;
    const similar=newSeason?"2027 尚無此人工情境的可比較賽前樣本；歷史案例須分賽季、賽別、規則版本及門檻查詢。案例列版型預覽待補。":test&&legit!=="bp_missing"?"人工名單沒有重新計算相似情境；既有 2026 案例不當作本測試樣本。案例列版型預覽待補。":"同規則版本、同門檻、賽前樣本且賽後完整，才列入相似紀錄。上方每項條件可展開看已存案例數；完整案例列版型預覽待補。";
    return `<section class="deep-section"><div class="section-head"><h2>再往下查</h2><span>各區塊按自身資料狀態呈現</span></div><div class="deep-list"><details><summary><span>球場天氣</span><small>${newSeason?"本場未取得":"2026 固定場次官方資料"}</small></summary><div class="deep-item"><p>${weather}</p></div></details><details><summary><span>名單變動</span><small>${newSeason?"本場未取得":"與合理名單基準比較"}</small></summary><div class="deep-item"><p>${roster}</p></div></details><details><summary><span>歷史相似情境</span><small>案例列舉，不算機率</small></summary><div class="deep-item"><p>${similar}</p></div></details></div></section>`;
  }
  function comparison(){
    const next=newSeason;
    const row=(left,label,right,note="")=>`<div class="compare-row"><strong>${esc(left)}</strong><span>${esc(label)}${note?`<small>${esc(note)}</small>`:""}</span><strong>${esc(right)}</strong></div>`;
    return `<section class="comparison primary-block"><div class="section-head"><h2>比賽總覽</h2><span>客隊　｜　項目　｜　主隊</span></div><div class="compare-table"><div class="compare-team"><b>${esc(g.away.ab)} ${esc(g.away.name)}</b><span>客｜主</span><b>${esc(g.home.ab)} ${esc(g.home.name)}</b></div>${next?row(legit==="small"?"未取得":"尚無","2027 例行賽戰績",legit==="small"?"未取得":"尚無",legit==="small"?"未提供戰績測試值，不填 0":"尚未開打，不填 0")+row(legit==="small"?"3.2 局":"尚無","本季先發局數",legit==="small"?"8.0 局":"尚無",legit==="small"?"人工測試・局數少，先看分母":"沒有本季先發紀錄"):row(g.away.rec,"2026 例行賽戰績",g.home.rec)+row(g.away.l10,"近十場",g.home.l10)+row(g.away.sp.era,"先發 ERA",g.home.sp.era,"2026 例行賽")}</div>${next?`<details class="season-reference"><summary>查看上一季資料（參考，與新季分開）</summary><div class="compare-table">${row(g.away.rec,"2026 例行賽戰績",g.home.rec)+row(g.away.sp.whip,"2026 先發 WHIP",g.home.sp.whip)}</div><p>此處為 2026 固定快照；不能當成 2027 本季數字。</p></details><p class="season-scope">春訓另列，不併入例行賽；此草案沒有匯入春訓數據。</p>`:""}</section>`;
  }
  function preBody(){
    return `${comparison()}${pitcherRow()}<section class="primary-block"><div class="section-head"><h2>本場打線</h2><span>${legit==="new"?"新季狀態示意":legit==="projection"?"一隊官方、一隊人工預估測試":legit==="partial"?"一隊官方、一隊未取得":legit==="small"?"人工少樣本示意":legit==="official_empty"?"人工官方九棒情境・本季無成績":"雙方 MLB 官方已確認"}</span></div><div class="lineup-grid">${lineupFor(g.away,"away")}${lineupFor(g.home,"home")}</div></section>${contextSection()}${bullpenSection()}${deepSection()}`;
  }
  function innings(){
    return `<section class="primary-block"><div class="section-head"><h2>逐局比分</h2><span>MLB 官方賽後資料・完整</span></div><div class="inning-grid">${D.post.innings.map(i=>`<div class="inning"><b>${i.n} 局</b><span>${esc(g.away.ab)}　${i.away}</span><span>${esc(g.home.ab)}　${i.home}</span></div>`).join("")}</div></section>`;
  }
  function pitchingPost(){
    const box=(s,t)=>{const p=D.post.pitching[s];return `<div class="result-pitch"><h3>${esc(t.ab)} ${esc(t.name)}</h3><div><span>先發 ${esc(p.sp.name)}</span><strong>${fmtOut(p.sp.outs)} 局 / ${p.sp.pitches} 球</strong></div><div><span>牛棚 ${p.rp.apps} 人次</span><strong>${fmtOut(p.rp.outs)} 局 / ${p.rp.pitches} 球</strong></div></div>`};
    return `<section class="primary-block"><div class="section-head"><h2>實際投手使用</h2><span>與賽前預計分開保存</span></div><div class="result-grid">${box("away",g.away)}${box("home",g.home)}</div></section>`;
  }
  function renderGame(){
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
  if(document.body.dataset.page==="home")renderHome();else renderGame();
})();
