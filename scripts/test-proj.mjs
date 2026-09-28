// 預估打線離線測試：node scripts/test-proj.mjs
// HTML 樣本照 2026-09-27 13:05Z 在 Chrome 實際看到的 RotoWire／RotoGrinders 結構縮寫（名字是當時兩站 HOU@ATH 的真實內容）
import assert from "node:assert/strict";
import { parseRotoWire, parseRotoGrinders, crossCheck, nextTeam, frozen, matchGames, pkey, cmpLists, crossCmp, withOfficial, updateSources } from "./lineup-proj.mjs";

let n = 0; const t = (name, f) => { f(); n++; console.log("ok", name); };
const rwLi = ([pos, name, b]) => `<li class="lineup__player"><div class="lineup__pos">${pos}</div><a title="${name}" href="/baseball/player/x-1">${name.split(" ").at(-1)}</a><span class="lineup__bats">${b}</span></li>`;
const rwSide = (cls, rows, st = "is-expected", label = "Expected Lineup") => `<ul class="lineup__list ${cls}"><li class="lineup__player-highlight mb-0"><div>SP</div></li><li class="lineup__status ${st}"><div class="dot"></div> ${label}</li>${rows.map(rwLi).join("")}</ul>`;
const HOU = [["SS", "Jeremy Pena", "R"], ["DH", "Yordan Alvarez", "L"], ["3B", "Isaac Paredes", "R"], ["2B", "Jose Altuve", "R"], ["C", "Yainer Diaz", "R"], ["1B", "Christian Walker", "R"], ["RF", "Cam Smith", "R"], ["CF", "Lucas Spence", "L"], ["LF", "Nelson Vel&aacute;zquez", "R"]];
const ATH = [["CF", "Henry Bolte", "R"], ["2B", "Jeff McNeil", "L"], ["C", "Shea Langeliers", "R"], ["RF", "Lawrence Butler", "L"], ["3B", "Zack Gelof", "R"], ["SS", "Donovan Walton", "L"], ["LF", "Carlos Cortes", "L"], ["DH", "Jonah Heim", "S"], ["1B", "Alika Williams", "R"]];
const RW_HTML = `<div class="lineup is-mlb is-tools"><div>tools</div></div>
<div class="lineup is-mlb not-in-slate"><div class="lineup__time">3:05 PM ET</div><div class="lineup__abbr">HOU</div><div class="lineup__abbr">ATH</div><div class="lineup__main">${rwSide("is-visit", HOU)}${rwSide("is-home", ATH, "is-confirmed", "Confirmed Lineup")}</div></div>
<div class="lineup is-mlb"><div class="lineup__time">3:10 PM ET</div><div class="lineup__abbr">ARI</div><div class="lineup__abbr">SD</div><div class="lineup__main">${rwSide("is-visit", HOU.slice(0, 3))}${rwSide("is-home", [])}</div></div>`;
const rgLi = (name, k) => `<li class="lineup-card-player"><span class="player-nameplate disabled" data-position=""><span class="small">${k + 1}</span><div class="player-nameplate-info"><a class="player-nameplate-name" data-role="modal" href="/players/x">${name}</a></div></span></li>`;
const rgCard = names => `<div class="lineup-card"><div class="lineup-card-header"><div class="lineup-card-pitcher break"><a class="player-nameplate-name" href="/p">Pitcher</a></div></div><div class="lineup-card-body unconfirmed"><ul class="lineup-card-players">${names.map(rgLi).join("")}</ul></div></div>`;
const RG_HTML = `<h1> MLB STARTING LINEUPS <span class="muted"> Sep 27, 2026 (15 Games) </span></h1>
<div class="module game-card"><div class="game-card-teams"><span class="team-nameplate-title" data-abbr="HOU">x</span><span class="team-nameplate-title" data-abbr="ATH">y</span></div><div class="game-card-lineups">
${rgCard(["Jeremy Pena", "Yordan Alvarez", "Isaac Paredes", "Jose Altuve", "Yainer Diaz", "Christian Walker", "Lucas Spence", "Cam Smith", "Taylor Trammell"])}
${rgCard(["Henry Bolte", "Lawrence Butler", "Shea Langeliers", "Jeff McNeil", "Zack Gelof", "Donnie Walton", "Carlos Cortes", "Tommy White", "Jonah Heim"])}</div></div>`;

