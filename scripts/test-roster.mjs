// 名單狀態離線測試（不連網）：node scripts/test-roster.mjs
// 1) 人工案例（API 形狀的小型回應）：一般增減、官方原因未寫明、傷兵／下放／回歸、比較基準切換、API 部分失敗沿用上一版、開賽後凍結
// 2) 真實快照：scripts/fixtures/roster-849844-20261001T1450Z.json（2026-10-01 14:50Z 實抓，PHI@ATL 外卡第 3 戰賽前）轉成 API 形狀後跑同一套程式
import assert from "node:assert/strict";
import fs from "node:fs";
import { basisOf, buildRosterStatus, ilInfo, makeCtx, unexplained, RS_RULES } from "./roster.mjs";

let n = 0; const t = async (name, f) => { await f(); n++; console.log("ok", name); };
const per = (id, name, pos, status) => ({ person: { id, fullName: name }, position: { abbreviation: pos }, status: { code: status } });
const tx = (date, id, name, typeCode, description) => ({ date, effectiveDate: date, typeCode, person: { id, fullName: name }, description });
const stat = (id, name, pos, { pa, g, gs, ip, log = [] } = {}) => ({ id, fullName: name, primaryPosition: { abbreviation: pos }, stats: [
  { type: { displayName: "season" }, group: { displayName: pos === "P" ? "pitching" : "hitting" }, splits: [{ season: "2026", gameType: "R", team: { id: 1 }, stat: pos === "P" ? { gamesPlayed: g, gamesStarted: gs, inningsPitched: ip } : { plateAppearances: pa } }] },
  ...(log.length ? [{ type: { displayName: "gameLog" }, group: { displayName: pos === "P" ? "pitching" : "hitting" }, splits: log.map(([date, gameType, pk, gsx]) => ({ date, gameType, game: { gamePk: pk }, stat: pos === "P" ? { gamesStarted: gsx } : { gamesPlayed: 1 } })) }] : []) ] });

// 兩隊：1 客 AAA、2 主 BBB。基準日 10-10（上一場），本場 10-12
const A40 = [per(11, "Al One", "C", "A"), per(12, "Al Two", "1B", "A"), per(13, "Al Three", "P", "A"), per(14, "Al Four", "P", "D15"), per(15, "Al Five", "OF", "40M"), per(16, "Al Six", "P", "D60"), per(17, "Al Seven", "SS", "A")];
const B40 = [per(21, "Bo One", "C", "A"), per(22, "Bo Two", "2B", "A"), per(23, "Bo Three", "P", "A"), per(24, "Bo Four", "P", "RM"), per(25, "Bo Five", "OF", "A")];
const toRoster = (list, ids) => ({ roster: list.filter(x => ids.includes(x.person.id)).map(x => ({ ...x, status: { code: "A" } })) });
const ATX = [tx("2026-10-01", 14, "Al Four", "SC", "AAA placed RHP Al Four on the 15-day injured list retroactive to September 29, 2026. Right forearm strain."),
  tx("2026-10-11", 12, "Al Two", "SC", "1B Al Two roster status changed by AAA."), tx("2026-10-11", 17, "Al Seven", "SC", "SS Al Seven roster status changed by AAA."),
  tx("2026-10-05", 13, "Al Three", "SC", "AAA activated RHP Al Three from the 15-day injured list."), tx("2026-09-20", 16, "Al Six", "SC", "AAA transferred LHP Al Six from the 15-day injured list to the 60-day injured list. Left elbow sprain.")];
