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
const luTag = t => { const st = t.lineup.state, f = t.failed?.lineup;
  if (st === "none" && f) return `<span class="tag late">${t.ab} 打線未取得（重抓失敗）</span>`;
  return (st === "late" ? `<span class="tag late">${t.ab} 臨場異動</span>` : st === "official" ? `<span class="tag ok">${t.ab} 官方打線已確認</span>` : st === "withdrawn" ? `<span class="tag late">${t.ab} 官方打線已撤回</span>` : `<span class="tag na">${t.ab} 官方打線未公布</span>`)
    + (f ? `<span class="tag late">${t.ab} 打線重抓失敗</span>` : ""); };
// 單項抓取失敗（scripts/build-live.mjs 的 failed）：沿用舊值時標原取得時間；沒有舊值就說清楚是空白、不是來源沒有
const FK = { lineup: "本場打線", sp: "先發投手成績", rec: "戰績", ops: "團隊 OPS", era: "全隊 ERA", prev: "上一場打線" };
const failNote = (t, keys) => keys.filter(k => t.failed?.[k]).map(k => { const f = t.failed[k];
  return `<div class="notice warn"><b>${esc(t.ab)} ${FK[k]}：自 ${stamp(f.since)} 起重抓失敗</b>（${esc(String(f.error).replace(/\s*https?:\S+/g, ""))}）。${f.fetchedAt ? `這裡仍是 ${stamp(f.fetchedAt)} 取得的版本，之後若來源有變動不在其中。` : "沒有先前取得的資料可用，這一項暫時空白，不代表來源沒有資料。"}</div>`; }).join("");
const spLine = sp => sp ? `<b>${esc(sp.name)}</b> ${hand(sp.hand)}${sp.s ? ` <span class="num">${sp.s.wl}・${sp.s.era}</span>` : ` <span class="tag na">本季無大聯盟成績</span>`}` : `<span class="tag na">先發未公布</span>`;
const noteTags = g => [g.dh && `雙重賽 ${g.dh}`, g.tbd && "開賽時間未定", g.rescheduledFrom && `補賽（原 ${g.rescheduledFrom.slice(5, 10)}）`, g.rescheduleDate && `改期至 ${g.rescheduleDate.slice(5, 10)}`].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join("");
async function load(f) { const r = await fetch(`./data/${f}?t=${Date.now()}`); if (!r.ok) throw new Error(`${f} HTTP ${r.status}`); return r.json(); }
const fail = (el, e) => { el.innerHTML = `<div class="empty">資料載入失敗（${esc(e.message)}），請稍後重新整理。</div>`; };

/* ================= 更新狀態：過期、失敗一定要看得出來 ================= */
// 資料沒變動時不 commit，manifest 的時間只代表「最後變動」；「最後檢查」要問 GitHub Actions 公開 API，問不到就只看資料時間
// 排程：台灣 21:00–11:59（賽前、比賽時段）由 Cloudflare 每 15 分鐘觸發、GitHub 排程備援；其他時段每 3 小時。警示門檻跟著時段走
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
    ? `<b>已過午夜，今天的賽程要等下一次自動更新成功後才會換上。</b>日期標籤已改用實際日期。`
    : `<b>資料還沒更新到今天。</b>資料裡的「今天」是 ${dayLabel(M.days[0].date)}，現在台灣日期是 ${dayLabel(today)}；日期標籤已改用實際日期。`]);
  if (last ? last.bad : S?.lastAttemptOk === false) { const url = last ? last.url : S.runUrl;
    msgs.push(["bad", `<b>最近一次自動更新執行失敗</b>（${stamp(last ? last.at : S.lastAttemptAt)}），目前顯示的是上一次成功取得的資料。${url ? `<a href="${esc(url)}" rel="noopener">執行紀錄</a>` : ""}`]); }
  msgs.push(...extra);
  msgs.unshift([late ? "warn" : "", (late ? "<b>資料較舊</b>：" : "") + (R
    ? `最近一次流程檢查成功 <b>${at}</b>（${ago(ageH)}）・頁面內容最後變動 ${M.generatedAtTW}・個別項目以各自的取得時間與狀態為準`
    : `頁面內容取得於 <b>${M.generatedAtTW}</b>（${ago(ageH)}）；目前連不到 GitHub，無法確認之後是否還有檢查`)
    + (late ? `。${dense() ? "賽前時段排定每 15 分鐘觸發一次（Cloudflare，GitHub 排程為備援）" : "原定每 3 小時取得一次"}，實際執行會有延遲，GitHub 排程有時會延遲數小時，這不代表已確認故障。` : `・${dense() ? "賽前時段排定每 15 分鐘自動取得（Cloudflare 觸發，GitHub 排程備援；實際會有延遲）" : "每 3 小時自動取得"}，內容有變才更新`)]);
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
  const todayD = D.days.find(d => d.key === "today");
  let auto = !qs.get("d") && todayD && !todayD.games.some(g => ["pre", "live"].includes(g.status.code)) && D.days.some(d => d.key === "tomorrow");
  const state = { day: qs.get("d") === "tomorrow" || auto ? "tomorrow" : "today", status: "all" };
  const F = [["all", "全部"], ["pre", "賽前"], ["live", "進行中"], ["final", "已結束"], ["off", "延期／取消"]];
  const dayEl = $("#days"), stEl = $("#status");
  const draw = () => {
    dayEl.innerHTML = D.days.map(d => `<button aria-pressed="${d.key === state.day}" data-d="${d.key}">${realDay(d)} ${dayLabel(d.date)}</button>`).join("");
    stEl.innerHTML = F.map(([k, v]) => `<button aria-pressed="${k === state.status}" data-st="${k}">${v}</button>`).join("");
    const day = D.days.find(d => d.key === state.day), all = day.games, n = all.length;
    const games = all.filter(g => state.status === "all" || (state.status === "off" ? ["ppd", "cxl", "susp"].includes(g.status.code) : g.status.code === state.status));
    $("#dayTitle").innerHTML = `${dayLabel(day.date)} MLB 比賽 <small>${n} 場・台灣時間</small>`;
    const cnt = f => all.filter(f).length, sides = all.flatMap(g => ["away", "home"].map(k => ({ ...g[k], pj: g.proj?.[k] || null })));
    const open = sides.filter(t => !["official", "late"].includes(t.lineup.state)), withP = open.filter(t => t.pj?.n);
    const ready = `<div class="ready"><b>資料完成度</b>
      <span>雙方預計先發 <b class="num">${cnt(g => g.away.sp && g.home.sp)}/${n}</b></span>
      <span>官方打線 <b class="num">${sides.filter(t => ["official", "late"].includes(t.lineup.state)).length}/${2 * n}</b> 隊</span>
      <span>上一場打線 <b class="num">${sides.filter(t => t.prev?.has).length}/${2 * n}</b> 隊</span>
      <span>牛棚 <b class="num">${cnt(g => bpOf(g.pk) === "ok")}/${n}</b>${cnt(g => bpOf(g.pk) !== "ok") ? `（部分 ${cnt(g => bpOf(g.pk) === "incomplete")}・未取得 ${cnt(g => !["ok", "incomplete"].includes(bpOf(g.pk)))}）` : ""}</span>
      <span>預估打線（非官方） <b class="num">${withP.length}/${open.length}</b> 隊<small>（官方未公布的隊伍中；兩站人選全同 ${withP.filter(t => t.pj.cc && t.pj.cc.people === t.pj.cc.n).length}・人選有差 ${withP.filter(t => t.pj.cc && t.pj.cc.people < t.pj.cc.n).length}・單一來源 ${withP.filter(t => !t.pj.cc).length}）</small></span>
      <span>天氣 官方 <b class="num">${cnt(g => g.weather)}/${n}</b>・預報 <b class="num">${cnt(g => !g.weather && g.forecast)}/${n}</b>${cnt(g => !g.weather && !g.forecast) ? `・都沒有 ${cnt(g => !g.weather && !g.forecast)}` : ""}</span>
      <span>盤口 <b class="num">0/${n}</b></span>
      <small>資料最後變動 ${D.generatedAtTW}</small></div>`;
    const autoNote = auto && state.day === "tomorrow" ? `<div class="notice">今天${todayD.games.length ? "的比賽都已結束或取消" : "沒有 MLB 比賽"}，先顯示<b>明天</b>；要看今天請按上方「今天」。</div>` : "";
    $("#games").innerHTML = autoNote + ready + (games.length ? games.map(card).join("") : `<div class="empty">${n ? "此篩選條件下沒有比賽。" : "這一天沒有 MLB 比賽。"}</div>`);
  };
  const card = g => {
    const sc = ["final", "live"].includes(g.status.code);
    const team = t => `<div class="trow"><span class="logo" aria-hidden="true">${esc(t.ab)}</span>
      <span class="tname">${esc(t.name)}<em class="num">${t.rec || ""}</em>${sc && t.score != null ? `<span class="score">${t.score}</span>` : ""}</span>
      <span class="sp">${spLine(t.sp)}</span></div>`;
    return `<article class="card">
      <div class="meta"><span><b>${g.twTime || "時間未定"}</b> ${noteTags(g)}</span><span>${statusTag(g)}</span></div>
      ${team(g.away)}${team(g.home)}
      <div class="hints">${g.status.code === "final" ? "" : luTag(g.away) + luTag(g.home)}${projTag(g, "away") + projTag(g, "home")}${bpTag(g.pk)}${wxTag(g)}${[g.away, g.home].some(t => Object.keys(t.failed || {}).some(k => k !== "lineup")) || g.failed ? `<span class="tag late">部分資料重抓失敗，沿用舊值</span>` : ""}</div>
      <div class="cta"><span class="small">${esc(g.venue)}</span><a class="btn" href="game.html?pk=${g.pk}">查看比賽資料 →</a></div>
    </article>`;
  };
  const projTag = (g, k) => { const p = g.proj?.[k]; if (!p) return "";
    if (p.vs) return `<span class="tag">${g[k].ab} 預估 vs 官方：人選 ${p.vs.people}/${p.vs.n}・棒次 ${p.vs.order}/${p.vs.n}</span>`;
    if (["official", "late"].includes(g[k].lineup.state) || g.status.code !== "pre") return "";
    if (p.sourceStatusKey === "confirmed") return `<span class="tag ok">${g[k].ab} RotoWire 已確認名單（非 MLB 官方）</span>`;
    return `<span class="tag exp">${g[k].ab} 預估 ${p.n} 人${p.cc ? `・兩站人選 ${p.cc.people}/${p.cc.n}、棒次 ${p.cc.order}/${p.cc.n} 相同` : "・僅單一來源"}</span>`; };
  const wxTag = g => g.weather ? `<span class="tag">天氣：MLB 官方</span>` : g.forecast ? `<span class="tag">天氣：模型預報</span>` : "";
  document.addEventListener("click", e => { const b = e.target.closest("button[data-d],button[data-st]"); if (!b) return;
    if (b.dataset.d) { state.day = b.dataset.d; auto = false; history.replaceState(null, "", `?d=${state.day}`); } if (b.dataset.st) state.status = b.dataset.st; draw(); });
  draw(); keepFresh(D, [], draw);
}

