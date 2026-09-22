/* 運彩 101 /live/ 試營運：讀 data/manifest.json、data/dates/<日期>.json、data/games/<gamePk>.json（由 scripts/build-live.mjs 從 MLB 官方 API 產生） */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hand = h => h === "L" ? "左投" : h === "R" ? "右投" : "";
const NA = t => `<span class="tag na">${t || "尚未取得"}</span>`;
const stamp = iso => { if (!iso) return null; const s = new Date(Date.parse(iso) + 8 * 36e5).toISOString(); return `${s.slice(5, 10).replace("-", "/")} ${s.slice(11, 16)}`; };
const WK = "日一二三四五六";
const dayLabel = d => `${+d.slice(5, 7)}/${+d.slice(8)}（${WK[new Date(d + "T00:00:00Z").getUTCDay()]}）`;
const statusTag = g => { const c = g.status.code; const cls = c === "final" ? "ok" : c === "live" ? "exp" : ["ppd", "cxl", "susp"].includes(c) ? "late" : "na";
  return `<span class="tag ${cls}">${esc(g.status.text)}${c === "live" && g.inning ? ` ${g.inningHalf === "Top" ? "上" : g.inningHalf === "Bottom" ? "下" : ""}${esc(g.inning)}` : ""}</span>`; };
const luTag = t => t.lineup.state === "late" ? `<span class="tag late">${t.ab} 臨場異動</span>` : t.lineup.state === "official" ? `<span class="tag ok">${t.ab} 官方打線已確認</span>` : `<span class="tag na">${t.ab} 官方打線未公布</span>`;
const spLine = sp => sp ? `<b>${esc(sp.name)}</b> ${hand(sp.hand)}${sp.s ? ` <span class="num">${sp.s.wl}・${sp.s.era}</span>` : ` <span class="tag na">本季無大聯盟成績</span>`}` : `<span class="tag na">先發未公布</span>`;
const noteTags = g => [g.dh && `雙重賽 ${g.dh}`, g.tbd && "開賽時間未定", g.rescheduledFrom && `補賽（原 ${g.rescheduledFrom.slice(5, 10)}）`, g.rescheduleDate && `改期至 ${g.rescheduleDate.slice(5, 10)}`].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join("");
async function load(f) { const r = await fetch(`./data/${f}?t=${Date.now()}`); if (!r.ok) throw new Error(`${f} HTTP ${r.status}`); return r.json(); }
const fail = (el, e) => { el.innerHTML = `<div class="empty">資料載入失敗（${esc(e.message)}），請稍後重新整理。</div>`; };

/* ================= 首頁 ================= */
async function renderHome() {
  let D; try { D = await load("manifest.json"); for (const d of D.days) d.games = (await load(`dates/${d.date}.json`)).games; } catch (e) { return fail($("#games"), e); }
  const qs = new URLSearchParams(location.search);
  const state = { day: qs.get("d") === "tomorrow" ? "tomorrow" : "today", status: "all" };
  const F = [["all", "全部"], ["pre", "賽前"], ["live", "進行中"], ["final", "已結束"], ["off", "延期／取消"]];
  const dayEl = $("#days"), stEl = $("#status");
  const draw = () => {
    dayEl.innerHTML = D.days.map(d => `<button aria-pressed="${d.key === state.day}" data-d="${d.key}">${d.label} ${dayLabel(d.date)}</button>`).join("");
    stEl.innerHTML = F.map(([k, v]) => `<button aria-pressed="${k === state.status}" data-st="${k}">${v}</button>`).join("");
    const day = D.days.find(d => d.key === state.day), all = day.games, n = all.length;
    const games = all.filter(g => state.status === "all" || (state.status === "off" ? ["ppd", "cxl", "susp"].includes(g.status.code) : g.status.code === state.status));
    $("#dayTitle").innerHTML = `${dayLabel(day.date)} MLB 比賽 <small>${n} 場・台灣時間</small>`;
    const cnt = f => all.filter(f).length, sides = all.flatMap(g => [g.away, g.home]);
    const ready = `<div class="ready"><b>資料完成度</b>
      <span>雙方預計先發 <b class="num">${cnt(g => g.away.sp && g.home.sp)}/${n}</b></span>
      <span>官方打線 <b class="num">${sides.filter(t => t.lineup.state !== "none").length}/${2 * n}</b> 隊</span>
      <span>上一場打線 <b class="num">${sides.filter(t => t.prev?.has).length}/${2 * n}</b> 隊</span>
      <span>盤口 <b class="num">0/${n}</b></span><span>天氣 <b class="num">0/${n}</b></span>
      <small>更新 ${D.generatedAtTW}</small></div>`;
    $("#games").innerHTML = ready + (games.length ? games.map(card).join("") : `<div class="empty">${n ? "此篩選條件下沒有比賽。" : "這一天沒有 MLB 比賽。"}</div>`);
  };
  const card = g => {
    const sc = ["final", "live"].includes(g.status.code);
    const team = t => `<div class="trow"><span class="logo" aria-hidden="true">${esc(t.ab)}</span>
      <span class="tname">${esc(t.name)}<em class="num">${t.rec || ""}</em>${sc && t.score != null ? `<span class="score">${t.score}</span>` : ""}</span>
      <span class="sp">${spLine(t.sp)}</span></div>`;
    return `<article class="card">
      <div class="meta"><span><b>${g.twTime || "時間未定"}</b> ${noteTags(g)}</span><span>${statusTag(g)}</span></div>
      ${team(g.away)}${team(g.home)}
      <div class="hints">${g.status.code === "final" ? "" : luTag(g.away) + luTag(g.home)}</div>
      <div class="cta"><span class="small">${esc(g.venue)}</span><a class="btn" href="game.html?pk=${g.pk}">查看比賽資料 →</a></div>
    </article>`;
  };
  document.addEventListener("click", e => { const b = e.target.closest("button[data-d],button[data-st]"); if (!b) return;
    if (b.dataset.d) state.day = b.dataset.d; if (b.dataset.st) state.status = b.dataset.st; draw(); });
  draw();
}