const BTX = [tx("2026-10-04", 24, "Bo Four", "OPT", "BBB optioned RHP Bo Four to Triple-A."), tx("2026-10-11", 25, "Bo Five", "CU", "BBB recalled OF Bo Five from Triple-A.")];
const PEOPLE = { 11: stat(11, "Al One", "C", { pa: 400, log: [["2026-09-27", "R", 1], ["2026-10-10", "D", 500]] }), 12: stat(12, "Al Two", "1B", { pa: 500, log: [["2026-09-27", "R", 1]] }),
  13: stat(13, "Al Three", "P", { g: 40, gs: 0, ip: "40.0", log: [["2026-09-26", "R", 1, 0], ["2026-10-10", "D", 500, 1]] }), 14: stat(14, "Al Four", "P", { g: 50, gs: 0, ip: "50.1", log: [["2026-09-28", "R", 2, 0]] }),
  15: stat(15, "Al Five", "OF", { pa: 20 }), 16: stat(16, "Al Six", "P", { g: 10, gs: 10, ip: "55.0" }), 17: stat(17, "Al Seven", "SS", { pa: 90, log: [["2026-09-27", "R", 1]] }),
  21: stat(21, "Bo One", "C", { pa: 300 }), 22: stat(22, "Bo Two", "2B", { pa: 310 }), 23: stat(23, "Bo Three", "P", { g: 30, gs: 30, ip: "180.0" }), 24: stat(24, "Bo Four", "P", { g: 12, gs: 0, ip: "15.0", log: [["2026-10-03", "R", 3, 0]] }), 25: stat(25, "Bo Five", "OF", { pa: 50, log: [["2026-10-09", "R", 4]] }) };

// 本場名單：AAA 少了 12、17，多了 15；BBB 多了 25（24 在基準日之前就下放）
const LISTED_A = [11, 13, 14, 15], BASIS_A = [11, 12, 13, 14, 17], LISTED_B = [21, 22, 23, 25], BASIS_B = [21, 22, 23];
function api({ fail = [] } = {}) {
  return async url => {
    const no = k => { if (fail.includes(k)) throw new Error(`HTTP 503 ${k}`); };
    if (url.includes("/teams/1/roster?rosterType=40Man")) { no("40a"); return { roster: A40 }; }
    if (url.includes("/teams/2/roster?rosterType=40Man")) { no("40b"); return { roster: B40 }; }
    if (url.includes("/teams/1/roster?rosterType=active&date=2026-10-10")) return toRoster(A40, BASIS_A);
    if (url.includes("/teams/2/roster?rosterType=active&date=2026-10-10")) return toRoster(B40, BASIS_B);
    if (url.includes("/transactions?teamId=1")) { no("txa"); return { transactions: ATX }; }
    if (url.includes("/transactions?teamId=2")) return { transactions: BTX };
    if (url.includes("/people?personIds=")) { no("people"); const ids = url.match(/personIds=([\d,]+)/)[1].split(",").map(Number); return { people: ids.map(i => PEOPLE[i]).filter(Boolean) }; }
    throw new Error("unexpected " + url);
  };
}
const rosterOf = (list, ids) => list.filter(x => ids.includes(x.person.id)).map(x => ({ id: x.person.id, name: x.person.fullName, pos: x.position.abbreviation }));
const game = ({ status = "pre", gameType = "D", series = { desc: "Division Series", n: 2, of: 5 }, prevType = "D", prevDate = "2026-10-10", listedA = LISTED_A, noPrev = false } = {}) => ({
  pk: 900, usDate: "2026-10-12", startUTC: "2026-10-12T20:00:00Z", gameType, series, status: { code: status, raw: status === "pre" ? "Scheduled" : "In Progress" },
  away: { id: 1, ab: "AAA", name: "甲", sp: { id: 13, name: "Al Three" }, lineup: { slots: null }, roster: rosterOf(A40, listedA), prev: noPrev ? null : { pk: 800, date: prevDate, gameType: prevType, ha: "客", opp: "乙" } },
  home: { id: 2, ab: "BBB", name: "乙", sp: null, lineup: { slots: null }, roster: rosterOf(B40, LISTED_B), prev: noPrev ? null : { pk: 800, date: prevDate, gameType: prevType, ha: "主", opp: "甲" } } });
const names = (T, g) => T.people.filter(p => p.group === g).map(p => p.name);
const by = (T, name) => T.people.find(p => p.name === name);
const NOW = "2026-10-12T10:00:00Z";

await t("傷兵描述：類型、天數、回溯日、部位；沒寫部位＝null；原因未寫明的句型", () => {
  assert.deepEqual(ilInfo("Atlanta Braves placed LHP Martín Pérez on the 15-day injured list retroactive to September 21, 2026. Low back inflammation."), { kind: "placed", days: 15, retro: "2026-09-21", injury: "Low back inflammation" });
  assert.deepEqual(ilInfo("X transferred RHP Y from the 15-day injured list to the 60-day injured list. Left oblique strain."), { kind: "transferred", days: 60, retro: null, injury: "Left oblique strain" });
  assert.equal(ilInfo("X placed RHP Y on the 60-day injured list.").injury, null); assert.equal(ilInfo("X activated CF Y from the restricted list."), null);
  assert.equal(unexplained("2B Luis Arraez roster status changed by Philadelphia Phillies."), true); assert.equal(unexplained("X optioned RHP Y to Triple-A."), false); });

