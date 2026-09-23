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

/* ================= 更新狀態：過期、失敗一定要看得出來 ================= */
// 資料沒變動時不 commit，manifest 的時間只代表「最後變動」；「最後檢查」要問 GitHub Actions 公開 API，問不到就只看資料時間
// 排程：台灣 21:00–11:59（賽前、比賽時段）每 30 分鐘；其他時段每 3 小時。警示門檻跟著時段走
const STALE_H = 5, DENSE_H = 1.5;
const dense = () => { const h = new Date().getUTCHours(); return h >= 13 || h <= 3; };
const RUNS = "https://api.github.com/repos/yaoshengmarketing-prog/101/actions/workflows/live-data.yml/runs?per_page=10";
const twToday = () => new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
const nextDay = d => new Date(Date.parse(d + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
const ago = h => h < 1 ? `${Math.max(1, Math.round(h * 60))} 分鐘前` : `${h.toFixed(1)} 小時前`;
async function lastRuns() {
  try { const c = JSON.parse(sessionStorage.getItem("runs") || "null"); if (c && Date.now() - c.t < 3e5) return c.runs; } catch {}
  try {
    const r = await fetch(RUNS); if (!r.ok) return null;
    const runs = (await r.json()).workflow_runs.filter(x => x.status === "completed")
      .map(x => ({ ok: x.conclusion === "success", bad: ["failure", "timed_out"].includes(x.conclusion), at: x.conclusion === "success" ? x.run_started_at : x.updated_at, url: x.html_url }));
    try { sessionStorage.setItem("runs", JSON.stringify({ t: Date.now(), runs })); } catch {}
    return runs;
  } catch { return null; }
}
async function freshness(M, extra = []) {
  const [S, R] = await Promise.all([load("status.json").catch(() => null), lastRuns()]);
  const okRun = R?.find(x => x.ok), last = R?.[0];
  const checked = Math.max(Date.parse(M.generatedAt), okRun ? Date.parse(okRun.at) : 0);
  const today = twToday(), ageH = (Date.now() - checked) / 36e5, msgs = [];
  // 黃色＝資料比預期舊（GitHub 排程可能延遲，不等於故障）；紅色＝確實有一次執行失敗
  const at = stamp(new Date(checked).toISOString()), late = ageH > (dense() ? DENSE_H : STALE_H);
  if (M.days[0].date !== today) msgs.push(["warn", M.days[1]?.date === today && ageH <= STALE_H
    ? `<b>已過午夜，今天的賽程會在下次自動更新（約 00:07）後換上。</b>日期標籤已改用實際日期。`
    : `<b>資料還沒更新到今天。</b>資料裡的「今天」是 ${dayLabel(M.days[0].date)}，現在台灣日期是 ${dayLabel(today)}；日期標籤已改用實際日期。`]);
  if (last ? last.bad : S?.lastAttemptOk === false) { const url = last ? last.url : S.runUrl;
    msgs.push(["bad", `<b>最近一次自動更新執行失敗</b>（${stamp(last ? last.at : S.lastAttemptAt)}），目前顯示的是上一次成功取得的資料。${url ? `<a href="${esc(url)}" rel="noopener">執行紀錄</a>` : ""}`]); }
  msgs.push(...extra);
  msgs.unshift([late ? "warn" : "", (late ? "<b>資料較舊</b>：" : "") + (R
    ? `最近一次流程檢查成功 <b>${at}</b>（${ago(ageH)}）・頁面內容最後變動 ${M.generatedAtTW}・個別項目以各自的取得時間與狀態為準`
    : `頁面內容取得於 <b>${M.generatedAtTW}</b>（${ago(ageH)}）；目前連不到 GitHub，無法確認之後是否還有檢查`)
    + (late ? `。${dense() ? "賽前時段原定每 30 分鐘" : "原定每 3 小時"}取得一次，GitHub 排程有時會延遲數小時，這不代表已確認故障。` : `・${dense() ? "賽前時段每 30 分鐘" : "每 3 小時"}自動取得，內容有變才更新`)]);
  document.querySelectorAll("[data-fresh]").forEach(n => n.remove());
  $(".top").insertAdjacentHTML("afterend", msgs.map(([c, t]) => `<div class="notice ${c}" data-fresh role="${c ? "alert" : "status"}">${t}</div>`).join(""));
  return today;
}
// 頁面一直開著：每分鐘重算提示、換日時重畫；每 5 分鐘看有沒有新資料，有就重新載入
function keepFresh(M, extra, onDay) {
  let day = twToday(), n = 0;
  setInterval(async () => {
    await freshness(M, extra);
    if (twToday() !== day) { day = twToday(); if (onDay) onDay(); }
    if (++n % 5 === 0) { const m = await load("manifest.json").catch(() => null); if (m && m.generatedAt !== M.generatedAt) location.reload(); }
  }, 60000);
}

/* ================= 首頁 ================= */
async function renderHome() {
  let D; try { D = await load("manifest.json"); for (const d of D.days) d.games = (await load(`dates/${d.date}.json`)).games; } catch (e) { return fail($("#games"), e); }
  await freshness(D);
  const realDay = d => d.date === twToday() ? "今天" : d.date === nextDay(twToday()) ? "明天" : "";
  const BI = (await load("bullpen/index.json").catch(() => null))?.games || {};
  const bpOf = pk => BI[pk]?.status || "none";
  const bpTag = pk => ({ incomplete: `<span class="tag late">牛棚部分場次未取得</span>`, failed: `<span class="tag na">牛棚未取得</span>`, none: `<span class="tag na">牛棚未取得</span>` })[bpOf(pk)] || "";
  const qs = new URLSearchParams(location.search);
  const state = { day: qs.get("d") === "tomorrow" ? "tomorrow" : "today", status: "all" };
  const F = [["all", "全部"], ["pre", "賽前"], ["live", "進行中"], ["final", "已結束"], ["off", "延期／取消"]];
  const dayEl = $("#days"), stEl = $("#status");
  const draw = () => {
    dayEl.innerHTML = D.days.map(d => `<button aria-pressed="${d.key === state.day}" data-d="${d.key}">${realDay(d)} ${dayLabel(d.date)}</button>`).join("");
    stEl.innerHTML = F.map(([k, v]) => `<button aria-pressed="${k === state.status}" data-st="${k}">${v}</button>`).join("");
    const day = D.days.find(d => d.key === state.day), all = day.games, n = all.length;
    const games = all.filter(g => state.status === "all" || (state.status === "off" ? ["ppd", "cxl", "susp"].includes(g.status.code) : g.status.code === state.status));
    $("#dayTitle").innerHTML = `${dayLabel(day.date)} MLB 比賽 <small>${n} 場・台灣時間</small>`;
    const cnt = f => all.filter(f).length, sides = all.flatMap(g => [g.away, g.home]);
    const ready = `<div class="ready"><b>資料完成度</b>
      <span>雙方預計先發 <b class="num">${cnt(g => g.away.sp && g.home.sp)}/${n}</b></span>
      <span>官方打線 <b class="num">${sides.filter(t => t.lineup.state !== "none").length}/${2 * n}</b> 隊</span>
      <span>上一場打線 <b class="num">${sides.filter(t => t.prev?.has).length}/${2 * n}</b> 隊</span>
      <span>牛棚 <b class="num">${cnt(g => bpOf(g.pk) === "ok")}/${n}</b>${cnt(g => bpOf(g.pk) !== "ok") ? `（部分 ${cnt(g => bpOf(g.pk) === "incomplete")}・未取得 ${cnt(g => !["ok", "incomplete"].includes(bpOf(g.pk)))}）` : ""}</span>
      <span>盤口 <b class="num">0/${n}</b></span><span>天氣 <b class="num">0/${n}</b></span>
      <small>資料最後變動 ${D.generatedAtTW}</small></div>`;
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
      <div class="hints">${g.status.code === "final" ? "" : luTag(g.away) + luTag(g.home)}${bpTag(g.pk)}</div>
      <div class="cta"><span class="small">${esc(g.venue)}</span><a class="btn" href="game.html?pk=${g.pk}">查看比賽資料 →</a></div>
    </article>`;
  };
  document.addEventListener("click", e => { const b = e.target.closest("button[data-d],button[data-st]"); if (!b) return;
    if (b.dataset.d) state.day = b.dataset.d; if (b.dataset.st) state.status = b.dataset.st; draw(); });
  draw(); keepFresh(D, [], draw);
}

/* ================= 單場頁 ================= */
async function renderGame() {
  const pk = new URLSearchParams(location.search).get("pk");
  if (!/^\d+$/.test(pk || "")) { $("#hero").innerHTML = `<div class="empty">網址缺少 gamePk。<a href="./">回本日比賽</a></div>`; return; }
  let G; try { G = await load(`games/${pk}.json`); } catch (e) { $("#hero").innerHTML = `<div class="empty">找不到 gamePk ${esc(pk)} 的資料（${esc(e.message)}）。<a href="./">回本日比賽</a></div>`; return; }
  const D = { generatedAtTW: stamp(G.updatedAt) };
  const M = await load("manifest.json").catch(() => null);
  if (M) { const extra = M.days.some(d => d.date === G.twDate) ? [] : [["warn", `<b>這場不在目前的今天／明天賽程內</b>，本頁資料停在 ${D.generatedAtTW}，不再更新。`]];
    await freshness(M, extra); keepFresh(M, extra); }
  const B = await load(`bullpen/${pk}.json`).catch(() => null);
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
  const missing = `<section class="blk" id="na"><h2>本站尚未取得</h2><div class="panel"><p class="small">預估打線、盤口、天氣、主審、傷兵：試營運第一階段尚未接入，不以示範值填補。</p></div></section>`;
  $("#game").innerHTML = overview + pitchers + bullpen(B, G) + lineups + missing;
}

/* ================= 牛棚（scripts/bullpen.mjs 產出；規則見該檔） ================= */
const BPST = { off: "無賽程", ppd: "延賽", notstarted: "未開打", error: "整天未取得", other: "其他" };
const GST = { Postponed: "延賽", Scheduled: "未開打", "Pre-Game": "未開打", Warmup: "未開打", "In Progress": "進行中", Suspended: "暫停", Cancelled: "取消", Delayed: "延遲" };
const UNC = ["partial", "incomplete", "error", "other"];
function bpTable(t, name, side, T) {
  const days = t.days, last = days.length - 1, md = d => `${+d.slice(5, 7)}/${+d.slice(8)}`;
  const lab = i => i === last ? "本日・本場前" : i === last - 1 ? "昨天" : i === last - 2 ? "前天" : "";
  const head = days.map((d, i) => `<th class="${i >= last - 1 ? "hl" : ""}">${md(d.d)}<small>${lab(i)}</small></th>`).join("");
  const gms = days.map(d => `<td>${d.games.length ? d.games.map(g => `<a href="https://www.mlb.com/gameday/${g.pk}" rel="noopener">${d.games.length > 1 || (d.d === T.officialDate && T.dh !== "N") ? "G" + g.gameNumber + " " : ""}對${esc(g.opp)}</a>${["Final", "Game Over", "Completed Early"].includes(g.status) ? "" : `<span class="gs">${esc(GST[g.status] || g.status)}</span>`}${g.data === "missing" ? `<span class="miss">資料未取得</span>` : ""}`).join("<br>") : "—"}</td>`).join("");
  const sum = days.map(d => {
    if (d.rpPitches === null) return `<td class="st">${BPST[d.st] || esc(d.st)}</td>`;
    const who = `${d.rpApps} 人次・${d.rpPitchers} 人`, nc = d.rpAppsNoCount ? `<br>${d.rpAppsNoCount} 人次球數缺` : "";
    if (d.st === "incomplete") return `<td class="part"><b>≥${d.rpPitches}</b><small>部分小計<br>${d.gamesMissing}/${d.gamesExpected} 場未取得<br>${who}${nc}</small></td>`;
    return `<td><b>${d.rpAppsNoCount ? "≥" : ""}${d.rpPitches}</b><small>${d.st === "partial" ? "進行中・目前為止<br>" : ""}${who}${nc}</small></td>`;
  }).join("");
  const rows = t.pitchers.map(p => {
    const cells = days.map(d => { const e = p.days[d.d];
      if (!e) return UNC.includes(d.st) ? `<td class="unk" title="該日資料不完整，無法確認是否登板">?</td>` : `<td></td>`;
      const tag = [e.gameNumbers.length > 1 || d.games.length > 1 ? e.gameNumbers.map(n => "G" + n).join("+") : "", e.noCount ? (e.noCount === e.apps ? "球數缺" : `${e.noCount} 場球數缺`) : ""].filter(Boolean).join("・");
      return `<td class="n">${e.noCount === e.apps ? "登板" : e.pitches + (e.noCount ? "+" : "")}${tag ? `<small>${tag}</small>` : ""}</td>`; }).join("");
    const sk = p.streak ? `<span class="${p.streak >= 2 ? "s2" : "s1"}">${p.streak}${p.streakAtEdge || p.streakUncertain ? "+" : ""}</span>` : p.streakUncertain ? `<span class="sq">?</span>` : `<span class="s0">—</span>`;
    return `<tr class="${p.streak ? "recent" : ""}"><th scope="row">${esc(p.name || "（無姓名）")}</th>${cells}<td class="sk">${sk}</td></tr>`;
  }).join("") || `<tr><td colspan="${days.length + 2}" class="empty">這幾天沒有中繼投手登板紀錄</td></tr>`;
  return `<div class="bpt"><h3>${esc(name)}<span>${side}</span></h3><table class="bp">
    <thead><tr><th class="nm">中繼投手</th>${head}<th class="sk">連續</th></tr></thead>
    <tbody><tr class="gms"><th scope="row">比賽</th>${gms}<td></td></tr><tr class="sum"><th scope="row">牛棚合計</th>${sum}<td></td></tr>${rows}</tbody></table></div>`;
}
function bullpen(B, G) {
  const h = `<h2>牛棚近期使用 <small>本場開打前・中繼投手用球數${B?.fetchedAt ? `・資料取得 ${stamp(B.fetchedAt)}` : ""}</small></h2>`;
  if (!B) return `<section class="blk" id="bp">${h}<div class="panel"><p class="small">${NA()} 本場牛棚資料尚未產生。</p></div></section>`;
  if (B.status === "failed") return `<section class="blk" id="bp">${h}<div class="notice bad"><b>這場的牛棚資料這次沒有取得</b>（${esc(B.error)}）。下次自動更新會再試；不以 0 或舊資料代替。</div></section>`;
  const retry = B.retryFailedSince ? `<div class="notice warn"><b>這場牛棚自 ${stamp(B.retryFailedSince)} 起重抓失敗</b>（${esc(B.retryError || "")}）。以下仍是 ${stamp(B.fetchedAt)} 取得的資料，之後的登板不在表內。</div>` : "";
  const warn = retry + (B.status === "incomplete" ? `<div class="notice warn"><b>有比賽的 box score 沒有取得。</b>標「部分小計」的日子只含已取得的場次，不是當天完整合計；「?」＝那天資料不完整、無法確認有沒有登板；只在未取得場次登板的投手不會出現在表上。</div>` : "");
  return `<section class="blk" id="bp">${h}${warn}<div class="panel">
    ${bpTable(B.summary.away, G.away.name, "客隊", B.target)}${bpTable(B.summary.home, G.home.name, "主隊", B.target)}
    <ul class="bpnote">
      <li>日期＝美國賽程日。前三欄是本場之前的三個完整日；「本日」只算同一天比本場早開打的比賽（例如雙重賽 G1）。</li>
      <li>每場第一位登板者視為先發，不列入牛棚。格子＝用球數；空白＝那天資料完整且沒登板；<b>?</b>＝那天資料不完整，無法確認。</li>
      <li>人次＝登板次數（雙重賽兩場都投算 2）；人數＝不同投手數。<b>≥</b>＝有資料缺，實際只會更多。</li>
      <li>連續＝往回連續有登板的天數；<b>+</b>＝碰到表格最左邊或斷點那天資料不完整，可能更長。</li>
      <li>來源：MLB Stats API box score（點比賽可到 MLB Gameday 核對）。規則 ${esc(B.rules)}。</li>
    </ul></div></section>`;
}