const rw = parseRotoWire(RW_HTML), rg = parseRotoGrinders(RG_HTML);
t("RotoWire：略過工具區塊、解析棒次／守位／左右打／來源標示、ARI→AZ", () => {
  assert.equal(rw.length, 2);
  assert.deepEqual([rw[0].away, rw[0].home, rw[1].away], ["HOU", "ATH", "AZ"]);
  assert.equal(rw[0].sides.away.status, "Expected Lineup"); assert.equal(rw[0].sides.away.statusKey, "expected");
  assert.equal(rw[0].sides.home.statusKey, "confirmed");
  assert.deepEqual(rw[0].sides.away.slots[8], { n: 9, pos: "LF", name: "Nelson Velázquez", bats: "R" });
  assert.equal(rw[1].sides.home.slots.length, 0);
});
t("RotoGrinders：日期、隊伍、兩張卡依客主順序、投手不算進棒次", () => {
  assert.equal(rg.date, "2026-09-27"); assert.equal(rg.games.length, 1);
  assert.equal(rg.games[0].sides.away.slots.length, 9); assert.equal(rg.games[0].sides.home.slots[5].name, "Donnie Walton");
  assert.equal(rg.games[0].sides.away.unconfirmed, true);
});
t("名字比對鍵：同一人不同寫法視為同一人", () => {
  assert.equal(pkey("Donovan Walton"), pkey("Donnie Walton")); assert.equal(pkey("J.T. Realmuto"), pkey("JT Realmuto"));
  assert.equal(pkey("Luis Garcia Jr."), pkey("Luis García")); assert.notEqual(pkey("Cam Smith"), pkey("Lucas Spence"));
});
t("逐棒比對：棒次互換、人選不同、寫法不同", () => {
  const a = crossCheck(rw[0].sides.away.slots, rg.games[0].sides.away).filter(s => s.check === "diff").map(s => [s.n, s.alt, s.altAt]);
  assert.deepEqual(a, [[7, "Lucas Spence", 8], [8, "Cam Smith", 7], [9, "Taylor Trammell", null]]);
  const h = crossCheck(rw[0].sides.home.slots, rg.games[0].sides.home).filter(s => s.check === "diff").map(s => s.n);
  assert.deepEqual(h, [2, 4, 8, 9]); // 6 棒 Donovan／Donnie Walton 視為一致
  assert.ok(crossCheck(rw[0].sides.away.slots, null).every(s => s.check === "none"));
});
const G = { pk: 1, usDate: "2026-09-27", startUTC: "2026-09-27T19:05:00Z", tbd: false, status: { code: "pre" }, away: { ab: "HOU", lineup: { state: "none" } }, home: { ab: "ATH", lineup: { state: "official" } } };
t("首次取得時間只寫一次、距表定開賽分鐘數、名單變了才更新 changedAt", () => {
  const p1 = nextTeam(null, rw[0].sides.away, rg.games[0].sides.away, G, "2026-09-27T13:05:00.000Z", "2026-09-27T13:05:00.000Z");
  assert.equal(p1.firstSeen, "2026-09-27T13:05:00.000Z"); assert.equal(p1.firstSeenMinutesBeforeScheduledStart, 360);
  assert.deepEqual(p1.uncertain, [7, 8, 9]); assert.equal(p1.cross, "RotoGrinders");
  const p2 = nextTeam(p1, rw[0].sides.away, rg.games[0].sides.away, G, "2026-09-27T13:20:00.000Z", "x");
  assert.equal(p2.firstSeen, p1.firstSeen); assert.equal(p2.changedAt, p1.changedAt); assert.equal(p2.firstSeenMinutesBeforeScheduledStart, 360);
  const moved = { ...rw[0].sides.away, slots: rw[0].sides.away.slots.map(s => s.n === 9 ? { ...s, name: "Taylor Trammell" } : s) };
  const p3 = nextTeam(p2, moved, rg.games[0].sides.away, G, "2026-09-27T14:00:00.000Z", "x");
  assert.equal(p3.changedAt, "2026-09-27T14:00:00.000Z"); assert.deepEqual(p3.uncertain, [7, 8]);
  assert.equal(nextTeam(p3, { slots: [] }, null, G, "2026-09-27T15:00:00.000Z").missingSince, "2026-09-27T15:00:00.000Z");
  assert.equal(nextTeam(null, rw[0].sides.away, null, { ...G, tbd: true }, "2026-09-27T13:05:00.000Z").firstSeenMinutesBeforeScheduledStart, null);
});
t("官方打線已出或已開賽：凍結", () => {
  assert.equal(frozen(G, "away"), false); assert.equal(frozen(G, "home"), true);
  assert.equal(frozen({ ...G, status: { code: "live" } }, "away"), true);
});
t("對到本站比賽：美東日期＋客主隊；雙重賽依開賽時間順序", () => {
  const games = [G, { ...G, pk: 2, away: { ab: "AZ" }, home: { ab: "SD" } }, { ...G, pk: 3, startUTC: "2026-09-27T23:05:00Z" }];
  const m = matchGames(games, [...rw, { ...rw[0], time: "7:05 PM ET" }].map(x => ({ ...x, date: "2026-09-27" })), x => x.date);
  assert.equal(m.get(1).time, "3:05 PM ET"); assert.equal(m.get(3).time, "7:05 PM ET"); assert.equal(m.get(2).away, "AZ");
  assert.equal(matchGames(games, rw.map(x => ({ ...x, date: "2026-09-28" })), x => x.date).size, 0);
});
const S = names => names.map((name, k) => ({ n: k + 1, name, pos: null }));
t("兩站摘要：光芒型（人選 9/9、棒次 5/9）與人選不同分開算", () => {
  const TB_RW = S(["Yandy Diaz", "Jonathan Aranda", "Junior Caminero", "Liam Hicks", "Victor Mesa", "Jonny DeLuca", "Richie Palacios", "Cedric Mullins", "Taylor Walls"]);
  const TB_RG = { slots: S(["Yandy Diaz", "Jonathan Aranda", "Liam Hicks", "Junior Caminero", "Victor Mesa", "Richie Palacios", "Jonny DeLuca", "Cedric Mullins", "Taylor Walls"]) };
  assert.deepEqual(crossCmp(crossCheck(TB_RW, TB_RG)), { people: 9, order: 5, n: 9 });
  assert.deepEqual(crossCmp(crossCheck(rw[0].sides.away.slots, rg.games[0].sides.away)), { people: 8, order: 6, n: 9 }); // HOU：9 棒人選不同、7／8 棒互換
  assert.equal(crossCmp(crossCheck(TB_RW, null)), null); // 單一來源：不算摘要
});
t("首份完整預估：記第一次 9 人名單與當時時間，之後名單改了也不動", () => {
  const p1 = nextTeam(null, rw[0].sides.away, null, G, "2026-09-27T13:05:00.000Z");
  assert.equal(p1.first.at, "2026-09-27T13:05:00.000Z"); assert.equal(p1.first.slots[8].name, "Nelson Velázquez");
  const moved = { ...rw[0].sides.away, slots: rw[0].sides.away.slots.map(s => s.n === 9 ? { ...s, name: "Taylor Trammell" } : s) };
  const p2 = nextTeam(p1, moved, null, G, "2026-09-27T15:00:00.000Z");
  assert.equal(p2.first.at, p1.first.at); assert.equal(p2.first.slots[8].name, "Nelson Velázquez"); assert.equal(p2.slots[8].name, "Taylor Trammell");
  const legacy = { ...p2, first: undefined, changedAt: "2026-09-27T15:00:00.000Z" }; // v0.1 紀錄、名單改過：首份無法補回
  assert.equal(nextTeam(legacy, moved, null, G, "2026-09-27T16:00:00.000Z").first, null);
  const legacySame = { ...p1, first: undefined }; // v0.1 紀錄、名單沒改過：首份＝firstSeen 那份
  assert.equal(nextTeam(legacySame, rw[0].sides.away, null, G, "2026-09-27T16:00:00.000Z").first.at, "2026-09-27T13:05:00.000Z");
  assert.equal(nextTeam(null, { slots: rw[0].sides.away.slots.slice(0, 5) }, null, G, "2026-09-27T13:05:00.000Z").first, null); // 不滿 9 人不算完整
});
t("官方對照：第一次官方名單是基準；臨場異動另記、不覆蓋；對照首份與最後一版", () => {
  const first = { at: "2026-09-27T13:05:00.000Z", slots: S(["A One", "B Two", "C Three", "D Four", "E Five", "F Six", "G Seven", "H Eight", "I Nine"]) };
  const p = { first, slots: S(["A One", "B Two", "C Three", "D Four", "E Five", "G Seven", "F Six", "H Eight", "J Ten"]) };
  const off = S(["A One", "B Two", "C Three", "D Four", "E Five", "G Seven", "F Six", "H Eight", "I Nine"]);
  const q = withOfficial(p, { state: "official", firstSeen: "2026-09-27T16:00:00.000Z", slots: off }, "2026-09-27T16:00:10.000Z");
  assert.equal(q.official.at, "2026-09-27T16:00:00.000Z");
  assert.deepEqual(q.vsOfficial.first, { people: 9, order: 7, n: 9 }); assert.deepEqual(q.vsOfficial.last, { people: 8, order: 8, n: 9 });
  const lateL = { state: "late", firstSeen: "2026-09-27T16:00:00.000Z", lateAt: "2026-09-27T18:00:00.000Z", slots: off.map(s => s.n === 9 ? { ...s, name: "K Eleven" } : s) };
  const r = withOfficial(q, lateL, "2026-09-27T18:00:05.000Z");
  assert.equal(r.official.slots[8].name, "I Nine"); assert.equal(r.officialLate.at, "2026-09-27T18:00:00.000Z"); assert.equal(r.officialLate.slots[8].name, "K Eleven");
  assert.deepEqual(r.vsOfficial, q.vsOfficial); // 對照基準不變
  assert.equal(withOfficial(r, lateL, "2026-09-27T18:15:00.000Z").officialLate.at, "2026-09-27T18:00:00.000Z"); // 同一份異動不重記
  assert.equal(withOfficial(p, lateL, "x").official.capturedAfterLate, true); // 第一次看到就已是異動後
  assert.equal(withOfficial(p, { state: "withdrawn", slots: null }, "x").official, undefined);
  assert.equal(cmpLists(null, off), null);
});
t("來源觀察紀錄：首次時間不改；對到本站比賽另記時間；過期刪除；不滿 9 人不記", () => {
  const o = [{ key: "RotoWire|2026-09-29|PHI@ATL|away", source: "RotoWire", date: "2026-09-29", team: "PHI", slots: S(Array(9).fill("x y")), pk: null },
    { key: "RotoWire|2026-09-29|CWS@HOU|away", source: "RotoWire", date: "2026-09-29", team: "CWS", slots: [], pk: null }];
  const l1 = updateSources({ old: { date: "2026-09-01" } }, o, "2026-09-28T13:00:00Z", "2026-09-18");
  assert.deepEqual(Object.keys(l1), ["RotoWire|2026-09-29|PHI@ATL|away"]); assert.equal(l1["RotoWire|2026-09-29|PHI@ATL|away"].pk, null);
  const l2 = updateSources(l1, [{ ...o[0], pk: 849845 }], "2026-09-28T16:00:00Z", "2026-09-18");
  const e = l2["RotoWire|2026-09-29|PHI@ATL|away"];
  assert.equal(e.first, "2026-09-28T13:00:00Z"); assert.equal(e.pk, 849845); assert.equal(e.inScopeAt, "2026-09-28T16:00:00Z");
  assert.equal(updateSources(l2, [{ ...o[0], pk: 849845 }], "2026-09-28T16:15:00Z", "2026-09-18")["RotoWire|2026-09-29|PHI@ATL|away"].inScopeAt, "2026-09-28T16:00:00Z");
});
console.log(`預估打線測試 ${n}/${n} 通過`);