await t("比較基準依賽事型態切換：例行賽＝上一場；季後賽 G1 接例行賽＝例行賽最後一場；G1 接季後賽＝上一輪最後一戰；G2 起＝本系列前一戰；沒有上一場＝null", () => {
  assert.equal(basisOf(game({ gameType: "R", series: null, prevType: "R" }), "away").kind, "prevGame");
  assert.match(basisOf(game({ gameType: "R", series: null, prevType: "R" }), "away").label, /^上一場（10\/10 客場對乙）/);
  assert.equal(basisOf(game({ series: { n: 1, of: 5 }, prevType: "R" }), "away").kind, "regEnd");
  assert.equal(basisOf(game({ gameType: "L", series: { n: 1, of: 7 }, prevType: "D" }), "away").kind, "prevRound");
  assert.match(basisOf(game({ gameType: "L", series: { n: 1, of: 7 }, prevType: "D" }), "away").label, /上一輪分區賽最後一戰/);
  assert.equal(basisOf(game({ series: { n: 3, of: 5 } }), "home").label, "本系列第 2 戰（10/10）比賽日的現役名單");
  assert.equal(basisOf(game({ noPrev: true }), "away"), null); });

let R1;
await t("一般名單增減：AAA 少 2（12、17）多 1（15）；BBB 多 1（25）；增減的人分組正確、本場名單人數照 boxscore", async () => {
  const ctx = makeCtx(api()); ({ out: R1 } = await buildRosterStatus(game(), ctx, NOW, null));
  assert.equal(R1.rules, RS_RULES); assert.equal(R1.away.listedN, 4); assert.equal(R1.away.basisN, 5);
  assert.deepEqual(names(R1.away, "out"), ["Al Two", "Al Seven"]); assert.deepEqual(names(R1.away, "in"), ["Al Five"]);
  assert.deepEqual(names(R1.home, "out"), []); assert.deepEqual(names(R1.home, "in"), ["Bo Five"]);
  assert.equal(R1.away.basis.kind, "series"); assert.equal(R1.window.days, 14); assert.equal(R1.away.from, "2026-09-27"); });

await t("官方原因未寫明：Al Two 的異動是 roster status changed → unexplained；Bo Five 的召回有原因（CU）", () => {
  assert.equal(by(R1.away, "Al Two").tx.at(-1).unexplained, true); assert.equal(by(R1.home, "Bo Five").tx.at(-1).type, "CU"); assert.equal(by(R1.home, "Bo Five").tx.at(-1).unexplained, false); });

await t("傷兵／下放／回歸：Al Four 在本場名單內且範圍內登錄傷兵→ilMove；Al Three 回歸→ilMove；Bo Four 基準前下放→recentTx；Al Six 9/20 轉 60 天在範圍外→other；Bo Five 召回後已在名單（in）", () => {
  assert.deepEqual(names(R1.away, "ilMove"), ["Al Four", "Al Three"]); assert.equal(by(R1.away, "Al Four").tx[0].il.kind, "placed"); assert.equal(by(R1.away, "Al Four").tx[0].il.injury, "Right forearm strain");
  assert.deepEqual(names(R1.home, "recentTx"), ["Bo Four"]); assert.deepEqual(names(R1.away, "other"), ["Al Six"]); assert.equal(by(R1.away, "Al Six").status, "D60");
  assert.deepEqual(R1.away.ilBy, { D15: 1, D60: 1 }); assert.equal(R1.away.ilCount, 2); });

