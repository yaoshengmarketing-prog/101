// 名單狀態（roster-status v1）：node scripts/roster.mjs [輸出資料夾，預設 .build]
// 站長 2026-10-13：從 849844 一場固定試作，擴成今天／明天所有賽前 MLB 比賽的正式功能；接進 live-data 流程，但要控制 API 呼叫量
//   只處理 status.code＝pre 的比賽；開賽後不再寫檔（live/data/roster/<pk>.json 保留最後一份賽前版本）
//   回答的問題：「跟上一個合理的人員狀態相比，這場有哪些變化？」
// 比較基準（basisOf）＝該隊上一場比賽日的現役名單（roster?rosterType=active&date=上一場日期；上一場來自 build-live 的 prev）
//   例行賽：「上一場」；季後賽系列第 1 戰：上一場是例行賽→「例行賽最後一場」、是季後賽→「上一輪系列最後一戰」；系列第 2 戰起：「本系列前一戰」
//   沒有上一場（build-live 往前 12 天找不到已完賽）→ 沒有基準：只列傷兵與近期異動，增減不判斷
// 呼叫量：
//   球隊層級每隊每次 run 3 次（40Man、active@基準日、transactions），同一隊在今天／明天多場共用（同 run 內快取）；本場名單用 build-live 已抓的 boxscore（g[side].roster），不另外呼叫
//   球員層級：先用名單差異與異動分組，只有「名單增減、近期異動相關、本場名單內近期傷兵」的人才查 gameLog（例行賽最後出賽、季後賽出賽）；
//     其餘未列名單的 40 人（折疊層）只查 season 出賽量；都用 fields 精簡回應，跨隊合併批次（每批 ≤100 人）
//   球隊層級輸入和上一版相同（inputSig 相同）→ 不查球員、沿用上一版內容，只更新 fetchedAt（data-changed 不算變動，不會多 commit）
// 失敗：任何一隊的球隊層級或球員查詢失敗 → 這場不寫新檔，上一版（如果有）加 failed 標示沿用；沒有上一版就不產生檔案（頁面寫尚未取得）。不擋 live-data 其他步驟
// 分組：out＝基準有、本場無；in＝本場有、基準無；recentTx＝未列本場、也不在增減，但 14 天範圍內有「和出賽名單直接相關」的官方異動
//       （登錄傷兵、傷兵回歸、下放；沒有基準時另含原因未寫明的名單狀態變更）；只是召回／簽約到 40 人名單、或轉 60 天傷兵、被他隊認領等，不算近期相關，放折疊層；
//       ilMove＝本場名單內、範圍內有傷兵登錄／回歸／轉列；other＝其餘不在本場名單的 40 人（含長期傷兵），折疊、依本季例行賽出賽量排序
//   14 天＝基準日往前 13 天到基準日，是暫定閱讀整理範圍（站長 10-01、10-13），不當預測門檻、不回測；基準日之後到今天的異動都看（解釋增減）
//   姓名、狀態、異動原文只取來源；官方沒寫原因（roster status changed）標 unexplained，頁面寫「原因未確認」；不判斷「未列先發」、不加影響分數
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const RS_RULES = "roster-status v1";
const MLB = "https://statsapi.mlb.com/api/v1";
const WINDOW = 14;
const day = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const MON = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
const PEOPLE_FIELDS = "people,id,fullName,primaryPosition,abbreviation,stats,type,displayName,group,splits,date,gameType,game,gamePk,stat,gamesStarted,gamesPlayed,plateAppearances,inningsPitched,team,season";
const GT_ZH = { F: "外卡賽", D: "分區賽", L: "聯盟冠軍賽", W: "世界大賽" };

// 傷兵異動：只認描述原文的固定句型；部位＝「injured list」那句之後的文字，沒有就 null（頁面寫官方未寫部位）
export function ilInfo(desc) {
  if (!/injured list/i.test(desc || "")) return null;
  const m = desc.match(/\b(placed|activated|transferred)\b.*?(\d+)-day injured list(?:.*?to the (\d+)-day injured list)?/i);
  const kind = !m ? "other" : m[1].toLowerCase() === "placed" ? "placed" : m[1].toLowerCase() === "activated" ? "activated" : "transferred";
  const days = m ? +(m[3] || m[2]) : null;
  const r = desc.match(/retroactive to (\w+) (\d+), (\d{4})/); const retro = r && MON[r[1]] ? `${r[3]}-${String(MON[r[1]]).padStart(2, "0")}-${r[2].padStart(2, "0")}` : null;
  const i = desc.search(/injured list/i), rest = desc.slice(i).match(/\.\s+(.+?)\.?\s*$/);
  return { kind, days, retro, injury: rest ? rest[1] : null };
}
export const unexplained = desc => /roster status changed/i.test(desc || "");

