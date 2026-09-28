// 先發投手 × 對方打線（對位卡）試作：node scripts/matchup.mjs [輸出資料夾，預設 .build]
// 站長 2026-09-29：先做一場真實範例看畫面，再討論套到其他比賽 → 只算 MATCHUP_PKS 裡的比賽
// 每場兩組：客隊先發 × 主隊打線、主隊先發 × 客隊打線，寫 <out>/live-data/matchup/<gamePk>.json
//   投手：MLB Stats API statSplits（vl＝對左打、vr＝對右打；本季例行賽）＋gameLog（例行賽＋季後賽）取最近三次先發
//   打線：MLB 官方打線優先（打擊側用 people API 的 batSide）；沒有才用 RotoWire 預估（proj，打擊側照來源）；都沒有就不組
//   左右開弓、打擊側未知分開計，不併入左打或右打（算打席站位時：左右開弓面對右投算左打席、面對左投算右打席）
//   9 人中至少 6 人站同一邊才指出先看哪個分項；名單未滿 9 人照實記人數，不判斷以哪一邊為主
//   觀察句由固定規則產生（notesOf），只說明哪個分項對應今天的打線、樣本大小、最近先發長短（比前兩次都少至少 2 局才註記）；不寫勝負、不推測原因
//   只在賽前計算；開賽後不再寫檔（保留最後一次賽前結果）；這次抓取失敗也不寫檔（頁面比對先發 id，不一致就標示過期）
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { TEAM_ZH } from "./build-live.mjs";

export const MU_RULES = "matchup v0.1";
export const MATCHUP_PKS = [849851]; // 紅襪 @ 洋基（台灣 9/30 08:00，外卡賽）
const MLB = "https://statsapi.mlb.com/api/v1";
const FOCUS = 6; // 9 人中至少 6 人站同一邊打席，才說「先看那一邊的分項」；5 對 4 這種接近的，兩邊都看
const SHORT_OUTS = 6; // 「投得短」＝最近一次先發比前兩次都少至少 2 局（6 個出局）；差一兩個出局不註記

// 局數字串 → 出局數（"5.2"＝5⅔ 局＝17 個出局）
export const outs = s => { const m = /^(\d+)(?:\.([012]))?$/.exec(String(s ?? "")); return m ? +m[1] * 3 + +(m[2] || 0) : null; };
const md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;

// statSplits → { vl, vr }；被交易者可能每隊一列＋合計一列：取沒有 team 的合計列，只有分隊列就不合計（記 null）
export function pickSplits(splits) {
  const one = code => { const rows = (splits || []).filter(x => x.split?.code === code);
    const r = rows.find(x => !x.team) || (rows.length === 1 ? rows[0] : null);
    const pa = r?.stat?.battersFaced, ops = r?.stat?.ops;
    return r && Number.isFinite(pa) && pa > 0 && ops ? { ops, pa } : null; };
  return { vl: one("vl"), vr: one("vr") };
}

// gameLog → 最近三次先發（依日期）＋在那之後的中繼登板（如果有）
export function recentStarts(logs, n = 3) {
  const all = (logs || []).map(x => ({ date: x.date, gameType: x.gameType || "R", pk: x.game?.gamePk ?? null, opp: TEAM_ZH[x.opponent?.id] || x.opponent?.name || null,
    ha: x.isHome ? "主" : "客", gs: x.stat?.gamesStarted === 1, ip: x.stat?.inningsPitched ?? null, np: x.stat?.numberOfPitches ?? null, er: x.stat?.earnedRuns ?? null }))
    .filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date) || String(a.pk).localeCompare(String(b.pk)));
  const starts = all.filter(x => x.gs).slice(-n), last = all.at(-1);
  return { starts, reliefAfter: last && !last.gs && starts.length && last.date >= starts.at(-1).date ? last : null, totalApps: all.length };
}

// 打線組成：L／R／S（左右開弓）／U（未知）分開，不硬歸類
export function composition(slots) {
  const c = { n: 0, L: [], R: [], S: [], U: [] };
  for (const x of slots || []) { c.n++; (c[["L", "R", "S"].includes(x.bats) ? x.bats : "U"]).push(x.n); }
  return c;
}

// 面對這位先發時站左／右打席的人數：MLB 的對左打／對右打分項按「那個打席站哪一邊」算；
// 左右開弓面對右投通常站左打席、面對左投站右打席；先發慣用手未知就不計入左右開弓；打擊側未知一律不計
export const effective = (c, hand) => ({ L: c.L.length + (hand === "R" ? c.S.length : 0), R: c.R.length + (hand === "L" ? c.S.length : 0) });