await t("球員資料只查需要的人：重點組含 gameLog（例行賽最後出賽、季後賽出賽），折疊組只查 season；跨隊合併成 2 次 people 呼叫", async () => {
  const ctx = makeCtx(api()); const { out: R } = await buildRosterStatus(game(), ctx, NOW, null);
  const pp = ctx.calls.filter(u => u.includes("/people?")); assert.equal(pp.length, 2);
  assert.ok(pp[0].includes("gameLog") && !pp[1].includes("gameLog")); assert.ok(pp[1].includes("personIds=16"));
  assert.equal(ctx.calls.filter(u => u.includes("/roster?")).length, 4); assert.equal(ctx.calls.filter(u => u.includes("/transactions?")).length, 2);
  assert.equal(by(R.away, "Al Three").lastReg, "2026-09-26"); assert.deepEqual(by(R.away, "Al Three").post, [{ date: "2026-10-10", gt: "D", pk: 500, role: "先發投手" }]);
  assert.deepEqual(by(R.away, "Al Two").reg, { pa: 500 }); assert.deepEqual(by(R.away, "Al Six").reg, { g: 10, gs: 10, ip: "55.0" }); assert.equal(by(R.away, "Al Six").lastReg, null); });

await t("同一隊多場共用球隊層級資料：兩場同隊只打一次 40Man／transactions", async () => {
  const ctx = makeCtx(api()); await buildRosterStatus(game(), ctx, NOW, null); await buildRosterStatus({ ...game(), pk: 901 }, ctx, NOW, null);
  assert.equal(ctx.calls.filter(u => u.includes("rosterType=40Man")).length, 2); assert.equal(ctx.calls.filter(u => u.includes("/transactions?")).length, 2); });

await t("輸入未變：不查球員、沿用上一版內容（changed=false、changedAt 不動）；本場名單變了才重算", async () => {
  const ctx = makeCtx(api()); const { out, changed } = await buildRosterStatus(game(), ctx, "2026-10-12T11:00:00Z", R1);
  assert.equal(changed, false); assert.equal(out.changedAt, NOW); assert.equal(out.fetchedAt, "2026-10-12T11:00:00Z"); assert.equal(ctx.calls.filter(u => u.includes("/people?")).length, 0);
  assert.deepEqual(names(out.away, "out"), ["Al Two", "Al Seven"]);
  const r2 = await buildRosterStatus(game({ listedA: [11, 13, 14, 15, 12] }), makeCtx(api()), "2026-10-12T12:00:00Z", R1);
  assert.equal(r2.changed, true); assert.deepEqual(names(r2.out.away, "out"), ["Al Seven"]); });

await t("API 部分失敗沿用上一版：40Man 失敗→丟錯（呼叫端保留上一版並標示）；people 失敗也一樣；不產生半套資料", async () => {
  await assert.rejects(buildRosterStatus(game(), makeCtx(api({ fail: ["40b"] })), NOW, R1), /503 40b/);
  await assert.rejects(buildRosterStatus(game(), makeCtx(api({ fail: ["people"] })), NOW, null), /503 people/);
  await assert.rejects(buildRosterStatus(game(), makeCtx(api({ fail: ["txa"] })), NOW, R1), /503 txa/); });

await t("沒有基準（找不到上一場）：增減不判斷、只列傷兵與近期異動；inBasis＝null", async () => {
  const { out } = await buildRosterStatus(game({ noPrev: true }), makeCtx(api()), NOW, null);
  assert.equal(out.away.basis, null); assert.equal(out.away.basisN, null); assert.deepEqual(out.away.out, []); assert.deepEqual(out.away.in, []);
  assert.deepEqual(names(out.away, "ilMove").sort(), ["Al Four", "Al Three"]); assert.equal(by(out.away, "Al Four").inBasis, null); assert.ok(names(out.away, "recentTx").includes("Al Two")); });

await t("開賽後凍結：呼叫端只處理 status.code＝pre（模擬 CLI 的篩選），非賽前不呼叫 API", async () => {
  const G = game({ status: "live" }), ctx = makeCtx(api());
  if (G.status.code === "pre") await buildRosterStatus(G, ctx, NOW, null);
  assert.equal(ctx.calls.length, 0); });