/* ================= 提前預估打線（data/proj/sources.json：來源有就先存，不管是否已進首頁今天／明天） ================= */
const etToTW = (date, t) => { const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t || ""); if (!m) return null;
  const h = (+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0), tz = new Date(`${date}T16:00:00Z`).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" }).includes("EST") ? 5 : 4;
  return new Date(Date.parse(`${date}T${String(h).padStart(2, "0")}:${m[2]}:00Z`) + tz * 36e5).toISOString(); };
async function renderProj() {
  let S; try { S = await load("proj/sources.json"); } catch (e) { return fail($("#games"), e); }
  const T = S.teams || {}, games = new Map();
  for (const [k, e] of Object.entries(T)) { if (e.source !== "RotoWire") continue; const gk = k.split("|").slice(0, 3).join("|"); (games.get(gk) || games.set(gk, { date: e.date, game: e.game || k.split("|")[2], time: e.time, sides: {} }).get(gk)).sides[e.side || k.split("|")[3]] = e; }
  const rgOf = (e, side) => T[`RotoGrinders|${e.date}|${e.game}|${side}`];
  const list = [...games.values()].sort((a, b) => (etToTW(a.date, a.time) || a.date).localeCompare(etToTW(b.date, b.time) || b.date)).filter(g => { const st = etToTW(g.date, g.time); return !st || Date.parse(st) > Date.now() - 6 * 36e5; });
  const team = (g, side) => { const e = g.sides[side], ab = g.game.split("@")[side === "away" ? 0 : 1];
    if (!e || !e.versions?.length) return `<div class="panel"><div class="lhead"><b>${esc(ab)}</b> <span class="tag na">來源還沒提供 9 人名單</span></div><p class="small">RotoWire 目前列 ${e?.n ?? 0} 人（本站最後檢查 ${stamp(e?.fetchedAt) || "—"}）。這是來源沒提供，不是本站漏抓。</p></div>`;
    const v = e.versions.at(-1), f = e.versions[0], st = etToTW(g.date, g.time), before = at => st ? dur(Math.round((Date.parse(st) - Date.parse(at)) / 6e4)) : "表定時間未知";
    const rg = rgOf(g, side)?.versions?.at(-1), c = rg ? cmpC(rg.slots, v.slots) : null;
    return `<div class="panel"><div class="lhead"><b>${esc(ab)}</b> ${v.statusKey === "confirmed" ? `<span class="tag ok">RotoWire 已確認名單（非 MLB 官方）</span>` : `<span class="tag exp">RotoWire 預估（非官方）</span>`}</div>
      <div class="lmeta"><span>第一份完整名單存下：<b>${stamp(f.at)}</b>（${before(f.at)}）</span>${e.noListBefore ? `<span>更早在 ${stamp(e.noListBefore)} 看到來源已有名單，但那時只記時間、沒存名單</span>` : ""}
      <span>目前這版：${stamp(v.at)} 起・共 ${e.versions.length} 版・最後檢查 ${stamp(e.fetchedAt)}</span><span>${c ? `RotoGrinders 同隊：人選 ${c.people}/${c.n}、棒次 ${c.order}/${c.n} 相同` : "RotoGrinders 還沒有這場（只有當天頁），目前無法比對"}</span></div>
      <table class="tbl lu"><tbody>${v.slots.map(x => `<tr><td class="n">${x.n}</td><td class="l">${esc(x.name)}</td><td>${esc(x.pos || "—")}</td><td>${BATS[x.bats] || "—"}</td></tr>`).join("")}</tbody></table></div>`; };
  $("#dayTitle").innerHTML = `提前預估打線 <small>來源有就先存；共 ${list.length} 場</small>`;
  $("#games").innerHTML = list.length ? list.map(g => { const any = Object.values(g.sides).find(e => e.pk), st = etToTW(g.date, g.time);
    return `<section class="blk"><h2>${esc(g.game.replace("@", " @ "))} <small>美東 ${esc(g.date)} ${esc(g.time || "")}${st ? `・台灣 ${stamp(st)}` : ""}</small></h2>
      <p class="small">${any ? `已進首頁今天／明天：<a href="game.html?pk=${any.pk}">看單場頁</a>（本站 ${stamp(any.inScopeAt)} 對到這場）` : "還沒進首頁今天／明天的範圍；名單已先存，這裡先看。"}</p>
      <div class="two">${team(g, "away")}${team(g, "home")}</div></section>`; }).join("") : `<div class="empty">目前來源頁上沒有未開賽的比賽。</div>`;
  $("#foot").innerHTML = `來源：RotoWire daily-lineups（今天＋明天頁，美東日期），RotoGrinders（只有當天）。時間都是本站看到的時間（台灣時間），不是來源發布時刻；不知道 MLB 官方何時公布。兩站一致不等於官方確認，分歧也不代表哪站錯。資料檔：data/proj/sources.json（${esc(S.rules)}）。`;
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
  const C = await load(`ctx/${pk}.json`).catch(() => null);
  const MU = await load(`matchup/${pk}.json`).catch(() => null);
  const A = G.away, H = G.home;
  document.title = `運彩 101｜${A.name} @ ${H.name}（${dayLabel(G.twDate)}）`;
  $("#crumb").innerHTML = `<a href="./${M?.days.find(d => d.date === G.twDate)?.key === "tomorrow" ? "?d=tomorrow" : ""}">← 本日比賽</a>　MLB　${dayLabel(G.twDate)}　gamePk ${G.pk}`;
  const sc = ["final", "live"].includes(G.status.code);
  $("#hero").innerHTML = `
    <div class="vs">
      <div><div class="ab">${esc(A.ab)}</div><div class="nm">${esc(A.name)}</div><div class="rc num">${A.rec || ""}・客隊</div></div>
      <div class="at">${sc ? `<span class="num">${A.score ?? "-"} : ${H.score ?? "-"}</span>` : "@"}</div>
      <div><div class="ab">${esc(H.ab)}</div><div class="nm">${esc(H.name)}</div><div class="rc num">${H.rec || ""}・主隊</div></div>
    </div>
    <div class="facts">
      <span>表定開賽 <b class="num">${G.twTime || "時間未定"}</b> 台灣時間${G.localTime ? `（球場當地 <b class="num">${esc(G.localTime)}</b>）` : ""}</span>
      <span>球場 <b>${esc(G.venue)}</b></span>
      <span>狀態 ${statusTag(G)} ${noteTags(G)}</span>
      <span>距表定開賽 <b class="num" id="countdown">—</b></span>
      <span>天氣 ${wxLine(G.weather, G.forecast)}</span>
      <span>資料更新 <b class="num">${D.generatedAtTW}</b></span>
    </div>${G.failed?.game ? `<div class="notice warn"><b>這場自 ${stamp(G.failed.game.since)} 起整理失敗</b>，以下是 ${stamp(G.failed.game.fetchedAt)} 的版本（比分與狀態除外）。</div>` : ""}`;
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
    </div>${failNote(A, ["rec", "ops", "era"])}${failNote(H, ["rec", "ops", "era"])}</section>`;

  const pit = t => { const p = t.sp; if (!p) return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${NA("先發未公布")}</div></div>`;
    const s = p.s, cell = (k, x) => `<div><span class="v num">${x ?? "—"}</span><span class="t">${k}</span></div>`;
    return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(p.name)}</b> ${hand(p.hand)} <span class="tag exp">預計</span></div>${failNote(t, ["sp"])}
      <div class="lmeta"><span>本站首次看到：<b>${stamp(p.firstSeen) || "—"}</b></span></div>
      ${s ? `<div class="stats">${cell("勝-敗", s.wl)}${cell("ERA", s.era)}${cell("WHIP", s.whip)}${cell("局數", s.ip)}${cell("先發", s.gs)}${cell("三振", s.so)}${cell("保送", s.bb)}</div><p class="small">2026 大聯盟例行賽（被交易者為全季合計）</p>` : `<p class="small">${NA("本季無大聯盟成績")}（3A 等小聯盟成績本站尚未取得）</p>`}
    </div>`; };
  const pitchers = `<section class="blk" id="sp"><h2>先發投手 <small>MLB 官方預計先發</small></h2><div class="two">${pit(A)}${pit(H)}</div></section>`;

  const table = slots => `<table class="tbl lu"><thead><tr><th>棒</th><th class="l">球員</th><th>守位</th><th>AVG</th><th>OPS</th></tr></thead><tbody>${slots.map(x => `<tr><td class="n">${x.n}</td><td class="l">${esc(x.name)}</td><td>${esc(x.pos || "—")}</td><td class="num">${x.avg ?? "—"}</td><td class="num">${x.ops ?? "—"}</td></tr>`).join("")}</tbody></table>`;
  const prevBlock = t => failNote(t, ["prev"]) + (t.prev?.slots ? `<p class="small">上一場：${t.prev.date.slice(5)} ${t.prev.ha}場對 ${esc(t.prev.opp)}（${t.prev.score}），<a href="https://www.mlb.com/gameday/${t.prev.pk}" rel="noopener">官方比賽紀錄</a></p>${table(t.prev.slots)}` : `<p class="small">${NA()} ${t.prev ? "上一場打線沒有取得。" : "找不到近 12 天內已完賽的上一場。"}</p>`);
  const lu = (t, k) => { const L = t.lineup, P = G.proj?.[k];
    if (L.slots) return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${luTag(t)}</div>${failNote(t, ["lineup"])}
      <div class="lmeta"><span>本站首次看到官方打線：<b>${stamp(L.firstSeen) || "—"}</b></span>${L.lateAt ? `<span>偵測到臨場異動：<b>${stamp(L.lateAt)}</b></span>` : ""}</div>
      ${table(L.slots)}${P ? `${vsBlock(P, G)}<details><summary class="small">官方公布前本站記下的最後一版預估（非官方）</summary>${projBlock(P, G)}</details>` : ""}<details><summary class="small">上一場官方打線（參考）</summary>${prevBlock(t)}</details></div>`;
    if (P) return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${luTag(t)} <span class="tag exp">預估（非官方）</span></div>${failNote(t, ["lineup"])}
      ${projBlock(P, G)}<details><summary class="small">上一場官方打線（參考，不是本場預估）</summary>${prevBlock(t)}</details></div>`;
    const why = L.state === "withdrawn" ? `MLB 官方先前公布的本場打線，本站 <b>${stamp(L.withdrawnAt)}</b> 檢查時已從官方資料撤下（官方回應正常、內容已沒有打線，不是本站抓取失敗）。`
      : t.failed?.lineup ? "這次沒有取得本場打線，無法確認官方是否已公布。" : "MLB 官方尚未公布本場打線。";
    return `<div class="panel"><div class="lhead"><b>${t.ab} ${esc(t.name)}</b> ${luTag(t)}</div>${failNote(t, ["lineup"])}
      ${G.proj && G.status.code === "pre" ? `<p class="small">預估打線：RotoWire 目前沒有這隊的預估（本站最後檢查 ${stamp(G.proj.fetchedAt) || "—"}）。這是來源還沒提供，不是本站漏抓。</p>` : ""}
      <p class="small">${why}以下為<b>上一場官方打線</b>，僅供參考，不是本場預估。</p>${prevBlock(t)}</div>`; };
  const lineups = `<section class="blk" id="lu"><h2>打線 <small>官方打線 AVG／OPS 為 2026 本季；預估打線是第三方預測，不是官方</small></h2><div class="two">${lu(A, "away")}${lu(H, "home")}</div></section>`;
  const missing = `<section class="blk" id="na"><h2>本站尚未取得</h2><div class="panel"><p class="small">盤口、主審、傷兵：尚未接入，不以示範值填補。</p><p class="small">已接入但有條件：天氣（MLB 官方開賽前幾小時才有，更早用模型預報，表定開賽前 48 小時內）、預估打線（第三方預測，非官方；來源當天有提供才有）。</p></div></section>`;
  $("#game").innerHTML = overview + wxSection(G) + pitchers + muSection(MU, G) + ctxSection(C, G) + bullpen(B, G) + lineups + missing;
}

/* ================= 先發 × 對方打線（scripts/matchup.mjs；今天／明天賽前比賽） ================= */
// 打線版本簽章：和 scripts/matchup.mjs lineupSig 同一套規則；卡片記下的 basis 和目前單場資料不同＝卡片還是舊版本
const lineupSig = (g, side) => { const L = g[side]?.lineup, P = g.proj?.[side];
  if (["official", "late"].includes(L?.state) && L.slots?.length) return `official:${L.slots.map(x => x.id).join(",")}`;
  if (P?.slots?.length) return `proj:${P.sourceStatusKey || ""}:${P.slots.map(x => x.name).join(",")}`;
  return "none"; };
const GT = { R: "", F: "外卡賽", D: "分區賽", L: "聯盟冠軍賽", W: "世界大賽" };
function muSection(MU, G) {
  if (!MU?.pairs) return G.status.code === "pre" ? `<section class="blk" id="mu"><h2>先發 × 對方打線</h2><div class="panel"><p class="small">這場的對位卡還沒有產生（可能是剛進今天／明天範圍，或這次計算失敗），下次更新會再算。</p></div></section>` : "";
  const mdd = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`, BK = { L: "左", R: "右", S: "開", U: "?" };
  const pair = p => {
    const t = G[p.pitcherSide], bt = G[p.battingSide], B = p.basis;
    // 舊版本：先發換人、打線換版本（預估改版、預估變官方、官方臨場異動）但這次重算沒成功
    const spNow = t.sp?.id ?? null, luNow = lineupSig(G, p.battingSide), what = [];
    if (B && B.sp !== spNow) what.push(`先發${spNow ? `已是 ${esc(t.sp.name)}` : "目前未公布"}`);
    if (B && B.lineup !== luNow) what.push(`${esc(bt.ab)} 打線已有新版本（${luNow.startsWith("official") ? "MLB 官方打線" : luNow.startsWith("proj") ? "預估打線更新" : "目前沒有打線"}）`);
    const stale = what.length && G.status.code === "pre" ? `<div class="notice warn"><b>這張卡還是 ${stamp(MU.fetchedAt)} 的舊版本</b>：${what.join("；")}，這次重算沒有成功，下次更新再算。</div>` : "";
    if (!p.pitcher) return `<div class="panel mu"><div class="lhead"><b>${esc(p.ab)} 先發</b> ${NA("先發未公布")}</div>${stale}<p class="small">先發公布後，下次更新會算這張卡（對 ${esc(bt.ab)} ${esc(bt.name)}打線）。</p></div>`;
    const lu = p.lineup, sw = lu && lu.comp.S.length && ["L", "R"].includes(p.pitcher.hand);
    const hl = p.focus || "";
    const row = (k, x, nEff) => `<div class="mur${hl === k ? " hl" : ""}"><span class="k">對${k === "L" ? "左" : "右"}打${lu && p.eff ? `<small>${sw ? `依通常站位估算約 ${nEff} 人` : `打線${k === "L" ? "左" : "右"}打 ${nEff} 人`}</small>` : ""}</span>
      ${x ? `<span class="bar"><i style="width:${Math.min(100, +x.ops * 100)}%"></i></span><b class="num">${x.ops}</b><small>${x.pa} 打席</small>` : `<span class="bar"></span>${NA("沒有有效數字")}<small></small>`}</div>`;
    const c = lu?.comp, chips = lu ? `<div class="lus" aria-label="打線 1–9 棒打擊側">${lu.slots.map(x => { const k = ["L", "R", "S"].includes(x.bats) ? x.bats : "U";
      return `<span class="chip ${k}" title="${esc(x.name)}"><b>${x.n}</b>${BK[k]}</span>`; }).join("")}</div>
      <p class="small">打線：${esc(lu.label)}（${lu.source.startsWith("proj") ? "本站取得" : "本站首次看到"} ${stamp(lu.at) || "—"}）・1–9 棒：左打 ${c.L.length}、右打 ${c.R.length}、左右開弓 ${c.S.length}、打擊側未知 ${c.U.length}${c.n < 9 ? `（名單只有 ${c.n} 人）` : ""}。${c.S.length ? (sw ? `左右開弓依通常站位估算：面對${p.pitcher.hand === "R" ? "右投站左" : "左投站右"}打席（賽前估算，不是這場已確認的站位）。` : "先發慣用手未知，左右開弓無法估算站位。") : ""}${c.U.length ? "打擊側未知的不計入左右。" : ""}</p>`
      : `<p class="small">${esc(bt.name)}打線：MLB 官方尚未公布，也沒有預估名單。</p>`;
    const rs = p.recent.starts;
    const recent = `<table class="tbl mut"><thead><tr><th class="l">最近${rs.length ? ` ${rs.length} 次` : ""}先發<small>美國日期；不含中繼登板</small></th><th>局數</th><th>用球</th><th>自責分</th></tr></thead><tbody>
      ${rs.slice().reverse().map(x => `<tr><td class="l">${mdd(x.date)} ${x.ha}場對${esc(x.opp || "—")}${GT[x.gameType] ? `<small>${GT[x.gameType]}</small>` : ""}</td><td class="num">${x.ip ?? "—"}</td><td class="num">${x.np ?? "—"}</td><td class="num">${x.er ?? "—"}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">${p.recent.totalApps ? `本季沒有先發紀錄（登板 ${p.recent.totalApps} 次都是後援）` : p.recent.totalApps === 0 ? "查不到本季大聯盟登板紀錄" : "本季沒有先發紀錄"}</td></tr>`}</tbody></table>
      ${p.recentNote ? `<p class="small">${esc(p.recentNote)}</p>` : ""}`;
    return `<div class="panel mu"><div class="lhead"><b>${esc(p.pitcher.ab)} ${esc(p.pitcher.name)}</b> ${hand(p.pitcher.hand)} <span class="small">× ${esc(bt.ab)} ${esc(bt.name)}打線</span>
      ${lu ? (lu.source.startsWith("proj") ? `<span class="tag exp">${lu.source === "proj-confirmed" ? "RotoWire 確認名單（非官方）" : "預估打線（非官方）"}</span>` : `<span class="tag ok">官方打線</span>`) : ""}</div>${stale}
      <div class="muobs">${p.obs.map(x => `<p>${esc(x)}</p>`).join("")}</div>
      <div class="mug"><p class="small">被打 OPS（${esc(p.splitScope)}，按那個打席站哪一邊算）</p>${row("L", p.splits.vl, p.eff?.L)}${row("R", p.splits.vr, p.eff?.R)}<p class="small">這是本季分項紀錄（含他本季所有登板），請連同打席數閱讀，不宜單憑分項高低推定本場表現。</p></div>
      ${chips}${recent}</div>`;
  };
  return `<section class="blk" id="mu"><h2>先發 × 對方打線 <small>${G.status.code === "pre" ? "賽前每次更新重算" : "開賽後保留最後一次賽前計算"}・計算於 ${stamp(MU.fetchedAt)}</small></h2>
    <div class="two">${MU.pairs.map(pair).join("")}</div>
    <p class="small">資料：MLB 官方 Stats API（先發分項、最近先發、官方打線打擊側）；預估打線來自 RotoWire（非官方）。觀察句由固定規則產生（${esc(MU.rules)}）：只說明今天打線對應哪個分項與最近先發長短，不判斷哪隊有利，也不推測投得短的原因。閱讀提示的暫定條件：9 人中至少 6 人站同一邊才指出先看哪個分項；最近一次先發比前兩次都少至少 2 局才註記。沒有有效數字的欄位不比較。OPS＝上壘率＋長打率，長條以 1.000 為滿格。</p></section>`;
}

/* ================= 預估打線（非官方；scripts/lineup-proj.mjs） ================= */
const dur = m => m == null ? "開賽時間未定" : m <= 0 ? "已過表定開賽" : `距表定開賽 ${Math.floor(m / 60)} 小時 ${String(m % 60).padStart(2, "0")} 分`;
const BATS = { R: "右", L: "左", S: "左右開弓" };
// 名字比對鍵（和 scripts/lineup-proj.mjs pkey 相同）：名字首字母＋姓
const pkey = x => { const w = (x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,']/g, "").split(/\s+/).filter(y => y && !/^(jr|sr|ii|iii|iv)$/.test(y)); return w.length ? w[0][0] + w.at(-1).replace(/[^a-z]/g, "") : ""; };
const minsTo = (G, iso) => G.tbd || !G.startUTC ? null : Math.round((Date.parse(G.startUTC) - Date.parse(iso)) / 6e4);
const ccOf = P => P.crossCmp || (P.cross ? { people: P.slots.filter(s => s.check === "same" || s.altAt).length, order: P.slots.filter(s => s.check === "same").length, n: P.slots.length } : null);
function projBlock(P, G) {
  const chk = s => s.check === "same" ? `<span class="small">一致</span>`
    : s.check === "diff" && s.altAt ? `<span class="tag">棒次不同</span><br><span class="small">另一站把他排第 ${s.altAt} 棒</span>`
    : s.check === "diff" ? `<span class="tag late">人選不同</span><br><span class="small">另一站這棒是 ${s.alt ? esc(s.alt) : "空白"}，名單裡沒有他</span>` : `<span class="small">—</span>`;
  const cc = ccOf(P), ord = P.slots.filter(s => s.check === "diff" && s.altAt).map(s => s.n), who = P.slots.filter(s => s.check === "diff" && !s.altAt).map(s => s.n);
  const sum = !cc ? `只有 ${esc(P.source)} 一個來源，無法比對；照常提供，不等第二個來源。`
    : `<b>兩站比對：人選 ${cc.people}/${cc.n} 相同、棒次 ${cc.order}/${cc.n} 相同</b>${ord.length ? `；第 ${ord.join("、")} 棒是同一批人換了棒次` : ""}${who.length ? `；第 ${who.join("、")} 棒兩站排了不同的人` : ""}。兩站一致不等於官方確認，分歧也不代表哪一站錯。`;
  const F = P.first, same1 = F && F.at === P.changedAt;
  return `${P.sourceStatusKey === "confirmed" ? `<div class="notice">${esc(P.source)} 標示這份是 <b>Confirmed Lineup</b>（第三方已確認名單），不是預估${P.frozenAt ? "" : "；MLB 官方名單本站還沒取得"}。</div>` : ""}<div class="lmeta"><span>來源：<b>${esc(P.source)}</b>（來源標示：${esc(P.sourceStatus || "—")}）${P.cross ? `，逐棒比對 <b>${esc(P.cross)}</b>` : ""}</span>
      <span>本站首次取得：<b>${stamp(P.firstSeen)}</b>（${dur(minsTo(G, P.firstSeen))}）</span>
      <span>${same1 ? "名單從首次取得後沒有變動" : `名單最後變動：<b>${stamp(P.changedAt)}</b>`}・最後檢查 ${stamp(P.fetchedAt) || "—"}</span></div>
    ${P.retryFailedSince ? `<div class="notice warn">自 ${stamp(P.retryFailedSince)} 起重抓 ${esc(P.source)} 失敗，這是 ${stamp(P.fetchedAt)} 取得的版本。</div>` : ""}
    ${P.missingSince ? `<div class="notice warn">${esc(P.source)} 自 ${stamp(P.missingSince)} 起已沒有這隊的預估，以下是先前的版本。</div>` : ""}
    ${P.frozenAt ? `<p class="small">官方打線已公布或比賽已開始（本站 ${stamp(P.frozenAt)} 起停止更新預估）。以下是官方公布前最後一版。</p>` : ""}
    <p class="small">${sum}</p>
    <table class="tbl lu pj"><thead><tr><th>棒</th><th class="l">球員</th><th>守位</th><th>打</th><th class="l">和 ${esc(P.cross || "第二來源")} 比對</th></tr></thead><tbody>${P.slots.map(s => `<tr${s.check === "diff" && !s.altAt ? ` class="unc"` : ""}><td class="n">${s.n}</td><td class="l">${esc(s.name)}</td><td>${esc(s.pos || "—")}</td><td>${BATS[s.bats] || "—"}</td><td class="l">${chk(s)}</td></tr>`).join("")}</tbody></table>
    ${P.slots.length < 9 ? `<p class="small">來源目前只列 ${P.slots.length} 棒。</p>` : ""}
    ${F && !same1 ? `<details><summary class="small">首份完整預估（${stamp(F.at)}，${dur(minsTo(G, F.at))}）</summary><p class="small">${F.slots.map(s => `${s.n}. ${esc(s.name)}`).join("　")}</p></details>` : ""}
    ${versionsBlock(P, G)}`;
}

// 預估 vs 官方：官方名單以本站第一次看到的版本為基準；之後的臨場異動另列，不改基準
const STK = k => k === "confirmed" ? "Confirmed（來源標示已確認）" : k === "expected" ? "Expected（預估）" : "來源標示未記";
const verAt = (P, at) => (P.versions || []).find(v => v.at === at);
function vsBlock(P, G) {
  const O = P.official; if (!O) return "";
  const V = P.vsOfficial || {}, line = (c) => c ? `人選 <b>${c.people}/${c.n}</b>、棒次 <b>${c.order}/${c.n}</b> 與官方相同` : "—";
  // 每格寫該版在這一棒排的人，再標他在官方名單的位置
  const mark = (list, x) => { if (!list) return `<td class="l">—</td>`; const y = list.find(z => z.n === x.n); if (!y) return `<td class="l">—</td>`;
    if (pkey(y.name) === pkey(x.name)) return `<td class="l">${esc(y.name)} <span class="small">✓</span></td>`;
    const at = O.slots.find(z => pkey(z.name) === pkey(y.name));
    return `<td class="l">${esc(y.name)}<br>${at ? `<span class="small">棒次不同：官方排第 ${at.n} 棒</span>` : `<span class="tag late">人選不同</span> <span class="small">未列官方先發</span>`}</td>`; };
  const L2 = P.officialLate, ko = new Set(O.slots.map(x => pkey(x.name))), kl = new Set((L2?.slots || []).map(x => pkey(x.name)));
  const lateDiff = L2 ? [...O.slots.filter(x => !kl.has(pkey(x.name))).map(x => `${esc(x.name)} 退出`), ...L2.slots.filter(x => !ko.has(pkey(x.name))).map(x => `${esc(x.name)} 加入（第 ${x.n} 棒）`),
    ...(() => { const m = L2.slots.filter(x => ko.has(pkey(x.name)) && pkey(O.slots.find(y => y.n === x.n)?.name) !== pkey(x.name)).length; return m ? [`${m} 棒棒次調整`] : []; })()] : [];
  const Fv = V.first && (verAt(P, V.first.at) || (P.first?.at === V.first.at ? P.first : null)), Lv = V.last && (verAt(P, V.last.at) || (V.last.at === P.first?.at ? P.first : { slots: P.slots })), Cv = V.confirmed && verAt(P, V.confirmed.at);
  const same = V.first && V.last && V.first.at === V.last.at;
  return `<div class="vsbox"><b>預估 vs 官方</b>（官方基準＝本站 ${stamp(O.at)} 第一次看到的官方名單；不知道官方真正公布時刻，只用本站首次取得時間${O.capturedAfterLate ? "；本站第一次記到時已是臨場異動後的版本" : ""}）
    <p class="small"><b>預估的對照表現</b>（只算來源標示 Expected 的版本）</p><ul class="small">
      <li>首份完整預估（${V.first ? `${stamp(V.first.at)} 存下，${dur(minsTo(G, V.first.at))}` : "沒有可用的首份（舊紀錄名單改過或來源一開始就標示已確認）"}）：${line(V.first)}</li>
      <li>官方公布前最後一版預估（${V.last ? same ? "和首份是同一版，之後沒有其他預估版本" : `${stamp(V.last.at)} 存下的版本` : "—"}）：${line(V.last)}</li>
    </ul>
    ${V.confirmed ? `<p class="small"><b>第三方已確認名單</b>（不算預估表現）：${esc(P.source)} 標示 Confirmed Lineup 的版本，本站 ${stamp(V.confirmed.at)} 看到，比本站首次取得 MLB 官方名單早 ${V.confirmed.leadMinutes} 分鐘；${line(V.confirmed)}。</p>` : ""}
    ${L2 ? `<p class="small">官方確認後的臨場異動（${stamp(L2.at)}）：${lateDiff.join("、") || "只換守位"}。上面的對照仍以第一次看到的官方名單為準。</p>` : ""}
    <details><summary class="small">逐棒對照</summary><table class="tbl lu"><thead><tr><th>棒</th><th class="l">官方（基準）</th><th class="l">首份預估這棒</th><th class="l">最後一版預估這棒</th>${Cv ? `<th class="l">第三方確認名單這棒</th>` : ""}</tr></thead><tbody>${O.slots.map(x => `<tr><td class="n">${x.n}</td><td class="l">${esc(x.name)}</td>${mark(Fv?.slots, x)}${mark(Lv?.slots, x)}${Cv ? mark(Cv.slots, x) : ""}</tr>`).join("")}</tbody></table></details></div>`;
}
// 本站保存的每一版名單（時間＝本站看到的時間，不是來源發布時刻）
function versionsBlock(P, G) {
  const L = P.versions || []; if (!L.length) return "";
  return `<details><summary class="small">本站保存的名單版本（${L.length} 版）</summary><table class="tbl lu"><thead><tr><th class="l">本站看到</th><th class="l">來源標示</th><th class="l">和前一版比</th></tr></thead><tbody>${L.map((v, i) => { const p = L[i - 1], c = p ? { ...(cmpC(p.slots, v.slots)) } : null;
    return `<tr><td class="l">${stamp(v.at)}（${dur(minsTo(G, v.at))}）${v.backfill ? `<br><span class="small">由 git ${esc(v.backfill)} 回補</span>` : ""}</td><td class="l">${STK(v.statusKey)}</td><td class="l">${c ? `人選 ${c.people}/${c.n}、棒次 ${c.order}/${c.n} 相同` : "第一版"}</td></tr>`; }).join("")}</tbody></table>
    ${P.sourceSeenNoListAt ? `<p class="small">另外：本站在 ${stamp(P.sourceSeenNoListAt)} 已看到來源有這隊 9 人名單，但當時的版本（v0.2）只記時間、沒存名單，所以不列為首份。</p>` : ""}</details>`;
}
const cmpC = (a, b) => { const ka = new Set(a.map(x => pkey(x.name))), at = new Map(a.map(x => [x.n, pkey(x.name)])); return { people: b.filter(x => ka.has(pkey(x.name))).length, order: b.filter(x => at.get(x.n) === pkey(x.name)).length, n: b.length }; };

/* ================= 球場天氣與風向圖：只呈現資料，不做有利／不利判斷 ================= */
const REL_DEG = { "Out To CF": 0, "Out To RF": 45, "L To R": 90, "In From LF": 135, "In From CF": 180, "In From RF": -135, "R To L": -90, "Out To LF": -45 };
const ROOF = { Open: "開放式球場", Retractable: "可開闔屋頂（開或關以官方為準，關頂時場內沒有風）", Dome: "室內球場（場內沒有風）" };
// 俯視圖：本壘在下、中外野在上；箭頭指向風吹去的方向，角度相對「本壘→中外野」順時針
function windFig(deg, faded) {
  const arrow = deg == null ? "" : `<g transform="rotate(${deg},100,98)" opacity="${faded ? .35 : 1}"><line x1="100" y1="136" x2="100" y2="66" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/><polygon points="100,52 91,70 109,70" fill="var(--accent)"/></g>`;
  return `<svg class="wxfig" viewBox="0 0 200 172" role="img" aria-label="球場俯視風向圖"><path d="M100 152 L15.1 67.1 A120 120 0 0 1 184.9 67.1 Z" fill="var(--sunk)" stroke="var(--line)"/>
    <path d="M100 152 L132 120 L100 88 L68 120 Z" fill="none" stroke="var(--muted)" stroke-opacity=".6"/>${arrow}
    <text x="100" y="168" text-anchor="middle">本壘</text><text x="30" y="56" text-anchor="middle">左外野</text><text x="100" y="24" text-anchor="middle">中外野</text><text x="170" y="56" text-anchor="middle">右外野</text></svg>`;
}
function wxSection(G) {
  const w = G.weather, f = G.forecast; if (!w && !f) return "";
  const roofT = f?.roofType, closed = w && ["Roof Closed", "Dome"].includes(w.condition);
  const hr = f && stamp(f.targetHourUTC + ":00Z").slice(6), hr2 = f && stamp(new Date(Date.parse(f.targetHourUTC + ":00Z") + 36e5).toISOString()).slice(6);
  let deg = null, src, rows;
  if (w) { deg = closed ? null : REL_DEG[w.windDir] ?? null;
    src = `<b>MLB 官方</b>（開賽前公布的場地天氣；本站首次看到 ${stamp(w.firstSeen)}${w.changedAt && w.changedAt !== w.firstSeen ? `，最後變動 ${stamp(w.changedAt)}` : ""}）。官方風向只分 8 個方位，圖上箭頭是該方位的代表角度。`;
    rows = [["天況", esc(WX_COND[w.condition] || w.condition || "—")], ["氣溫", w.tempF != null ? `${Math.round((w.tempF - 32) * 5 / 9)}°C（${w.tempF}°F）` : esc(w.temp || "—")],
      ["風", w.windMph != null ? (w.windMph === 0 ? "無風" : `${Math.round(w.windMph * 1.609)} km/h（${w.windMph} mph）・${esc(WX_DIR[w.windDir] || w.windDir || "")}`) : esc(w.wind || "—")]];
  } else { deg = f.windKmh === 0 || f.windFromDeg == null || f.azimuth == null ? null : ((f.windFromDeg + 180 - f.azimuth) % 360 + 540) % 360 - 180;
    src = `<b>模型預報，不是官方</b>（Open-Meteo.com，CC BY 4.0）；時段＝表定開賽那一小時，台灣 ${hr}–${hr2}；本站取得 ${stamp(f.fetchedAt)}${f.retryFailedSince ? `，自 ${stamp(f.retryFailedSince)} 起重抓失敗` : ""}。MLB 官方天氣開賽前幾小時才公布，屆時改顯示官方。`;
    rows = [["氣溫", f.tempC != null ? `${f.tempC}°C` : "—"], ["風", f.windKmh == null ? "—" : f.windKmh === 0 ? "無風" : `${f.windKmh} km/h・${esc(WX_DIR[f.windRel] || "")}（風從 ${f.windFromDeg}° 吹來）`],
      ["降雨機率", f.precipProb != null ? `${f.precipProb}%` : "—"]]; }
  rows.push(["屋頂", closed ? "官方標示屋頂關閉／室內，場內沒有風" : ROOF[roofT] || "未取得"]);
  if (w && f) rows.push(["賽前預報（參考）", `${f.tempC ?? "—"}°C・${f.windKmh === 0 ? "無風" : `${f.windKmh ?? "—"} km/h ${esc(WX_DIR[f.windRel] || "")}`}（台灣 ${hr}–${hr2} 那一小時）`]);
  const why = deg == null ? (closed ? "屋頂關閉，不畫風向。" : "無風或風向不定，不畫箭頭。") : "";
  return `<section class="blk" id="wx"><h2>球場天氣與風向 <small>只呈現資料，不判斷對哪隊有利或長打增減</small></h2><div class="panel wxp">
    ${windFig(deg, roofT === "Dome" || roofT === "Retractable")}<div><p class="small">資料：${src}</p><dl class="wxdl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <p class="small">${why}箭頭指向風吹去的方向，${roofT === "Retractable" || roofT === "Dome" ? "淡色表示場內可能無風；" : ""}球場方位取自 MLB 官方球場資料${f?.azimuth != null ? `（本壘→中外野 ${f.azimuth}°）` : ""}。</p></div></div></section>`;
}

