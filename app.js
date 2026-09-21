/* 運彩 101 原型：純前端渲染，資料來自 assets/data.js */
const D = window.DATA;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hand = h => h === "L" ? "左投" : h === "R" ? "右投" : "";
const NA = '<span class="tag na">資料不足</span>';
const STATUS = { pre: "賽前", live: "進行中", final: "已結束" };
/* V1.2 打線狀態：none＝尚未完整、partial＝尚未完整、estimate＝預估已建立、official＝官方確認、late＝臨場異動 */
const LU = { none: ["預估打線尚未完整", "na"], partial: ["預估打線尚未完整", "na"], estimate: ["預估打線已建立", "exp"], official: ["官方打線已確認", "ok"], late: ["臨場異動", "late"] };
const luTag = k => { const [t, c] = LU[k] || LU.none; return `<span class="tag ${c}">${t}</span>`; };

/* ================= 首頁 ================= */
function renderHome() {
  const state = { day: "today", status: "all", sport: "MLB" };
  const sportsEl = $("#sports"), dayEl = $("#days"), statusEl = $("#status"), listEl = $("#games"), h1 = $("#dayTitle");

  sportsEl.innerHTML = D.meta.sports.map(s => `<button aria-pressed="${s === state.sport}" data-s="${s}">${s}</button>`).join("");
  dayEl.innerHTML = D.days.map(d => `<button aria-pressed="${d.key === state.day}" data-d="${d.key}">${d.label}</button>`).join("");
  statusEl.innerHTML = [["all", "全部"], ["pre", "賽前"], ["live", "進行中"], ["final", "已結束"]].map(([k, v]) => `<button aria-pressed="${k === state.status}" data-st="${k}">${v}</button>`).join("");

  function draw() {
    const day = D.days.find(d => d.key === state.day);
    const games = day.games.filter(g => state.status === "all" || g.status === state.status);
    h1.innerHTML = `${day.date} ${state.sport} 本日比賽 <small>${games.length} 場・${D.meta.tz}</small>`;
    if (state.sport !== "MLB") { listEl.innerHTML = `<div class="empty">本輪原型只完成 MLB。${state.sport} 將使用相同卡片結構。</div>`; return; }
    if (!games.length) { listEl.innerHTML = `<div class="empty">此篩選條件下沒有比賽。</div>`; return; }
    const all = day.games, n = all.length;
    const cnt = f => all.filter(f).length;
    const summary = state.day === "yesterday" ? "" : `<div class="ready"><b>資料完成度</b>
      <span>預計先發 <b class="num">${cnt(g => g.away.sp && g.home.sp)}/${n}</b></span>
      <span>預估打線 <b class="num">${cnt(g => ["estimate", "official", "late"].includes(g.lineup))}/${n}</b></span>
      <span>盤口 <b class="num">${cnt(g => g.odds)}/${n}</b>${cnt(g => g.odds) ? ' <i class="tag demo-tag">示範</i>' : ""}</span>
      <span>天氣 <b class="num">${cnt(g => g.weather)}/${n}</b></span>
      <small>快照 ${D.meta.snapshotAt}</small></div>`;
    listEl.innerHTML = summary + games.map(cardHTML).join("");
  }
  function cardHTML(g) {
    const isFinal = g.status === "final";
    const team = (t, isHome) => `<div class="trow">
      <span class="logo" aria-hidden="true">${t.ab}</span>
      <span class="tname">${esc(t.name)}<em class="num">${t.rec}</em>${isFinal ? `<span class="score">${t.score}</span>` : ""}</span>
      <span class="sp">${t.sp ? `<b>${esc(t.sp.name)}</b>${hand(t.sp.hand)}${t.sp.wl ? ` <span class="num">${t.sp.wl}・${t.sp.era}</span>` : " <span class='tag na'>本季無成績</span>"}` : `<span class="tag na">先發未公布</span>`}</span>
    </div>`;
    const odds = g.odds ? `<div class="odds">
      <div>不讓分<b class="num">${g.away.ab} ${g.odds.ml[0]}</b><b class="num">${g.home.ab} ${g.odds.ml[1]}</b></div>
      <div>讓分<b class="num">${g.away.ab} ${g.odds.rl[0]}</b><b class="num">${g.home.ab} ${g.odds.rl[1]}</b></div>
      <div>大小 ${g.odds.ou[0]}<b class="num">大 ${g.odds.ou[1]}</b><b class="num">小 ${g.odds.ou[2]}</b></div>
    </div>` : `<div class="small">盤口：${isFinal ? "已結束" : "尚未開盤"}</div>`;
    const lineup = isFinal ? "" : luTag(g.lineup);
    const hints = (g.hints || []).map(h => `<span class="tag">${esc(h)}</span>`).join("");
    const note = g.note ? `<span class="tag">${esc(g.note)}</span>` : "";
    return `<article class="card">
      <div class="meta"><span><b>${g.time}</b> ${note}</span><span>${STATUS[g.status]}${g.odds ? ' <span class="tag demo-tag">盤口示範</span>' : ""}</span></div>
      ${team(g.away)}${team(g.home)}
      ${odds}
      <div class="hints">${lineup}${hints}</div>
      <div class="cta"><span class="small">${esc(g.venue)}</span>${g.hasPage ? `<a class="btn" href="game.html?pk=${g.pk}">查看比賽資料 →</a>` : `<span class="btn ghost">原型未建此場</span>`}</div>
    </article>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("button[data-s],button[data-d],button[data-st]"); if (!b) return;
    if (b.dataset.s) { state.sport = b.dataset.s; [...sportsEl.children].forEach(x => x.setAttribute("aria-pressed", x === b)); }
    if (b.dataset.d) { state.day = b.dataset.d; [...dayEl.children].forEach(x => x.setAttribute("aria-pressed", x === b)); }
    if (b.dataset.st) { state.status = b.dataset.st; [...statusEl.children].forEach(x => x.setAttribute("aria-pressed", x === b)); }
    draw();
  });
  draw();
}

/* ================= 單場頁 ================= */
function renderGame() {
  const pk = new URLSearchParams(location.search).get("pk") || Object.keys(D.games)[0];
  const G = D.games[pk];
  const root = $("#game");
  if (!G) { $("#hero").innerHTML = `<div class="empty">原型尚未建立 gamePk ${esc(pk)} 的資料頁。</div>`; root.innerHTML = ""; return; }
  const A = G.away, H = G.home;
  document.title = `運彩 101｜${A.name.slice(-2)} @ ${H.name.slice(-2)} 比賽資料`;
  $("#crumb").innerHTML = `<a href="index.html">← 本日比賽</a>　${G.sport}　${G.dateLabel}`;
  $("#hero").innerHTML = `
    <div class="vs">
      <div><div class="ab">${A.ab}</div><div class="nm">${esc(A.name)}</div><div class="rc num">${A.rec}・客隊</div></div>
      <div class="at">@</div>
      <div><div class="ab">${H.ab}</div><div class="nm">${esc(H.name)}</div><div class="rc num">${H.rec}・主隊</div></div>
    </div>
    <div class="facts">
      <span>開賽 <b class="num">${G.time}</b> 台灣時間</span>
      <span>球場 <b>${esc(G.venue)}</b></span>
      <span>狀態 <b>${G.status}</b></span>
      <span>預計先發 <b>${esc(A.sp.name)}（${hand(A.sp.hand)}）</b> vs <b>${esc(H.sp.name)}（${hand(H.sp.hand)}）</b></span>
      <span>打線 ${luTag(G.lineup)}</span>
      <span>距開賽 <b class="num" id="countdown">—</b></span>
      <span>最後更新 <b class="num">${G.updatedAt}</b></span>
    </div>`;
  const tick = () => { const el = $("#countdown"); if (!el || !G.startISO) return; const ms = new Date(G.startISO) - Date.now();
    el.textContent = ms <= 0 ? "已開賽" : `${Math.floor(ms / 36e5)} 小時 ${String(Math.floor(ms % 36e5 / 6e4)).padStart(2, "0")} 分`; };
  tick(); setInterval(tick, 30000);
  const v = x => x == null ? `<span class="v na">資料不足</span>` : `<span class="v">${x}</span>`;
  const row = (k, a, h, sub) => `<div class="r">${v(a)}<span class="k">${k}${sub ? `<i>${sub}</i>` : ""}</span>${v(h)}</div>`;
  const headBase = `<div class="r h"><span>${A.ab} ${A.name}</span><span class="k">客｜主</span><span>${H.ab} ${H.name}</span></div>`;
  const head = headBase;
  const rpg = t => (t.rs / t.gp).toFixed(2), rapg = t => (t.ra / t.gp).toFixed(2);

  /* 1. 總覽 */
  const overview = `<section class="blk" id="overview"><h2>比賽快速總覽 <small>本季至 9/21</small></h2>
    <div class="panel cmp">${head}
      ${row("本季戰績", A.rec, H.rec, `勝率 ${A.pct}｜${H.pct}`)}
      ${row("今日主客場條件", A.road, H.home, `${A.ab} 客場戰績｜${H.ab} 主場戰績`)}
      ${row("近十場", A.l10, H.l10)}
      ${row("平均得分", rpg(A), rpg(H), `${A.rs}／${H.rs} 分 ÷ ${A.gp} 場`)}
      ${row("平均失分", rapg(A), rapg(H), `${A.ra}／${H.ra} 分 ÷ ${A.gp} 場`)}
      ${row("團隊 OPS", A.ops, H.ops, "OPS＝上壘率＋長打率")}
      ${row("牛棚 ERA", A.bpEra, H.bpEra, "ERA＝防禦率（每 9 局自責分）")}
    </div></section>`;

  /* 1b. 前五局：全部資料不足 → 收合提示，不進導覽 */
  const first5 = `<details class="panel na-blk" id="f5"><summary class="small">前五局（F5）：本場資料不足，點開看原因</summary>
    <p class="small" style="margin:8px 0 0">前五局戰績、前五局平均得失分需逐場逐局比分統計；先發平均局數則因雙方先發本季無大聯盟樣本而無法計算。依規則不填示範值。</p></details>`;

  /* 2. 先發投手 */
  const pitcher = (t, side) => { const p = t.sp; const s = p.mlb2026, L = p.mlbLast, X = p.aaa2026;
    const st = (label, o) => `<div class="stats">
      <div><span class="v">${o.wl}</span><span class="t">勝-敗</span></div>
      <div><span class="v">${o.era}</span><span class="t">ERA 防禦率</span></div>
      <div><span class="v">${o.whip}</span><span class="t">WHIP 每局被上壘</span></div>
      <div><span class="v">${o.ip}</span><span class="t">局數（${o.gs} 先發）</span></div>
      <div><span class="v">${o.so}</span><span class="t">三振</span></div>
      <div><span class="v">${o.bb}</span><span class="t">保送</span></div>
      <div>${o.avg ? `<span class="v">${o.avg}</span>` : `<span class="v na">資料不足</span>`}<span class="t">被打擊率</span></div>
      <div><span class="v na">資料不足</span><span class="t">主／客・對左／右</span></div>
    </div>`;
    return `<div class="panel pit">
      <div class="phead"><span class="photo" aria-hidden="true">${p.name.split(" ").map(w => w[0]).join("")}</span>
        <div><div class="n">${esc(p.name)} <span class="tag exp">預計先發</span></div><div class="s">${t.ab}・${hand(p.hand)}・${p.age} 歲</div></div></div>
      ${s ? `<div><div class="small" style="margin-bottom:4px"><b>2026 大聯盟</b></div>${st("", s)}</div>`
          : `<div class="pnote">2026 大聯盟：尚無有效樣本（0 場出賽）。核心數據改列 2026 年 3A。</div>
             <div><div class="small" style="margin-bottom:4px"><b>2026 小聯盟 3A</b>・${esc(X.team)}</div>${st("", X)}</div>`}
      <details><summary class="small">展開：${L.year} 大聯盟（上一個有成績的球季）</summary><div style="margin-top:6px">${st("", L)}</div></details>
      <details><summary class="small">展開：最近先發逐場（3A）</summary>
        <table class="tbl stack" style="margin-top:6px"><thead><tr><th class="l">日期</th><th>對手</th><th>局數</th><th>被安打</th><th>自責分</th><th>三振</th><th>保送</th><th>用球</th></tr></thead>
        <tbody>${p.last5.map(r => `<tr><td class="l">${r[0]}</td><td data-k="對手">${esc(r[1])}</td><td data-k="局數" class="n">${r[2]}</td><td data-k="被安打" class="n">${r[3]}</td><td data-k="自責分" class="n">${r[4]}</td><td data-k="三振" class="n">${r[5]}</td><td data-k="保送" class="n">${r[6]}</td><td data-k="用球" class="n">${r[7]}</td></tr>`).join("")}</tbody></table></details>
      <div class="pnote">${esc(p.note)}</div>
    </div>`; };
  const pitchers = `<section class="blk" id="sp"><h2>先發投手比較 <small>左＝客隊 ${A.ab}，右＝主隊 ${H.ab}</small></h2><div class="two">${pitcher(A)}${pitcher(H)}</div></section>`;

  /* 2b. 預估打線（V1.2）：時效與資料狀態 */
  const LSTATE = { initial: ["初步預估", "na"], consensus: ["多來源共識", "exp"], official: ["官方確認", "ok"], late: ["臨場異動", "late"] };
  const lstate = k => { const [t, c] = LSTATE[k]; return `<span class="tag ${c}">${t}</span>`; };
  const diffLineup = (est, off) => { const e = Object.fromEntries(est.map(x => [x.name, x.n])); let person = 0, order = 0;
    off.forEach(x => { if (!(x.name in e)) person++; else if (e[x.name] !== x.n) order++; }); return { person, order }; };
  const lineupCard = (t, L, view) => {
    const DEMO = '<span class="tag demo-tag">原型示範</span>';
    if (view === "initial") { const I = L.initial;
      return `<div class="panel">
      <div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${lstate("initial")} <span class="tag demo-tag">預估非官方</span></div>
      <div class="lmeta"><span>首次發布 <b class="num">${I.at}</b> ${DEMO}</span><span>來源共識 <b>尚未比對</b></span><span>不確定席位 <b>尚未比對</b></span></div>
      <table class="tbl lu"><thead><tr><th>棒</th><th class="l">球員</th><th>守位</th></tr></thead><tbody>${I.slots.map(x => `<tr><td class="n">${x.n}</td><td class="l">${esc(x.name)}</td><td>${x.pos}</td></tr>`).join("")}</tbody></table>
      <details><summary class="small">展開：版本變更紀錄（1 筆）</summary><ol class="vlog"><li><b class="num">${L.versions[0].at}</b> ${lstate("initial")} <span>${esc(L.versions[0].note)}</span></li></ol></details>
      <p class="small" style="margin:6px 0 0">依據：${esc(I.basis)}（初版獨立快照，不含共識與備選）</p></div>`; }
    const isOff = view === "official" || view === "late";
    const src = view === "late" ? L.preview.late : view === "official" ? L.preview.official : null;
    const slots = src ? src.slots : L.slots;
    const est = Object.fromEntries(L.slots.map(x => [x.n, x]));
    const uncertain = L.slots.filter(x => x.alt).length;
    const d = src ? diffLineup(L.slots, slots) : null;
    const dLate = view === "late" && L.preview.official ? diffLineup(L.preview.official.slots, slots) : null;
    const rows = slots.map(x => { const e = est[x.n]; const changed = src && (!e || e.name !== x.name);
      return `<tr${changed ? ' class="chg"' : ""}><td class="n">${x.n}</td><td class="l">${esc(x.name)}${changed ? ` <span class="tag late">原預估 ${esc(e ? e.name : "—")}</span>` : ""}</td><td>${x.pos}</td>
        <td>${src ? "" : `<span class="num">${x.agree}</span>`}</td><td class="l alt">${src ? "" : (x.alt ? x.alt.map(esc).join("、") : "—")}</td></tr>`; }).join("");
    const meta = src
      ? `<div class="lmeta"><span>官方確認 <b class="num">${view === "late" ? L.preview.official.confirmedAt : src.confirmedAt}</b> ${DEMO}</span>${view === "late" ? `<span>臨場異動 <b class="num">${src.at}</b> ${DEMO}</span>` : ""}
         <span>與原預估相比 <b class="num">${d.person}</b> 人員、<b class="num">${d.order}</b> 棒次改變</span>${dLate ? `<span>與官方版相比 <b class="num">${dLate.person}</b> 人員改變</span>` : ""}</div>`
      : `<div class="lmeta"><span>首次發布 <b class="num">${L.firstAt}</b> ${DEMO}</span><span>最後更新 <b class="num">${L.updatedAt}</b></span>
         <span>來源共識 <b class="num">${L.sources.agree}/${L.sources.total}</b> ${DEMO}</span><span>不確定席位 <b class="num">${uncertain}</b></span></div>`;
    const versions = L.versions.concat(src ? [{ at: L.preview.official.confirmedAt, state: "official", note: L.preview.official.note }] : [])
      .concat(view === "late" ? [{ at: src.at, state: "late", note: src.note }] : []);
    return `<div class="panel">
      <div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${lstate(view)} ${isOff ? DEMO + '<span class="small">此版本為原型示範，非 MLB 官方公布</span>' : '<span class="tag demo-tag">預估非官方</span>'}</div>
      ${meta}
      <table class="tbl lu"><thead><tr><th>棒</th><th class="l">球員</th><th>守位</th><th>${src ? "" : "共識"}</th><th class="l">${src ? "" : "備選（有分歧時）"}</th></tr></thead><tbody>${rows}</tbody></table>
      ${src ? "" : '<p class="small" style="margin:6px 0 0"><span class="tag demo-tag">原型示範</span> 首次發布時間、來源共識比例、備選名單為示範資料，非實際多來源比對；打序名單依據真實 9/20 打序。</p>'}
      <details><summary class="small">展開：版本變更紀錄（${versions.length} 筆）</summary>
        <ol class="vlog">${versions.map(v => `<li><b class="num">${v.at}</b> ${lstate(v.state)} <span>${esc(v.note)}</span></li>`).join("")}</ol></details>
      <p class="small" style="margin:6px 0 0">依據：${esc(L.basis)}</p>
    </div>`; };
  const lineupSec = `<section class="blk" id="lu"><h2>預估打線 ${luTag(G.lineup)} <small>與首頁、頂部同一狀態</small>
      <span class="preview"><label for="luView">原型預覽：切換狀態</label><select id="luView"><option value="consensus">目前：多來源共識</option><option value="initial">初步預估</option><option value="official">官方確認（示範）</option><option value="late">臨場異動（示範）</option></select></span></h2>
    <div class="two" id="luBody"></div>
    <p class="small" style="margin:8px 0 0">狀態定義：初步預估＝單一依據建立；多來源共識＝多個來源交叉比對，顯示同意比例；官方確認＝MLB 官方公布打線；臨場異動＝官方確認後再變動。預估與官方永遠分開標示，預估不會被寫成官方。</p></section>`;

  /* 3. 打擊 */
  const HIT_TABS = [["matchup", "今日對位"], ["season", "本季"], ["l10", "近十場"], ["month", "本月（9 月）"], ["vl", "對左投"], ["vr", "對右投"]];
  const hitting = `<section class="blk" id="hit"><h2>團隊打擊比較</h2>
    <div class="panel"><div class="tabs" id="hitTabs" role="tablist">${HIT_TABS.map(([k, l], i) => `<button role="tab" aria-selected="${i === 0}" data-h="${k}">${l}</button>`).join("")}</div>
    <div class="cmp" id="hitBody"></div><p class="small" id="hitNote" style="margin:8px 0 0"></p></div></section>`;

  /* 4. 牛棚 */
  const bp = (t) => t.bullpen;
  const bullpen = `<section class="blk" id="bp"><h2>牛棚比較</h2>
    <div class="two">
      <div class="panel cmp"><div class="r h"><span>${A.ab}</span><span class="k">整季牛棚表現</span><span>${H.ab}</span></div>
        ${row("ERA 防禦率", bp(A).era, bp(H).era)}
        ${row("WHIP", bp(A).whip, bp(H).whip)}
        ${row("被打擊率", bp(A).avg, bp(H).avg)}
        ${row("三振率", bp(A).kpct, bp(H).kpct, `三振÷打席：${bp(A).kNote}｜${bp(H).kNote}`)}
      </div>
      <div class="panel cmp"><div class="r h"><span>${A.ab}</span><span class="k">最近三日負荷（9/18–9/20）</span><span>${H.ab}</span></div>
        ${row("牛棚投球局數", bp(A).ip3, bp(H).ip3)}
        ${row("使用投手人數", bp(A).arms3, bp(H).arms3)}
        ${row("連續兩日登板人數", bp(A).consec, bp(H).consec, `${bp(A).consecNames}｜${bp(H).consecNames}`)}
        ${row("終結者昨日是否登板", bp(A).closerY ? "有" : "無", bp(H).closerY ? "有" : "無", `${bp(A).closer}｜${bp(H).closer}`)}
        ${row("終結者昨日用球數", bp(A).closerY ? bp(A).closerNp : "—", bp(H).closerY ? bp(H).closerNp : "—")}
      </div>
    </div>
    <details class="panel" style="margin-top:10px"><summary class="small" style="cursor:pointer">展開：近三日逐日登板明細（投手 局數/用球數）</summary>
      <div class="two" style="margin-top:8px">${[A, H].map(t => `<div><b class="small">${t.ab}</b>${bp(t).log.map(l => `<div class="small" style="margin-top:4px"><b>${l[0]}</b>　${esc(l[1])}</div>`).join("")}</div>`).join("")}</div></details>
  </section>`;

  /* 5. 近五場 */
  const last5 = (t) => `<table class="tbl stack"><caption>${t.ab} ${t.name}</caption>
    <thead><tr><th class="l">日期</th><th>主客</th><th>對手</th><th>比分</th><th>勝負</th><th>先發投手</th><th>總得分</th><th>大小分結果</th></tr></thead>
    <tbody>${t.last5.map(r => `<tr><td class="l">${r[0]}</td><td data-k="主客">${r[1]}</td><td data-k="對手">${r[2]}</td><td data-k="比分" class="n">${r[3]}</td><td data-k="勝負">${r[4]}</td><td data-k="先發投手">${esc(r[5])}</td><td data-k="總得分" class="n">${r[6]}</td><td data-k="大小分結果">${r[7] ?? NA}</td></tr>`).join("")}</tbody></table>`;
  const recent = `<section class="blk" id="recent"><h2>最近五場 <small>比分＝本隊-對手</small></h2>
    <div class="panel cmp"><div class="r h"><span>${A.ab}</span><span class="k">近五場戰績</span><span>${H.ab}</span></div>
      ${row("勝-敗", `${A.last5.filter(r => r[4] === "勝").length}-${A.last5.filter(r => r[4] === "敗").length}`, `${H.last5.filter(r => r[4] === "勝").length}-${H.last5.filter(r => r[4] === "敗").length}`)}
      ${row("場均得分", (A.last5.reduce((a, r) => a + +r[3].split("-")[0], 0) / 5).toFixed(1), (H.last5.reduce((a, r) => a + +r[3].split("-")[0], 0) / 5).toFixed(1))}
      ${row("場均失分", (A.last5.reduce((a, r) => a + +r[3].split("-")[1], 0) / 5).toFixed(1), (H.last5.reduce((a, r) => a + +r[3].split("-")[1], 0) / 5).toFixed(1))}
    </div>
    <div class="two" style="margin-top:10px"><details class="panel"><summary class="small">展開：${A.ab} 逐場</summary>${last5(A)}</details><details class="panel"><summary class="small">展開：${H.ab} 逐場</summary>${last5(H)}</details></div>
    <p class="small" style="margin:8px 0 0">大小分結果需比對當日盤口，原型未取得歷史盤口，故顯示「資料不足」。</p></section>`;

  /* 6. 盤口 */
  const O = G.odds;
  const odds = `<section class="blk" id="odds"><h2>盤口資料 <span class="tag demo-tag">全部為示範數據</span></h2>
    <div class="two">
      <div class="panel cmp"><div class="r h"><span>${A.ab}</span><span class="k">台灣運彩</span><span>${H.ab}</span></div>
        ${row("不讓分", O.tw.ml[0], O.tw.ml[1])}
        ${row("讓分", `${O.tw.rl[1]}<i>${O.tw.rl[0]}</i>`, `${O.tw.rl[3]}<i>${O.tw.rl[2]}</i>`)}
        ${row(`大小 ${O.tw.ou[0]}`, `${O.tw.ou[1]}<i>大</i>`, `${O.tw.ou[2]}<i>小</i>`)}
        <p class="small" style="margin:8px 0 0">最後更新 ${O.tw.updated}（示範）</p>
      </div>
      <div class="panel"><div class="scrollx"><table class="tbl"><caption>國際盤（美式賠率）</caption>
        <thead><tr><th class="l">項目</th><th>開盤</th><th>目前</th></tr></thead>
        <tbody>
          <tr><td class="l">不讓分 ${A.ab}／${H.ab}</td><td class="n">${O.intl.open.ml.join(" / ")}</td><td class="n">${O.intl.now.ml.join(" / ")}</td></tr>
          <tr><td class="l">讓分 ${A.ab}／${H.ab}</td><td class="n">${O.intl.open.rl.join(" / ")}</td><td class="n">${O.intl.now.rl.join(" / ")}</td></tr>
          <tr><td class="l">大小</td><td class="n">${O.intl.open.ou}</td><td class="n">${O.intl.now.ou}</td></tr>
        </tbody></table></div><p class="small" style="margin:8px 0 0">最後更新 ${O.intl.updated}（示範）</p></div>
    </div></section>`;

  /* 7. 觀察 */
  const obs = `<section class="blk" id="obs"><h2>運彩 101 簡短觀察 <small>${G.note.length} 字</small></h2><div class="panel obs">${esc(G.note)}</div></section>`;

  root.innerHTML = overview + first5 + pitchers + lineupSec + hitting + bullpen + recent + odds + obs;
  const drawLU = view => { const v = view === "consensus" ? "consensus" : view;
    $("#luBody").innerHTML = lineupCard(A, G.lineups.away, v) + lineupCard(H, G.lineups.home, v === "late" && !G.lineups.home.preview.late ? "official" : v); };
  drawLU("consensus");
  $("#luView").addEventListener("change", e => drawLU(e.target.value));
  $("#subnav").innerHTML = [["overview", "比賽總覽"], ["sp", "先發投手"], ["lu", "打線"], ["hit", "打擊"], ["bp", "牛棚"], ["recent", "近期比賽"], ["odds", "盤口"], ["obs", "觀察"]].map(([id, l]) => `<a href="#${id}">${l}</a>`).join("");

  /* 打擊 Tab */
  const drawHit = key => {
    const mu = key === "matchup";
    const aKey = H.sp.hand === "L" ? "vl" : "vr", hKey = A.sp.hand === "L" ? "vl" : "vr";
    const a = mu ? A.hit[aKey] : A.hit[key], h = mu ? H.hit[hKey] : H.hit[key];
    const body = $("#hitBody"), note = $("#hitNote");
    const head = mu ? `<div class="r h"><span>${A.ab} 對${hand(H.sp.hand)}</span><span class="k">今日對位</span><span>${H.ab} 對${hand(A.sp.hand)}</span></div>` : headBase;
    if (!a || !h) { body.innerHTML = head + `<div class="r"><span class="v na" style="grid-column:1/-1;text-align:center;padding:14px 0">近十場拆分原型未取得，顯示「資料不足」</span></div>`; note.textContent = ""; return; }
    body.innerHTML = head +
      row("打擊率", a.avg, h.avg) + row("上壘率", a.obp, h.obp) + row("長打率", a.slg, h.slg) + row("OPS", a.ops, h.ops, "上壘率＋長打率") +
      row("平均得分", a.rpg, h.rpg, a.rpg ? `${a.g}／${h.g} 場` : "對左右投拆分不含得分") +
      row("全壘打", a.hr, h.hr) + row("三振", a.so, h.so) + row("保送", a.bb, h.bb);
    note.textContent = mu ? `${A.ab} 面對主隊先發 ${H.sp.name}（${hand(H.sp.hand)}）→ 列 ${A.ab} 本季對${hand(H.sp.hand)}；${H.ab} 面對客隊先發 ${A.sp.name}（${hand(A.sp.hand)}）→ 列 ${H.ab} 本季對${hand(A.sp.hand)}。場數＝有該類打席的場數。`
      : key === "vl" || key === "vr" ? `對左投／對右投的「場數」為有該類打席的場數。` : "";
  };
  $("#hitTabs").addEventListener("click", e => { const b = e.target.closest("button[data-h]"); if (!b) return; [...$("#hitTabs").children].forEach(x => x.setAttribute("aria-selected", x === b)); drawHit(b.dataset.h); });
  drawHit("matchup");

  /* 子導覽高亮 */
  const links = [...document.querySelectorAll(".subnav a")];
  const io = new IntersectionObserver(es => { es.forEach(en => { if (en.isIntersecting) links.forEach(l => l.classList.toggle("on", l.getAttribute("href") === "#" + en.target.id)); }); }, { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll("section.blk").forEach(s => io.observe(s));
}