// 要先看哪一邊的分項：9 人齊、且至少 FOCUS 人站同一邊才有；否則 null（兩邊都看）
export const focusOf = (comp, hand) => { const e = effective(comp, hand); return comp.n >= 9 && Math.max(e.L, e.R) >= FOCUS ? (e.L > e.R ? "L" : "R") : null; };

// 觀察句（1–2 句）＋最近先發備註；只根據這張卡上的數字
export function notesOf({ pitcher, splits, recent, lineup }) {
  const obs = [], P = pitcher.name, T = lineup?.team || "對方";
  const side = k => k === "L" ? "左打" : "右打", sp = k => splits[k === "L" ? "vl" : "vr"];
  if (!lineup) obs.push(`${T}官方打線還沒公布、也沒有預估名單，先只列 ${P} 的分項。`);
  else if (!splits.vl || !splits.vr) obs.push(`${P} 本季沒有完整的大聯盟例行賽對左打／對右打分項，這張卡無法對照打線組成。`);
  else {
    const c = lineup.comp, H = pitcher.hand, a = splits.vl, b = splits.vr, S = c.S.length, { L, R } = effective(c, H), swIn = H === "L" || H === "R";
    const base = `${T}${lineup.short}${c.n < 9 ? `目前只有 ${c.n} 人（未滿 9 人）：` : " 9 人中"}左打 ${c.L.length}、右打 ${c.R.length}${S ? `、左右開弓 ${S}` : ""}${c.U.length ? `、打擊側未知 ${c.U.length}` : ""}`;
    const sw = S ? (swIn ? `；左右開弓面對${H === "R" ? "右" : "左"}投通常站${H === "R" ? "左" : "右"}打席，合計站左打席約 ${L} 位、右打席約 ${R} 位` : "；先發慣用手未知，左右開弓不計入") : "";
    if (c.n < 9) obs.push(`${base}，先不判斷以哪一邊為主：${P} 對左打被打 OPS ${a.ops}（${a.pa} 打席）、對右打 ${b.ops}（${b.pa} 打席）。`);
    else if (!focusOf(c, H)) obs.push(`${base}${sw}，兩邊人數接近，兩個分項都要看：${P} 對左打被打 OPS ${a.ops}（${a.pa} 打席）、對右打 ${b.ops}（${b.pa} 打席）。`);
    else {
      const M = focusOf(c, H), m = M === "L" ? "R" : "L", x = sp(M), y = sp(m), cmp = +x.ops > +y.ops ? "高於" : +x.ops < +y.ops ? "低於" : "等於";
      obs.push(`${base}${sw}，所以 ${P} 的「對${side(M)}」分項最值得先看：本季被打 OPS ${x.ops}（${x.pa} 打席），${cmp}他對${side(m)}的 ${y.ops}（${y.pa} 打席）。`);
      if (x.pa < y.pa) obs.push(`不過對${side(M)}的樣本（${x.pa} 打席）比對${side(m)}（${y.pa} 打席）少，這個分項比較容易受少數幾場影響。`);
    }
  }
  const s = recent.starts, last = s.at(-1);
  let recentNote = null;
  if (s.length < 3) recentNote = `本季（例行賽＋季後賽）只有 ${s.length} 次先發紀錄。`;
  else if ([s[0], s[1]].every(p => outs(last.ip) != null && outs(p.ip) != null && outs(last.ip) <= outs(p.ip) - SHORT_OUTS))
    recentNote = `最近一次先發（${md(last.date)}）投 ${last.ip} 局${last.np != null ? `、${last.np} 球` : ""}，比前兩次（${s[0].ip} 局、${s[1].ip} 局）短；本站沒有原因資料，不推測傷病或限球數。`;
  if (recent.reliefAfter) { const r = recent.reliefAfter;
    recentNote = `${recentNote ? recentNote + " " : ""}最近一次登板是 ${md(r.date)} 中繼 ${r.ip} 局${r.np != null ? `、${r.np} 球` : ""}（在最近一次先發之後）。`; }
  return { obs, recentNote };
}