// 比較基準：依賽事型態與上一場決定（只用 build-live 已有的欄位，不另外查賽程）
export function basisOf(g, side) {
  const p = g[side]?.prev; if (!p?.date) return null;
  const T = g.gameType || "R", P = p.gameType || "R", post = T !== "R";
  if (!post) return { date: p.date, kind: "prevGame", label: `上一場（${md(p.date)} ${p.ha}場對${p.opp}）比賽日的現役名單` };
  if ((g.series?.n ?? 1) > 1) return { date: p.date, kind: "series", label: `本系列第 ${g.series.n - 1} 戰（${md(p.date)}）比賽日的現役名單` };
  if (P === "R") return { date: p.date, kind: "regEnd", label: `例行賽最後一場（${md(p.date)}）比賽日的現役名單` };
  return { date: p.date, kind: "prevRound", label: `上一輪${GT_ZH[P] || "系列"}最後一戰（${md(p.date)}）比賽日的現役名單` };
}

const rosterRows = r => (r?.roster || []).map(x => ({ id: x.person?.id, name: x.person?.fullName || String(x.person?.id), pos: x.position?.abbreviation || null, status: x.status?.code || null })).filter(x => x.id);
const txRows = r => (r?.transactions || []).filter(x => x.person?.id).map(x => ({ date: x.date, eff: x.effectiveDate || null, type: x.typeCode || null, id: x.person.id, name: x.person.fullName || null, text: x.description || "" }));

// 球隊層級資料 → 分組（純函式；不含球員查詢）
export function classify({ listed, basis, m40, tx, basisDate, today }) {
  const from = basisDate ? day(basisDate, -(WINDOW - 1)) : null;
  const inWin = d => !from || (d >= from && d <= today);
  const L = new Set(listed.map(x => x.id)), B = basis ? new Set(basis.map(x => x.id)) : null;
  const info = new Map(); for (const x of [...m40, ...(basis || []), ...listed]) if (!info.has(x.id)) info.set(x.id, { name: x.name, pos: x.pos });
  const status = new Map(m40.map(x => [x.id, x.status]));
  const byId = new Map(); for (const x of [...tx].sort((a, b) => a.date.localeCompare(b.date))) { if (!info.has(x.id) && x.name) info.set(x.id, { name: x.name, pos: null }); (byId.get(x.id) || byId.set(x.id, []).get(x.id)).push(x); }
  const ids = [...new Set([...m40.map(x => x.id), ...(basis || []).map(x => x.id), ...listed.map(x => x.id), ...byId.keys()])];
  const people = [];
  for (const id of ids) {
    const nm = info.get(id) || { name: String(id), pos: null }, listedHere = L.has(id), inBasis = B ? B.has(id) : null;
    const myTx = (byId.get(id) || []).map(x => ({ date: x.date, eff: x.eff, type: x.type, text: x.text, il: ilInfo(x.text), unexplained: unexplained(x.text) }));
    const recent = myTx.filter(x => inWin(x.date)), ilRecent = recent.some(x => x.il);
    // 原因未寫明的名單狀態變更：有基準時，和本場有關的人已經落在增減；沒有基準才拿它當線索
    const related = recent.some(x => ["placed", "activated"].includes(x.il?.kind) || x.type === "OPT" || (x.unexplained && !B));
    const group = B && inBasis && !listedHere ? "out" : B && listedHere && !inBasis ? "in"
      : !listedHere && related ? "recentTx" : listedHere && ilRecent ? "ilMove" : !listedHere && status.has(id) ? "other" : null;
    if (group) people.push({ id, name: nm.name, pos: nm.pos, listed: listedHere, inBasis, status: status.get(id) ?? null, group, tx: myTx, reg: null, lastReg: null, post: [] });
  }
  const il = m40.filter(x => /^D\d+$/.test(x.status)), ilBy = {}; il.forEach(x => ilBy[x.status] = (ilBy[x.status] || 0) + 1);
  return { from, people, out: people.filter(p => p.group === "out").map(p => p.id), in: people.filter(p => p.group === "in").map(p => p.id), ilCount: il.length, ilBy };
}

