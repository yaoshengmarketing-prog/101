(function springReplay(){
  "use strict";
  const D=window.SPRING_PREVIEW_DATA, root=document.getElementById("app");
  if(!D||!root)return;
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const team=s=>D.game[s], t=s=>esc(team(s).ab);
  const lineup=s=>'<div class="lineup-panel"><div class="lineup-title"><h3>'+t(s)+' '+esc(team(s).name)+'</h3><span class="status-tag">賽後 boxscore 可辨原先發九棒</span></div><ol class="lineup-list spring-lineup">'+D.lineups[s].map(p=>'<li><span>'+p.n+'</span><strong>'+esc(p.name)+'</strong><em>'+esc(p.pos||"守位未取得")+'</em></li>').join("")+'</ol></div>';
  const pitchers=s=>'<div class="result-pitch"><h3>'+t(s)+' '+esc(team(s).name)+'</h3>'+D.pitchers[s].map(p=>'<div><span>'+esc(p.name)+'</span><strong>'+esc(p.ip??"?")+' 局・'+(Number.isFinite(p.pitches)?p.pitches+" 球":"? 球")+'</strong></div>').join("")+'</div>';
  const inning=i=>'<div class="inning"><b>'+i.n+' 局</b><span>'+t("away")+'　'+(i.away??"未取得")+'</span><span>'+t("home")+'　'+(i.home===null?"未打":i.home)+'</span></div>';
  root.innerHTML='<div class="source-ribbon"><span class="source-dot"></span><span>設計預覽／春訓單場</span><strong>完賽後回查的歷史資料</strong></div>'+
    '<nav class="crumb"><a href="./#spring-example">賽事入口</a><span>／</span><span>春訓・gamePk '+D.game.pk+'</span></nav>'+
    '<div class="spring-replay-notice"><b>2026 春訓・完賽後回查</b><span>此頁不是當時保存的賽前快照；先發與原先發九棒雖可由賽後資料辨識，當時賽前何時取得仍未驗證。</span></div>'+
    '<section class="match-hero"><div class="match-meta"><span>春訓 S・已完賽</span><span>美國賽程日 2026/3/24・台灣 3/25 05:10／'+esc(D.game.venue)+'</span></div>'+
    '<div class="match-header"><div class="club"><span class="club-code">'+t("away")+'</span><strong>'+esc(team("away").name)+'</strong><small>客隊</small></div><div class="versus"><span class="score">'+team("away").score+'<i>:</i>'+team("home").score+'</span><small>Final</small></div><div class="club home-club"><span class="club-code">'+t("home")+'</span><strong>'+esc(team("home").name)+'</strong><small>主隊</small></div></div>'+
    '<p class="hero-caption">賽後來源所列先發：'+esc(team("away").probableAfterFinal)+'／'+esc(team("home").probableAfterFinal)+'。這不是賽前公布時間的證據。</p></section>'+
    '<section class="primary-block"><div class="section-head"><h2>逐局比分</h2><span>MLB 官方完賽回查；未打的半局不填 0</span></div><div class="inning-grid">'+D.innings.map(inning).join("")+'</div></section>'+
    '<section class="primary-block"><div class="section-head"><h2>本場官方名單</h2><span>由完賽 boxscore 辨識原先發九棒；賽前取得時間未驗證</span></div><div class="lineup-grid">'+lineup("away")+lineup("home")+'</div></section>'+
    '<section class="primary-block"><div class="section-head"><h2>投手實際使用</h2><span>春訓 S・按球員列局數與用球</span></div><div class="result-grid">'+pitchers("away")+pitchers("home")+'</div><p class="lineup-foot">這場的春訓登板可作後續賽事的近期實際用量紀錄；不依出場順序推定固定牛棚角色，也不自動納入例行賽牛棚差距或連投門檻。</p></section>'+
    '<p class="spring-rule-note"><b>情境卡與名單增減：暫不判定。</b>春訓的賽別範圍與比較基準尚未定義，不顯示「未達門檻」。本場已取得的官方名單仍如上可讀。</p>'+
    '<div class="end-note"><b>資料與取得界線</b><p>固定 gamePk '+D.game.pk+'；'+esc(D.meta.status)+'。精簡資料於 '+esc(D.meta.retrievedAt)+' UTC 回查整理，來源為 MLB <a href="'+esc(D.meta.sources.schedule)+'">schedule／linescore</a> 與 <a href="'+esc(D.meta.sources.boxscore)+'">boxscore</a>。只保存此示例所需欄位；不代表 2027 賽前來源已驗證，也不進正式研究樣本。</p></div>';
})();