// 本場打線：官方優先，其次 RotoWire 預估；回傳 null＝都沒有
export function lineupOf(g, side, batSide) {
  const t = g[side], L = t.lineup, P = g.proj?.[side];
  if (["official", "late"].includes(L?.state) && L.slots?.length) {
    const slots = L.slots.map(x => ({ n: x.n, name: x.name, bats: batSide[x.id] || null }));
    return { team: t.name, ab: t.ab, source: L.state, short: "官方打線", label: L.state === "late" ? "MLB 官方打線（含臨場異動）" : "MLB 官方打線", at: L.lateAt || L.firstSeen, slots, comp: composition(slots) };
  }
  if (P?.slots?.length) {
    const conf = P.sourceStatusKey === "confirmed", slots = P.slots.map(x => ({ n: x.n, name: x.name, bats: x.bats || null }));
    return { team: t.name, ab: t.ab, source: conf ? "proj-confirmed" : "proj", short: conf ? "RotoWire 確認名單" : "預估打線",
      label: conf ? "RotoWire 已確認名單（非 MLB 官方）" : "RotoWire 預估打線（非官方）", at: P.changedAt || P.firstSeen, slots, comp: composition(slots) };
  }
  return null;
}

async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r.json(); last = new Error(`HTTP ${r.status} ${url}`); if (r.status < 500 && r.status !== 429) break; }
    catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 1500 * (i + 1)));
  }
  throw last;
}

export async function buildMatchup(g, nowISO, fetchJson = getJson) {
  const season = (g.usDate || g.startUTC).slice(0, 4);
  const ids = ["away", "home"].flatMap(s => ["official", "late"].includes(g[s].lineup?.state) ? (g[s].lineup.slots || []).map(x => x.id) : []).filter(Boolean);
  const batSide = {};
  if (ids.length) for (const p of (await fetchJson(`${MLB}/people?personIds=${ids.join(",")}`)).people || []) batSide[p.id] = p.batSide?.code || null;
  const pairs = [];
  for (const [ps, bs] of [["away", "home"], ["home", "away"]]) {
    const t = g[ps], sp = t.sp;
    if (!sp?.id) { pairs.push({ pitcherSide: ps, battingSide: bs, pitcher: null, team: t.name, ab: t.ab }); continue; }
    const [a, b] = await Promise.all([
      fetchJson(`${MLB}/people/${sp.id}/stats?stats=statSplits&group=pitching&season=${season}&sitCodes=vl,vr&gameType=R`),
      fetchJson(`${MLB}/people/${sp.id}/stats?stats=gameLog&group=pitching&season=${season}&gameType=R,F,D,L,W`)]);
    const splits = pickSplits(a.stats?.[0]?.splits), recent = recentStarts(b.stats?.[0]?.splits), lineup = lineupOf(g, bs, batSide);
    const pitcher = { id: sp.id, name: sp.name, hand: sp.hand, team: t.name, ab: t.ab };
    pairs.push({ pitcherSide: ps, battingSide: bs, pitcher, splits, splitScope: `${season} 例行賽`, recent, lineup, eff: lineup ? effective(lineup.comp, sp.hand) : null, focus: lineup ? focusOf(lineup.comp, sp.hand) : null, ...notesOf({ pitcher, splits, recent, lineup }) });
  }
  return { rules: MU_RULES, pk: g.pk, fetchedAt: nowISO, pairs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data`, nowISO = new Date().toISOString();
  const read = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const lines = [];
  fs.mkdirSync(`${D}/matchup`, { recursive: true });
  for (const pk of MATCHUP_PKS) {
    const g = read(`${D}/games/${pk}.json`);
    if (!g) { lines.push(`${pk}：不在今天／明天範圍，保留上一版`); continue; }
    if (g.status?.code !== "pre") { lines.push(`${pk}：已非賽前（${g.status?.code}），保留最後一次賽前結果`); continue; }
    try { const m = await buildMatchup(g, nowISO); fs.writeFileSync(`${D}/matchup/${pk}.json`, JSON.stringify(m));
      lines.push(`${pk}：${m.pairs.map(p => p.pitcher ? `${p.ab} ${p.pitcher.name} × ${p.lineup ? `${p.lineup.ab} ${p.lineup.label} ${p.lineup.comp.n} 人（左 ${p.lineup.comp.L.length}／右 ${p.lineup.comp.R.length}／開弓 ${p.lineup.comp.S.length}／未知 ${p.lineup.comp.U.length}）` : "打線未取得"}` : `${p.ab} 先發未公布`).join("；")}`); }
    catch (e) { lines.push(`${pk}：抓取失敗，保留上一版（${e.message}）`); }
  }
  fs.appendFileSync(`${OUT}/report.md`, `\n## 先發 × 對方打線（${MU_RULES}，試作）\n\n${lines.map(l => "- " + l).join("\n")}\n`);
  console.log("對位卡：" + lines.join("｜"));
}