// people 回應 → 本季例行賽出賽量、例行賽最後出賽、季後賽出賽（只到本場前一天）
export function enrich(people, resp, beforeDate) {
  const P = new Map((resp?.people || []).map(p => [p.id, p]));
  for (const o of people) {
    const p = P.get(o.id); if (!p) continue;
    const pit = (o.pos || p.primaryPosition?.abbreviation) === "P";
    if (!o.pos) o.pos = p.primaryPosition?.abbreviation || null;
    const S = (p.stats || []).filter(s => s.type?.displayName === "season" && s.group?.displayName === (pit ? "pitching" : "hitting")).flatMap(s => s.splits || []).filter(s => (s.gameType || "R") === "R");
    const row = S.length === 1 ? S[0] : S.find(s => !s.team) || null; // 多隊分列缺合計就不取（不自行合計）
    if (row) o.reg = pit ? { g: row.stat?.gamesPlayed ?? null, gs: row.stat?.gamesStarted ?? null, ip: row.stat?.inningsPitched ?? null } : { pa: row.stat?.plateAppearances ?? null };
    else if (S.length > 1) o.reg = { multi: true };
    const G = (p.stats || []).filter(s => s.type?.displayName === "gameLog").flatMap(s => (s.splits || []).map(x => ({ ...x, grp: s.group?.displayName })));
    if (G.length) {
      const reg = G.filter(x => (x.gameType || "R") === "R").map(x => x.date).sort(); o.lastReg = reg.at(-1) || null;
      o.post = G.filter(x => x.gameType && x.gameType !== "R" && x.date < beforeDate).sort((a, b) => a.date.localeCompare(b.date))
        .map(x => ({ date: x.date, gt: x.gameType, pk: x.game?.gamePk ?? null, role: x.grp === "pitching" ? (x.stat?.gamesStarted ? "先發投手" : "登板") : "出賽" }));
    }
  }
}