/* ================= 單場頁 ================= */
async function renderGame() {
  const pk = new URLSearchParams(location.search).get("pk");
  if (!/^\d+$/.test(pk || "")) { $("#hero").innerHTML = `<div class="empty">網址缺少 gamePk。<a href="./">回本日比賽</a></div>`; return; }
  let G; try { G = await load(`games/${pk}.json`); } catch (e) { $("#hero").innerHTML = `<div class="empty">找不到 gamePk ${esc(pk)} 的資料（${esc(e.message)}）。<a href="./">回本日比賽</a></div>`; return; }
  const D = { generatedAtTW: stamp(G.updatedAt) };
  const A = G.away, H = G.home;
  document.title = `運彩 101｜${A.name} @ ${H.name}（${dayLabel(G.twDate)}）`;
  $("#crumb").innerHTML = `<a href="./">← 本日比賽</a>　MLB　${dayLabel(G.twDate)}　gamePk ${G.pk}`;
  const sc = ["final", "live"].includes(G.status.code);
  $("#hero").innerHTML = `
    <div class="vs">
      <div><div class="ab">${esc(A.ab)}</div><div class="nm">${esc(A.name)}</div><div class="rc num">${A.rec || ""}・客隊</div></div>
      <div class="at">${sc ? `<span class="num">${A.score ?? "-"} : ${H.score ?? "-"}</span>` : "@"}</div>
      <div><div class="ab">${esc(H.ab)}</div><div class="nm">${esc(H.name)}</div><div class="rc num">${H.rec || ""}・主隊</div></div>
    </div>
    <div class="facts">
      <span>開賽 <b class="num">${G.twTime || "時間未定"}</b> 台灣時間${G.localTime ? `（球場當地 <b class="num">${esc(G.localTime)}</b>）` : ""}</span>
      <span>球場 <b>${esc(G.venue)}</b></span>
      <span>狀態 ${statusTag(G)} ${noteTags(G)}</span>
      <span>距開賽 <b class="num" id="countdown">—</b></span>
      <span>資料更新 <b class="num">${D.generatedAtTW}</b></span>
    </div>`;
  const tick = () => { const el = $("#countdown"); if (!el) return; if (G.tbd) { el.textContent = "時間未定"; return; } const ms = Date.parse(G.startUTC) - Date.now();
    el.textContent = ms <= 0 ? "已過表定開賽" : `${Math.floor(ms / 36e5)} 小時 ${String(Math.floor(ms % 36e5 / 6e4)).padStart(2, "0")} 分`; };
  tick(); setInterval(tick, 30000);

  const v = x => x == null ? `<span class="v na">尚未取得</span>` : `<span class="v">${esc(x)}</span>`;
  const row = (k, a, h, sub) => `<div class="r">${v(a)}<span class="k">${k}${sub ? `<i>${sub}</i>` : ""}</span>${v(h)}</div>`;
  const avg = (x, gp) => x != null && gp ? (x / gp).toFixed(2) : null;
  const streak = s => s ? s.replace(/^W(\d+)/, "$1 連勝").replace(/^L(\d+)/, "$1 連敗") : null;
  const overview = `<section class="blk" id="overview"><h2>比賽總覽 <small>本季至 ${D.generatedAtTW}</small></h2>
    <div class="panel cmp"><div class="r h"><span>${A.ab} ${A.name}</span><span class="k">客｜主</span><span>${H.ab} ${H.name}</span></div>
      ${row("本季戰績", A.rec, H.rec, `勝率 ${A.pct ?? "—"}｜${H.pct ?? "—"}`)}
      ${row("今日主客場條件", A.road, H.home, `${A.ab} 客場戰績｜${H.ab} 主場戰績`)}
      ${row("近十場", A.l10, H.l10)}
      ${row("連勝／連敗", streak(A.streak), streak(H.streak))}
      ${row("平均得分", avg(A.rs, A.gp), avg(H.rs, H.gp), `${A.rs ?? "—"} 分÷${A.gp ?? "—"} 場｜${H.rs ?? "—"} 分÷${H.gp ?? "—"} 場`)}
      ${row("平均失分", avg(A.ra, A.gp), avg(H.ra, H.gp), `${A.ra ?? "—"} 分÷${A.gp ?? "—"} 場｜${H.ra ?? "—"} 分÷${H.gp ?? "—"} 場`)}
      ${row("團隊 OPS", A.ops, H.ops, "OPS＝上壘率＋長打率")}
      ${row("全隊投手 ERA", A.era, H.era, "含先發與牛棚")}
    </div></section>`;

  const pit = t => { const p = t.sp; if (!p) return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${NA("先發未公布")}</div></div>`;
    const s = p.s, cell = (k, x) => `<div><span class="v num">${x ?? "—"}</span><span class="t">${k}</span></div>`;
    return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(p.name)}</b> ${hand(p.hand)} <span class="tag exp">預計</span></div>
      <div class="lmeta"><span>本站首次看到：<b>${stamp(p.firstSeen) || "—"}</b></span></div>
      ${s ? `<div class="stats">${cell("勝-敗", s.wl)}${cell("ERA", s.era)}${cell("WHIP", s.whip)}${cell("局數", s.ip)}${cell("先發", s.gs)}${cell("三振", s.so)}${cell("保送", s.bb)}</div><p class="small">2026 大聯盟例行賽（被交易者為全季合計）</p>` : `<p class="small">${NA("本季無大聯盟成績")}（3A 等小聯盟成績本站尚未取得）</p>`}
    </div>`; };
  const pitchers = `<section class="blk" id="sp"><h2>先發投手 <small>MLB 官方預計先發</small></h2><div class="two">${pit(A)}${pit(H)}</div></section>`;

  const table = slots => `<table class="tbl lu"><thead><tr><th>棒</th><th class="l">球員</th><th>守位</th><th>AVG</th><th>OPS</th></tr></thead><tbody>${slots.map(x => `<tr><td class="n">${x.n}</td><td class="l">${esc(x.name)}</td><td>${esc(x.pos || "—")}</td><td class="num">${x.avg ?? "—"}</td><td class="num">${x.ops ?? "—"}</td></tr>`).join("")}</tbody></table>`;
  const prevBlock = t => t.prev?.slots ? `<p class="small">上一場：${t.prev.date.slice(5)} ${t.prev.ha}場對 ${esc(t.prev.opp)}（${t.prev.score}），<a href="https://www.mlb.com/gameday/${t.prev.pk}" rel="noopener">官方比賽紀錄</a></p>${table(t.prev.slots)}` : `<p class="small">${NA()} 找不到近 12 天內已完賽的上一場。</p>`;
  const lu = t => { const L = t.lineup;
    if (L.slots) return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${luTag(t)}</div>
      <div class="lmeta"><span>本站首次看到官方打線：<b>${stamp(L.firstSeen) || "—"}</b></span>${L.lateAt ? `<span>偵測到臨場異動：<b>${stamp(L.lateAt)}</b></span>` : ""}</div>
      ${table(L.slots)}<details><summary class="small">上一場官方打線（參考）</summary>${prevBlock(t)}</details></div>`;
    return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${luTag(t)}</div>
      <p class="small">MLB 官方尚未公布本場打線。以下為<b>上一場官方打線</b>，僅供參考，不是本場預估。</p>${prevBlock(t)}</div>`; };
  const lineups = `<section class="blk" id="lu"><h2>打線 <small>AVG／OPS 為 2026 本季</small></h2><div class="two">${lu(A)}${lu(H)}</div></section>`;
  const missing = `<section class="blk" id="na"><h2>本站尚未取得</h2><div class="panel"><p class="small">預估打線、盤口、天氣、主審、傷兵、牛棚近期負荷：試營運第一階段尚未接入，不以示範值填補。</p></div></section>`;
  $("#game").innerHTML = overview + pitchers + lineups + missing;
}
