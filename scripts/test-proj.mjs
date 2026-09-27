// 預估打線離線測試：node scripts/test-proj.mjs
// HTML 樣本照 2026-09-27 13:05Z 在 Chrome 實際看到的 RotoWire／RotoGrinders 結構縮寫（名字是當時兩站 HOU@ATH 的真實內容）
import assert from "node:assert/strict";
import { parseRotoWire, parseRotoGrinders, crossCheck, nextTeam, frozen, matchGames, pkey } from "./lineup-proj.mjs";

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
console.log(`預估打線測試 ${n}/${n} 通過`);