/* ================= 天氣（MLB 官方賽前天氣；scripts/build-live.mjs weatherOf） ================= */
const WX_COND = { Sunny: "晴", Clear: "晴朗", "Partly Cloudy": "局部多雲", "Mostly Cloudy": "多雲", Cloudy: "多雲", Overcast: "陰", Drizzle: "毛毛雨", Rain: "雨", "Light Rain": "小雨", Showers: "陣雨", Snow: "雪", "Roof Closed": "屋頂關閉", Dome: "室內球場", Fog: "霧", Haze: "霾", Windy: "強風" };
const WX_DIR = { "Out To CF": "往中外野吹（向外）", "Out To LF": "往左外野吹（向外）", "Out To RF": "往右外野吹（向外）", "In From CF": "從中外野吹向本壘", "In From LF": "從左外野吹向本壘", "In From RF": "從右外野吹向本壘", "L To R": "左往右（橫風）", "R To L": "右往左（橫風）", Varies: "風向不定", Calm: "無風", None: "無風" };
function wxLine(w, f) {
  if (!w && f) {
    const wind = f.windKmh == null ? "風 —" : f.windKmh === 0 ? "無風" : `風 ${f.windKmh} km/h ${esc(WX_DIR[f.windRel] || "")}`;
    const roof = f.roofType === "Retractable" ? "；可開闔屋頂，關頂時場內沒有風" : f.roofType === "Dome" ? "；室內球場，場內沒有風" : "";
    const stale = f.retryFailedSince ? `；自 ${stamp(f.retryFailedSince)} 起重抓失敗，這是 ${stamp(f.fetchedAt)} 取得的預報` : "";
    return `<b>預報：${f.tempC ?? "—"}°C・${wind}${f.precipProb != null ? `・降雨機率 ${f.precipProb}%` : ""}</b><small>（模型預報，表定開賽那一小時，不是官方；MLB 官方天氣開賽前幾小時才公布${roof}${stale}。來源 Open-Meteo.com，CC BY 4.0）</small>`;
  }
  if (!w) return `${NA("尚未公布")}<small>（MLB 通常開賽前幾小時才提供）</small>`;
  const t = w.tempF != null ? `${Math.round((w.tempF - 32) * 5 / 9)}°C` : esc(w.temp || "—");
  const wind = w.windMph != null ? (w.windMph === 0 ? "無風" : `風 ${Math.round(w.windMph * 1.609)} km/h ${esc(WX_DIR[w.windDir] || w.windDir || "")}`) : esc(w.wind || "");
  return `<b>${esc(WX_COND[w.condition] || w.condition || "—")}・${t}・${wind}</b><small>（MLB 官方，本站首次看到 ${stamp(w.firstSeen)}${w.changedAt && w.changedAt !== w.firstSeen ? `，最後變動 ${stamp(w.changedAt)}` : ""}）</small>`;
}