const ORD = { out: 0, in: 1, recentTx: 2, ilMove: 3, other: 4 };
export function sortPeople(people) {
  const usage = o => o.reg ? (o.reg.pa ?? o.reg.g ?? 0) : 0, isP = o => o.pos === "P" ? 1 : 0;
  people.sort((a, b) => ORD[a.group] - ORD[b.group] || isP(a) - isP(b) || usage(b) - usage(a) || a.name.localeCompare(b.name));
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

// 一次 run 的共用層：同一網址只打一次（球隊層級資料跨場共用）
export function makeCtx(fetchJson = getJson) {
  const cache = new Map(), calls = [];
  const get = url => { if (!cache.has(url)) { calls.push(url); cache.set(url, fetchJson(url)); } return cache.get(url); };
  return { get, calls };
}

// 單場：回傳 { out, changed } 或丟錯；prev＝上一版 live/data/roster/<pk>.json
export async function buildRosterStatus(g, ctx, nowISO, prev = null) {
  const season = (g.usDate || g.startUTC).slice(0, 4), today = g.usDate;
  const sides = {}, sigs = [];
  for (const s of ["away", "home"]) {
    const t = g[s], listed = t.roster || [];
    if (!listed.length) throw new Error(`${t.ab} 本場名單未取得（boxscore）`);
    const basis = basisOf(g, s);
    const [r40, rb, rtx] = await Promise.all([
      ctx.get(`${MLB}/teams/${t.id}/roster?rosterType=40Man&season=${season}`),
      basis ? ctx.get(`${MLB}/teams/${t.id}/roster?rosterType=active&date=${basis.date}`) : null,
      ctx.get(`${MLB}/transactions?teamId=${t.id}&startDate=${day(basis?.date || today, -(WINDOW - 1))}&endDate=${today}`)]);
    const m40 = rosterRows(r40), basisRows = basis ? rosterRows(rb) : null, tx = txRows(rtx);
    if (!m40.length) throw new Error(`${t.ab} 40Man 名單為空`);
    if (basis && !basisRows.length) throw new Error(`${t.ab} ${basis.date} 現役名單為空`);
    const C = classify({ listed, basis: basisRows, m40, tx, basisDate: basis?.date || null, today });
    sides[s] = { team: t.id, ab: t.ab, basis, listedN: listed.length, basisN: basisRows ? basisRows.length : null, ...C };
    sigs.push(JSON.stringify([t.id, basis?.date, listed.map(x => x.id).sort(), basisRows?.map(x => x.id).sort(), m40.map(x => [x.id, x.status]).sort(), tx.map(x => [x.date, x.id, x.type, x.text])]));
  }
  const inputSig = sigs.join("|");
  const base = { rules: RS_RULES, pk: g.pk, officialDate: g.usDate, gameType: g.gameType || "R", series: g.series || null, fetchedAt: nowISO,
    statusAtFetch: g.status.raw, probableAtFetch: { away: g.away.sp?.name || null, home: g.home.sp?.name || null },
    lineupPostedAtFetch: !!(g.away.lineup?.slots?.length || g.home.lineup?.slots?.length), window: { days: WINDOW }, txTo: today };
  if (prev && prev.rules === RS_RULES && prev.inputSig === inputSig) { const { failed, ...keep } = prev; return { out: { ...keep, ...base, changedAt: prev.changedAt }, changed: false }; }
  // 輸入有變：查球員。重點組（增減、近期異動、本場內傷兵）含 gameLog；折疊組只要 season
  const top = [], oth = [];
  for (const s of ["away", "home"]) for (const p of sides[s].people) (p.group === "other" ? oth : top).push(p);
  const fetchPeople = async (list, withLog) => {
    const ids = [...new Set(list.map(p => p.id))];
    for (let i = 0; i < ids.length; i += 100) {
      const r = await ctx.get(`${MLB}/people?personIds=${ids.slice(i, i + 100).join(",")}&hydrate=stats(group=[hitting,pitching],type=[season${withLog ? ",gameLog" : ""}],season=${season},gameType=[R,F,D,L,W])&fields=${PEOPLE_FIELDS}`);
      enrich(list, r, today);
    }
  };
  await fetchPeople(top, true); await fetchPeople(oth, false);
  for (const s of ["away", "home"]) sortPeople(sides[s].people);
  return { out: { ...base, changedAt: nowISO, inputSig, away: sides.away, home: sides.home }, changed: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data`, nowISO = new Date().toISOString(), t0 = Date.now();
  const read = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  fs.mkdirSync(`${D}/roster`, { recursive: true });
  const games = fs.readdirSync(`${D}/games`).filter(f => f.endsWith(".json")).map(f => read(`${D}/games/${f}`)).filter(Boolean);
  const ctx = makeCtx(), lines = [], c = { pre: 0, changed: 0, same: 0, failed: 0, kept: 0, frozen: 0, noBasis: 0 }, teams = new Set();
  for (const g of games) {
    if (g.status?.code !== "pre") { c.frozen++; continue; } // 開賽後保留最後一份賽前版本
    c.pre++; const prev = read(`live/data/roster/${g.pk}.json`);
    try {
      const { out, changed } = await buildRosterStatus(g, ctx, nowISO, prev);
      fs.writeFileSync(`${D}/roster/${g.pk}.json`, JSON.stringify(out)); changed ? c.changed++ : c.same++;
      for (const s of ["away", "home"]) { teams.add(g[s].id); if (!out[s].basis) c.noBasis++; }
      lines.push(`${g.pk} ${g.away.ab}@${g.home.ab}：${changed ? "重算" : "輸入未變，沿用"}；${["away", "home"].map(s => `${out[s].ab} 名單 ${out[s].listedN}${out[s].basis ? `、對照 ${md(out[s].basis.date)} 少 ${out[s].out.length} 多 ${out[s].in.length}` : "、沒有基準"}`).join("；")}`);
    } catch (e) {
      c.failed++;
      if (prev) { c.kept++; const f = prev.failed; fs.writeFileSync(`${D}/roster/${g.pk}.json`, JSON.stringify({ ...prev, failed: { since: f?.since || nowISO, error: String(e.message || e), fetchedAt: f?.fetchedAt || prev.fetchedAt } })); }
      lines.push(`${g.pk} ${g.away.ab}@${g.home.ab}：這次失敗${prev ? "，沿用上一版並標示" : "，沒有上一版可沿用（不產生檔案）"}：${e.message}`);
    }
  }
  lines.unshift(`賽前 ${c.pre} 場（${teams.size} 隊）：重算 ${c.changed}／輸入未變沿用 ${c.same}／失敗 ${c.failed}（其中沿用上一版 ${c.kept}）；沒有基準 ${c.noBasis} 隊次；非賽前 ${c.frozen} 場不重算；StatsAPI 請求 ${ctx.calls.length} 次，${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
  fs.appendFileSync(`${OUT}/report.md`, `\n## 名單狀態（${RS_RULES}）\n\n${lines.map(l => "- " + l).join("\n")}\n`);
  console.log("名單狀態：" + lines.join("｜"));
}
