// build-live 單場抓取失敗／來源撤回的情境測試（離線，不連網）
// 執行：node scripts/test-build-live.mjs
import { build } from "./build-live.mjs";

let total = 0; const fails = []; const check = (n, c) => { total++; console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails.push(n); };
const T1 = { id: 147, name: "New York Yankees", abbreviation: "NYY" }, T2 = { id: 111, name: "Boston Red Sox", abbreviation: "BOS" };
const PK = 900, PREV = 800;
const game = (pk, date, state, sp = {}) => ({ gamePk: pk, gameDate: date, officialDate: date.slice(0, 10), status: { abstractGameState: state, detailedState: state === "Final" ? "Final" : "Scheduled" },
  venue: { name: "Yankee Stadium", timeZone: { id: "America/New_York" } }, doubleHeader: "N", gameNumber: 1,
  teams: { away: { team: T2, score: 3, probablePitcher: sp.away }, home: { team: T1, score: 5, probablePitcher: sp.home } } });
const nine = base => Object.fromEntries(Array.from({ length: 9 }, (_, i) => ["ID" + (base + i), { person: { id: base + i, fullName: `P${base + i}` }, battingOrder: String((i + 1) * 100), allPositions: [{ abbreviation: "CF" }], seasonStats: { batting: { avg: ".250", ops: ".700" } } }]));
const box = on => ({ teams: { away: { players: on ? nine(100) : {} }, home: { players: on ? nine(200) : {} } } });
const SP1 = { id: 1, fullName: "Ace One" }, SP2 = { id: 2, fullName: "Ace Two" }, SP3 = { id: 3, fullName: "New Guy" };

// opt：fail＝要失敗的項目（box、prevbox、people、standings、hitting、pitching），lineup＝本場 boxscore 有沒有打線，sp＝先發
function api({ fail = [], lineup = true, sp = { away: SP2, home: SP1 } } = {}) {
  return async url => {
    const no = k => { if (fail.includes(k)) throw new Error(`HTTP 503 ${k}`); };
    if (url.includes("/schedule")) return { dates: [{ games: [game(PREV, "2026-09-23T23:05:00Z", "Final"), game(PK, "2026-09-24T23:05:00Z", "Preview", sp)] }] };
    if (url.includes("/standings")) { no("standings"); return { records: [{ teamRecords: [T1, T2].map((t, i) => ({ team: t, wins: 90 - i, losses: 70 + i, winningPercentage: ".560", records: { splitRecords: [] }, streak: { streakCode: "W2" }, runsScored: 700, runsAllowed: 600, gamesPlayed: 160 })) }] }; }
    if (url.includes("group=hitting")) { no("hitting"); return { stats: [{ splits: [T1, T2].map(t => ({ team: t, stat: { ops: ".750" } })) }] }; }
    if (url.includes("group=pitching")) { no("pitching"); return { stats: [{ splits: [T1, T2].map(t => ({ team: t, stat: { era: "3.80" } })) }] }; }
    if (url.includes("/people")) { no("people"); return { people: [SP1, SP2, SP3].map(p => ({ id: p.id, pitchHand: { code: "R" }, stats: [{ splits: [{ stat: { wins: 10, losses: 5, era: "3.10", inningsPitched: "150.0", gamesStarted: 28, whip: "1.10", strikeOuts: 170, baseOnBalls: 40 } }] }] })) }; }
    if (url.includes(`/game/${PK}/boxscore`)) { no("box"); return box(lineup); }
    if (url.includes(`/game/${PREV}/boxscore`)) { no("prevbox"); return box(true); }
    throw new Error("unexpected " + url);
  };
}
let state = { games: {} };
const run = async (at, opt, P0) => { const R = await build({ fetchJson: api(opt), now: new Date(at), state, prevGame: () => P0 ? JSON.parse(JSON.stringify(P0)) : null }); state = R.state; return R; };

// A：全部成功
const A = await run("2026-09-24T12:00:00Z", {}); const a = A.games[PK];
check("A 全部成功：兩隊官方打線、沒有 failed", a.away.lineup.state === "official" && a.home.lineup.slots?.length === 9 && !a.away.failed && !a.home.failed);

