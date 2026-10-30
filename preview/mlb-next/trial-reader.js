/* Branch-only adapter: existing preview shells read program-generated trial-data.js when ?trial= is present. */
(function trialReader(){
  "use strict";
  const qs = new URLSearchParams(location.search);
  if (!qs.has("trial")) return;
  const D = window.MLB_CROSS_SEASON_TRIAL, root = document.getElementById("app");
  const key = qs.get("trial") || "opening";
  const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const gt = x => ({"R":"例行賽","S":"春訓","F":"世界大賽","D":"分區系列賽","L":"聯盟冠軍賽","W":"外卡系列賽"}[x] || "賽別未確認");
  const readState = x => x === "no_record" ? "本季尚無紀錄" : x === "stale" ? "舊值（見取得時間）" : x === "value" ? "已取得" : "未取得";
  const link = (id, text) => `<a href="game.html?trial=${encodeURIComponent(id)}">${esc(text)} <span aria-hidden="true">↗</span></a>`;
  if (!D || !root) { if (root) root.textContent = "試跑資料未取得。"; return; }
  document.querySelector(".mast-id").textContent = "MLB / 跨季離線試跑";
  document.querySelector(".brand").href = "index.html?trial=opening";
  document.querySelector(".site-foot").innerHTML = "獨立分支試跑：2027 為人工輸入，2026 春訓為完賽後回查；沒有修改正式資料。<a href=\"README.md\">資料與限制</a>";
  const ribbon = `<div class="source-ribbon"><span class="source-dot"></span><span>下季接入試跑 · 程式產出的固定測試檔</span><strong>2027 人工案例／2026 歷史回查，非即時資料</strong></div>`;
  const title = `<div class="page-title"><div><p class="overline">MLB / DATA TRIAL</p><h1>跨季資料接入試跑</h1></div><p>沿用第一版閱讀草案。這裡只展示實際建置、牛棚、情境與名單程式的輸出。</p></div>`;
  const nav = `<div class="state-controls"><span>試跑案例</span><nav>${[["opening","開幕零樣本"],["transition","春訓銜接"],["r_off_day","例行賽休兵日"],["partial_failure","部分取數失敗"],["spring","2026 春訓回查"]].map(([k,n]) => `<a href="game.html?trial=${k}" ${key===k?'aria-current="page"':""}>${n}</a>`).join("")}</nav></div>`;
  const opening = D.opening.game;
  const rows = [
    ["opening", opening.usDate, "2027 例行賽開幕", "官方九棒、尚無本季成績、無合理名單比較基準"],
    ["transition", D.cases.transition.game.usDate, "春訓銜接視窗", "近期 S 登板保留；牛棚兩條情境暫不判定"],
    ["r_off_day", D.cases.r_off_day.game.usDate, "例行賽休兵日", "前三個完整美國賽程日含已確認無賽程"],
    ["partial_failure", D.cases.partial_failure.game.usDate, "部分取數失敗", "部分小計可讀，不能當完整門檻輸入"],
    ["spring", D.historicalSpring.game.usDate, "2026 春訓完賽回查", "真實歷史資料；不是當時賽前快照"]
  ];
  if (document.body.dataset.page === "home") {
    root.innerHTML = ribbon + title + `<p class="trial-alert">${esc(D.meta.warning)}</p>` +
      rows.map(([k,date,name,desc]) => `<article class="game-row"><div class="game-time"><strong>${esc(date.slice(5))}</strong><span>${k==="spring"?"2026 春訓":"2027 人工測試"}</span></div><div class="game-clubs"><div><b>CIN</b><strong>紅人</strong></div><div><b>MIL</b><strong>釀酒人</strong></div></div><div class="game-essential"><span>${esc(name)}</span><p>${esc(desc)}</p></div><div class="game-action"><span class="action-link">${link(k,"查看單場")}</span></div></article>`).join("");
    return;
  }
  const lineup = (side,label) => {
    const t=opening[side], slots=t.lineup?.slots || [];
    return `<section class="trial-panel"><div class="lineup-title"><h3>${label} · 官方九棒</h3><span class="status-tag confirmed">${esc(t.lineup.state)}</span></div><ol class="lineup-list">${slots.map(p=>`<li><span>${p.n}</span><strong>${esc(p.name)}</strong><em>${esc(p.pos)}</em><small>${p.ops==null ? readState(p.statStatus) : `OPS ${esc(p.ops)}`}</small></li>`).join("")}</ol><p class="lineup-foot">本季 2027 例行賽；人工來源輸入。球員與數值不代表真實 2027 名單。</p></section>`;
  };
  const section = (head,body) => `<section class="trial-panel"><h2>${esc(head)}</h2>${body}</section>`;
  if (key === "spring") {
    const s = D.historicalSpring;
    root.innerHTML = ribbon + title + nav + `<p class="trial-alert">完賽後回查的歷史資料；無法證明賽前何時取得。</p>` +
      `<div class="match-hero"><div class="match-meta"><span>春訓 · ${esc(s.game.usDate)}</span><span>gamePk ${s.game.pk}</span></div><div class="match-header"><div class="club"><b class="club-code">CIN</b><strong>紅人</strong></div><div class="versus"><span class="score">${s.game.away.score}<i>:</i>${s.game.home.score}</span><small>完賽</small></div><div class="club home-club"><b class="club-code">MIL</b><strong>釀酒人</strong></div></div></div>` +
      section("投手實際使用",["away","home"].map(side=>`<h3>${side==="away"?"紅人":"釀酒人"}</h3><div class="trial-table">${(s.pitchers[side]||[]).map(p=>`<div><strong>${esc(p.name)}</strong><span>${esc(p.ip)} 局</span><span>${p.pitches==null?"球數未取得":esc(p.pitches)+" 球"}</span></div>`).join("")}</div>`).join("") +
      `<p>春訓情境與名單增減：暫不判定。2027 賽前來源時機未驗證。</p>`) +
      `<p class="trial-back"><a href="index.html?trial=opening">← 回試跑入口</a></p>`;
    return;
  }
  const c = D.cases[key];
  if (!c && key !== "opening") { root.textContent="找不到這個試跑案例。"; return; }
  const date = key === "opening" ? opening.usDate : c.game.usDate;
  const heading = key === "opening" ? "開幕零樣本" : key === "transition" ? "春訓銜接" : key === "r_off_day" ? "例行賽休兵日" : "部分取數失敗";
  let body = `<div class="match-hero"><div class="match-meta"><span>${gt("R")} · ${esc(date)}</span><span>${esc(heading)} · 人工測試</span></div><div class="match-header"><div class="club"><b class="club-code">CIN</b><strong>紅人</strong></div><div class="versus"><span class="at">@</span><small>賽前</small></div><div class="club home-club"><b class="club-code">MIL</b><strong>釀酒人</strong></div></div><p class="hero-caption">這一頁是固定的程式試跑輸出，並非 2027 真實賽事。</p></div>`;
  if (key === "opening") {
    body += section("先發與本季成績",`<div class="trial-columns">${["away","home"].map(side=>{const t=opening[side],p=t.sp;return `<div><h3>${side==="away"?"紅人":"釀酒人"} · ${esc(p.name)}</h3><p>2027 例行賽 ERA／WHIP：${readState(p.statStatus)}</p><p>球隊戰績：${esc(t.rec)}（已確認出賽 ${t.gp} 場）</p><p>團隊 OPS／ERA：${readState(t.statStatus.ops)}／${readState(t.statStatus.era)}</p></div>`}).join("")}</div><p>上季參考維持獨立；本試跑未載入，不填入本季欄位。春訓成績不混入例行賽。</p>`);
    body += section("本場名單與打線",`<div class="trial-columns">${lineup("away","紅人")}${lineup("home","釀酒人")}</div><p>上一場打線是春訓參考（${esc(opening.away.prev.date)}，${gt(opening.away.prev.gameType)}）；名單增減沒有合理的同季同賽別基準，因此暫不比較。已取得本場名單 ${D.opening.roster.listed.length} 人，不報增減 0。</p>`);
    const S=D.opening.smallStats;
    body += section("少樣本與有效 0：另一組人工來源回應",`<details><summary>展開 2027 R 的少樣本變體（與上方零樣本輸入分開）</summary><p>測試先發 A：ERA ${esc(S.pitcherR.s.era)}、WHIP ${esc(S.pitcherR.s.whip)}／${esc(S.pitcherR.s.ip)} 局。測試先發 B 只有 S 資料，R 仍顯示本季尚無紀錄。</p><p>${esc(S.hitterR[0].name)}：OPS ${esc(S.hitterR[0].ops)}／${S.hitterR[0].pa} 打席；${esc(S.hitterR[1].name)} 只有 S 資料，R 尚無紀錄；${esc(S.hitterR[2].name)}：OPS ${esc(S.hitterR[2].ops)}／${S.hitterR[2].pa} 打席，這是有分母的有效 0。</p><p>團隊 OPS ${esc(S.teamR.ops)}、ERA ${esc(S.teamR.era)}／已賽 ${S.teamR.gp} 場。所有數值均為人工測試，沒有混用春訓。</p></details>`);
  } else {
    const B=c.bullpen;
    body += section("前三個完整美國賽程日與本日", `<p>視窗：${B.window.full.map(esc).join("、")}；本日 ${esc(B.window.today)} 另列。資料狀態：${esc(B.status)}。</p>` +
      `<div class="trial-columns">${["away","home"].map(side=>`<div><h3>${side==="away"?"紅人":"釀酒人"}</h3><div class="trial-table">${B.summary[side].days.map(d=>`<div><strong>${esc(d.d)}</strong><span>${d.st==="off"?"確認無賽程":d.st==="played"?"已完賽":d.st==="error"?"資料未取得":esc(d.st)}</span><span>${d.st==="off"?"不適用":d.rpPitches==null?"球數未取得":d.st==="played"?esc(d.rpPitches)+" 球":"已取得 "+esc(d.rpPitches)+" 球"}</span></div>`).join("")}</div></div>`).join("")}</div>`);
    body += section("近期實際登板與用量",`<p>逐筆保留 S／R 賽別；出場順序不推定固定牛棚角色。缺球數標示未取得。</p><div class="trial-columns">${["away","home"].map(side=>`<div><h3>${side==="away"?"紅人":"釀酒人"}</h3><div class="trial-table">${B.summary[side].recentUsage.map(p=>`<div><strong>${esc(p.name)}</strong><span>${esc(p.day)} ${gt(p.gameType)}</span><span>${esc(p.ip??"?")} 局／${p.pitches==null?"球數未取得":esc(p.pitches)+" 球"}</span></div>`).join("")}</div></div>`).join("")}</div>`);
    body += section("既有牛棚情境輸入", `<div class="trial-columns">${[c.context.bp_load,c.context.bp_streak].map(x=>`<div><h3>${esc(x.title)}</h3><p>${x.state==="na"?"暫不判定":x.state==="hit"?"符合門檻":"未達門檻"}</p><p>${esc(x.why || x.value || "")}</p></div>`).join("")}</div><p>規則版本和門檻保持原值；春訓登板只作閱讀，不混入例行賽牛棚差距或連投計算。</p>`);
  }
  root.innerHTML = ribbon + title + nav + `<p class="trial-alert">${esc(D.meta.warning)}</p>` + body + `<p class="trial-back"><a href="index.html?trial=opening">← 回試跑入口</a></p>`;
})();