// ---- 真實快照（849844，2026-10-01 14:50Z）轉 API 形狀：同一套程式、同一組結果 ----
export function snapshotApi(S) {
  const rows = k => (S.rosters[k] || []).map(r => per(r[0], r[1], r[2], r[3]));
  const P = new Map(S.people.map(r => [r[0], r]));
  const people = id => { const p = P.get(id); if (!p) return null; const pit = p[2] === "P";
    return { id, fullName: p[1], primaryPosition: { abbreviation: p[2] }, stats: [
      { type: { displayName: "season" }, group: { displayName: pit ? "pitching" : "hitting" }, splits: [{ gameType: "R", team: { id: 0 }, stat: pit ? { gamesPlayed: p[5], gamesStarted: p[6], inningsPitched: p[4] } : { plateAppearances: p[3] } }] },
      ...(p[7] ? [{ type: { displayName: "gameLog" }, group: { displayName: pit ? "pitching" : "hitting" }, splits: [{ date: p[7], gameType: "R", game: { gamePk: 0 }, stat: {} }] }] : [])] }; };
  return async url => {
    const m = url.match(/teams\/(\d+)\/roster\?rosterType=(\w+)(?:&date=([\d-]+))?/);
    if (m) return { roster: rows(`${m[1]}|${m[2] === "active" ? `active@${m[3]}` : "40Man"}`) };
    const x = url.match(/transactions\?teamId=(\d+)/);
    if (x) { const T = S.transactions[x[1]]; return { transactions: [...T.older, ...T.recent].filter(r => r[2] !== "NUM").map(r => ({ date: r[0], effectiveDate: r[1], typeCode: r[2], person: { id: r[3], fullName: P.get(r[3])?.[1] || null }, description: r[4] })) }; }
    if (url.includes("/people?")) return { people: url.match(/personIds=([\d,]+)/)[1].split(",").map(Number).map(people).filter(Boolean) };
    throw new Error("unexpected " + url);
  };
}
export function snapshotGame(S, pk, basisDate) {
  const G = S.games[pk], side = s => { const t = G[s].team, info = new Map([...(S.rosters[`${t}|40Man`] || []), ...(S.rosters[`${t}|active@${basisDate}`] || [])].map(r => [r[0], r]));
    return { id: t, ab: S.teams[t], name: S.teams[t], sp: null, lineup: { slots: null }, roster: G[s].players.map(id => { const r = info.get(id); return { id, name: r?.[1] || String(id), pos: r?.[2] || null }; }),
      prev: { pk: 0, date: basisDate, gameType: "R", ha: "", opp: "" } }; };
  return { pk: +pk, usDate: G.officialDate, startUTC: G.officialDate + "T00:00:00Z", gameType: G.gameType, series: { desc: "Wild Card Series", n: 1, of: 3 }, status: { code: "pre", raw: G.status }, away: side("away"), home: side("home") };
}
const S = JSON.parse(fs.readFileSync(new URL("./fixtures/roster-849844-20261001T1450Z.json", import.meta.url), "utf8"));
await t("真實快照 849844：PHI 少 3（Arraez、Raley、Lazar）多 1（Kemp）；ATL 少 4 多 2；Pérez 15 天傷兵、Luzardo 範圍內回歸→ilMove；Arraez 原因未寫明", async () => {
  const { out: R } = await buildRosterStatus(snapshotGame(S, 849844, "2026-09-27"), makeCtx(snapshotApi(S)), S.fetchedAtUTC, null);
  assert.equal(R.away.listedN, 26); assert.equal(R.away.basisN, 28); assert.equal(R.away.basis.kind, "regEnd");
  assert.deepEqual(names(R.away, "out").sort(), ["Brooks Raley", "Luis Arraez", "Max Lazar"]); assert.deepEqual(names(R.away, "in"), ["Otto Kemp"]);
  assert.equal(names(R.home, "out").length, 4); assert.deepEqual(names(R.home, "in").sort(), ["Luke Williams", "Rowdy Tellez"]);
  assert.ok(names(R.home, "recentTx").includes("Martín Pérez")); assert.equal(by(R.home, "Martín Pérez").status, "D15");
  assert.deepEqual(names(R.away, "recentTx"), ["Orion Kerkering", "Kyle Backhus"]); // 9/20、9/18 下放的兩人算近期相關；9/28 只被召回到 40 人名單、9/17 轉 60 天傷兵、被他隊認領的人都不算近期相關（折疊層或不列）
  assert.ok(!R.away.people.some(p => /^\d+$/.test(p.name))); // 不在 40 人名單、也不在本場／基準名單的人（例如被他隊認領）不列
  assert.ok(names(R.away, "ilMove").includes("Jesús Luzardo")); assert.ok(by(R.away, "Luis Arraez").tx.some(x => x.unexplained));
  assert.equal(R.away.ilCount, 5); assert.deepEqual(R.home.ilBy, { D60: 5, D15: 1 }); });

console.log(`名單狀態測試 ${n}/${n} 通過`);