// B：本場 boxscore、people、standings、hitting 都失敗 → 沿用 A 的值並標示 A 的取得時間
const B = await run("2026-09-24T12:15:00Z", { fail: ["box", "people", "standings", "hitting", "prevbox"] }, a); const b = B.games[PK];
check("B 打線抓失敗：沿用上一版 9 人，不是清空", b.home.lineup.slots?.length === 9 && b.home.lineup.state === "official");
check("B 打線標示失敗起點＝本次、舊值取得時間＝A", b.home.failed?.lineup?.since === "2026-09-24T12:15:00.000Z" && b.home.failed.lineup.fetchedAt === a.updatedAt);
check("B 先發成績抓失敗：同一位先發 → 沿用成績並標示", b.home.sp.s?.era === "3.10" && b.home.failed?.sp?.fetchedAt === a.updatedAt);
check("B 戰績／OPS 抓失敗：沿用；ERA 成功：不標示", b.home.rec === a.home.rec && b.home.ops === ".750" && b.home.failed?.rec && b.home.failed?.ops && !b.home.failed?.era);
check("B 上一場打線抓失敗：沿用並標示", b.away.prev.slots?.length === 9 && b.away.failed?.prev?.fetchedAt === a.updatedAt);
check("B 全場打線狀態仍為 official", b.lineup === "official");

// C：連續第二次失敗 → 失敗起點與舊值取得時間都不變（不因這批其他項目成功而刷新）
const C = await run("2026-09-24T12:30:00Z", { fail: ["box"] }, b); const c = C.games[PK];
check("C 連續失敗：since 仍是 B、fetchedAt 仍是 A", c.home.failed?.lineup?.since === b.home.failed.lineup.since && c.home.failed.lineup.fetchedAt === a.updatedAt);
check("C 這次成功的項目不再標示失敗", !c.home.failed?.sp && !c.home.failed?.rec && !c.home.failed?.ops && !c.away.failed?.prev);

// D：boxscore 成功但來源沒有打線了 → 來源撤回，不是抓取失敗
const D = await run("2026-09-24T12:45:00Z", { lineup: false }, c); const d = D.games[PK];
check("D 來源撤回：state=withdrawn、slots=null、有 withdrawnAt、沒有 failed.lineup", d.home.lineup.state === "withdrawn" && d.home.lineup.slots === null && d.home.lineup.withdrawnAt === "2026-09-24T12:45:00.000Z" && !d.home.failed?.lineup);
check("D 記下 lineup_withdrawn 事件", D.events.some(e => e.type === "lineup_withdrawn" && e.side === "home"));
check("D 全場打線狀態＝none（撤回不算有打線）", d.lineup === "none");
// D2：撤回後 boxscore 又抓失敗 → 保留「撤回」而不是變回未公布
const D2 = await run("2026-09-24T13:00:00Z", { fail: ["box"] }, d); const d2 = D2.games[PK];
check("D2 撤回後抓失敗：仍顯示撤回、標示失敗、沒有舊打線可用", d2.home.lineup.state === "withdrawn" && d2.home.failed?.lineup?.fetchedAt === null);
// D3：來源重新公布 → 回到官方，不再標撤回
const D3 = await run("2026-09-24T13:15:00Z", {}, d2); const d3 = D3.games[PK];
check("D3 重新公布：有 9 人、沒有 withdrawnAt、沒有 failed", d3.home.lineup.slots?.length === 9 && !d3.home.lineup.withdrawnAt && !d3.home.failed);

// E：沒有上一版就失敗 → 不捏造，標示「沒有舊值」
state = { games: {} };
const E = await run("2026-09-24T12:00:00Z", { fail: ["box"] }, null); const e = E.games[PK];
check("E 沒有上一版：打線 none、failed.lineup.fetchedAt=null", e.home.lineup.state === "none" && e.home.lineup.slots === null && e.home.failed?.lineup?.fetchedAt === null);

// F：來源換先發（people 成功）→ 照新的，不算失敗
const F = await run("2026-09-24T12:15:00Z", { sp: { away: SP2, home: SP3 } }, a); const f = F.games[PK];
check("F 來源換先發：顯示新先發與其成績、沒有 failed.sp", f.home.sp.name === "New Guy" && f.home.sp.s?.era === "3.10" && !f.home.failed?.sp);
// G：換先發且 people 失敗 → 不能沿用別人的成績
const G = await run("2026-09-24T12:30:00Z", { sp: { away: SP2, home: SP1 }, fail: ["people"] }, f); const g = G.games[PK];
check("G 換先發＋成績抓失敗：成績為 null、標示沒有舊值", g.home.sp.name === "Ace One" && g.home.sp.s === null && g.home.failed?.sp?.fetchedAt === null);

console.log(`\n${fails.length ? "FAIL" : "PASS"}：${total - fails.length}/${total}`);
process.exit(fails.length ? 1 : 0);