/* ================= 今天值得一起看（scripts/ctx.mjs 產出；門檻見該檔）＋賽後結果（scripts/post.mjs） ================= */
const STALE_WHAT = { game: "整場資料", bullpen: "牛棚", sp: "先發成績", rec: "戰績", ops: "團隊 OPS", era: "團隊 ERA" };
const staleNote = (c, G) => (c.stale || []).map(x => `${STALE_WHAT[x.what] || x.what}${x.side ? `（${esc(G[x.side]?.name || x.side)}）` : ""}：自 ${stamp(x.since)} 起重抓失敗，這裡用的是 ${stamp(x.fetchedAt)} 取得的舊值`).join("；");
function ctxSection(C, G) {
  const h = n => `<h2>今天值得一起看 <small>${n}</small></h2>`;
  if (!C) return `<section class="blk" id="ctx">${h("")}<div class="panel"><p class="small">${NA()} 本場情境比較尚未產生。</p></div></section>`;
  const by = s => C.checks.filter(c => c.state === s), hits = by("hit"), miss = by("miss"), na = by("na"), shown = hits.slice(0, C.maxCards);
  const when = late(C) ? `這場第一次計算時已經開賽（${stamp(C.updatedAt)}），不是賽前紀錄`
    : G.status.code === "pre" ? `賽前每次更新重算・計算於 ${stamp(C.updatedAt)}` : `開賽前最後一次計算（${stamp(C.updatedAt)}），之後不再改`;
  const card = c => `<div class="ctx"><h3>${esc(c.title)}</h3>${c.stale ? `<p class="stale">${esc(staleNote(c, G))}</p>` : ""}
    ${c.nums?.length ? `<div class="nums">${c.nums.map(x => `<div><b class="num">${esc(x.v)}</b><span>${esc(x.k)}</span></div>`).join("")}</div>` : ""}
    <ul>${(c.says || []).map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    <details><summary class="small">查看依據與門檻</summary><p class="small">門檻：${esc(c.threshold)}<br>本場算出：${esc(c.value)}</p></details></div>`;
  const body = shown.length ? `<div class="ctxg">${shown.map(card).join("")}</div>`
    : `<div class="panel"><p><b>在已有資料與已啟用的比較項目中，沒有額外提示。</b></p><p class="small">${miss.length ? `比較過：${miss.map(c => esc(c.title)).join("、")}，都沒有達到門檻。` : ""}${na.length ? `${na.map(c => esc(c.title)).join("、")}這次資料不足，沒有比較——不代表那裡沒有值得看的條件。` : ""}</p></div>`;
  const more = hits.length > shown.length ? `<p class="small">另有 ${hits.length - shown.length} 項成立，超過上限 ${C.maxCards} 張沒有顯示：${hits.slice(shown.length).map(c => esc(c.title)).join("、")}。</p>` : "";
  const missT = miss.length ? `<details class="panel ctxmore"><summary class="small">已檢查、未達成卡門檻（${miss.length} 項）</summary><table class="tbl"><tbody>${miss.map(c => `<tr><td class="l">${esc(c.title)}</td><td class="l num">${esc(c.value)}${c.stale ? `<br><span class="stale">${esc(staleNote(c, G))}</span>` : ""}</td><td class="l small">${esc(c.threshold)}</td></tr>`).join("")}</tbody></table></details>` : "";
  const naT = na.length ? `<details class="panel ctxmore"><summary class="small">資料不足、這次沒有比較（${na.length} 項）</summary><ul class="small">${na.map(c => `<li>${esc(c.title)}：${esc(c.why)}</li>`).join("")}</ul></details>` : "";
  return `<section class="blk" id="ctx">${h(`${shown.length} / ${C.maxCards}・${when}`)}${body}${more}${missT}${naT}
    <p class="small">規則 ${esc(C.rules)}：門檻是暫定值、未經回測，卡片只是「這幾個數字值得一起看」的標記，不是預測或推薦。</p></section>${postSection(C, G)}`;
}
function postSection(C, G) {
  const P = C.post; if (!P) return "";
  const h = `<h2>賽後結果 <small>另外存，不改上面的賽前內容${P.fetchedAt ? `・取得 ${stamp(P.fetchedAt)}` : ""}</small></h2>`;
  if (!P.final) return `<section class="blk" id="post">${h}<div class="panel"><p class="small">${P.gaveUp ? "開賽後 30 天仍未完賽，不再追蹤。" : `目前狀態：${esc(P.status)}。完賽後會自動補上比分、逐局與牛棚實際使用。`}</p></div></section>`;
  const A = G.away, H = G.home, inn = P.innings || [], F = P.final, pp = P.pitching;
  const np = new Set((P.notPlayed || []).map(m => m.n + m.side)), ms = new Set((P.missing || []).map(m => m.n + m.side));
  const cell = (i, s) => i[s] != null ? i[s] : np.has(i.n + s) ? "x" : ms.has(i.n + s) ? `<span class="q">?</span>` : "x";
  const line = `<div class="lsw"><table class="tbl ls"><thead><tr><th class="l"></th>${inn.map(i => `<th>${i.n}</th>`).join("")}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>
    ${[["away", A], ["home", H]].map(([s, t]) => `<tr><td class="l">${esc(t.ab)}</td>${inn.map(i => `<td class="num${i.n >= P.late.fromInning ? " lt" : ""}">${cell(i, s)}</td>`).join("")}<td class="num"><b>${F[s].runs ?? "—"}</b></td><td class="num">${F[s].hits ?? "—"}</td><td class="num">${F[s].errors ?? "—"}</td></tr>`).join("")}</tbody></table></div>`;
  const rp = (t, s) => { const x = pp?.[s]; if (!x) return `<td>—</td><td>—</td><td>—</td>`;
    return `<td class="num">${x.sp ? `${esc(x.sp.name)} ${x.sp.outs != null ? `${Math.floor(x.sp.outs / 3)}.${x.sp.outs % 3}` : "—"} 局・${x.sp.pitches ?? "—"} 球` : "—"}</td><td class="num">${x.rp.apps} 人次・${x.rp.pitches == null ? `≥${x.rp.pitchers.reduce((a, p) => a + (p.pitches || 0), 0)}` : x.rp.pitches} 球</td><td class="num">${x.rp.runs ?? "—"}</td>`; };
  const bp = `<table class="tbl"><thead><tr><th class="l"></th><th>先發</th><th>牛棚</th><th>牛棚失分</th></tr></thead><tbody>${[["away", A], ["home", H]].map(([s, t]) => `<tr><td class="l">${esc(t.ab)}</td>${rp(t, s)}</tr>`).join("")}</tbody></table>`;
  const part = P.gameOver && P.complete === false ? `<div class="notice warn"><b>比賽已結束，但部分賽後資料還沒取得</b>（${esc((P.incomplete || []).join("、"))}）。已取得的先顯示，下次更新會再補；缺的地方不當成 0。</div>` : "";
  return `<section class="blk" id="post">${h}${part}<div class="panel">
    <p><b class="num">${esc(A.name)} ${F.away.runs ?? "—"} : ${F.home.runs ?? "—"} ${esc(H.name)}</b>　${P.status === "Completed Early" ? "提前結束" : "已完賽"}</p>
    <p class="small">第 ${P.late.fromInning} 局起（含延長）得分 <b class="num">${P.late.away ?? "—"} : ${P.late.home ?? "—"}</b>（表格淡色欄）</p>
    ${line}${bp}
    <p class="small">x＝確定沒打（主隊領先、最後一局下半不用打）；?＝這個半局的得分還沒取得；「—」＝那一段有半局未取得，不加總。每隊第一位上場的投手視為先發，其餘算牛棚。${late(C) ? "這場的情境不是賽前留下的，不列入賽前研究樣本。" : ""}來源：MLB Stats API（linescore、box score）。</p></div></section>`;
}
const late = C => (C.sample || (C.phase === "pre" ? "pregame" : "late")) === "late";

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
