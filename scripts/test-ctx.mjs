// 情境卡規則的離線測試（不連網）：node scripts/test-ctx.mjs
import { compute, decide, MAXCARDS, RULES } from "./ctx.mjs";
import { summarizePost, pickEntry, pending } from "./post.mjs";

let total = 0; const fails = []; const check = (n, c) => { total++; console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails.push(n); };
const team = (o = {}) => ({ id: 1, name: "甲", rec: "80-70", l10: "5-5", streak: "W1", home: "40-35", road: "40-35", rs: 700, ra: 700, gp: 150, ops: ".720",
  sp: { name: "P", s: { whip: "1.10", era: "3.50", ip: "150.0", gs: 25 } }, ...o });
const game = (o = {}) => ({ pk: 1, usDate: "2026-09-25", venue: "V", startUTC: "2026-09-25T23:05:00Z", twTime: "07:05", tbd: false, dh: null, status: { code: "pre" }, updatedAt: "t",
  away: team({ id: 1, name: "甲" }), home: team({ id: 2, name: "乙" }), ...o });
const day = (st, p, extra = {}) => ({ st, complete: st === "played", rpPitches: st === "played" ? p : null, rpAppsNoCount: 0, ...extra });
const bp = (a, h, pa = [], ph = []) => ({ status: "ok", fetchedAt: "t", summary: { away: { days: a, pitchers: pa }, home: { days: h, pitchers: ph } } });
const st = (r, id) => r.checks.find(c => c.id === id);
const run = (g, b = null, all = [g]) => compute(g, b, all, "2026-09-25T12:00:00.000Z");

// 近十場：剛好等於門檻算成立
check("近十場 7-3 vs 5-5（.700、差 .200）＝ hit", st(run(game({ away: team({ l10: "7-3" }) })), "l10").state === "hit");
check("近十場 7-3 vs 6-4（差 .100）＝ miss", st(run(game({ away: team({ l10: "7-3" }), home: team({ l10: "6-4" }) })), "l10").state === "miss");
check("近十場缺值＝ na，不當成 0", st(run(game({ away: team({ l10: null }) })), "l10").state === "na");

// 先發 WHIP
const sp = (whip, ip) => ({ name: "P", s: { whip, era: "2.00", ip, gs: 20 } });
check("WHIP 0.93／0.98、局數 165.1／106.0 ＝ hit", st(run(game({ away: team({ sp: sp("0.93", "165.1") }), home: team({ sp: sp("0.98", "106.0") }) })), "whip").state === "hit");
check("局數 99.2（未滿 100）＝ miss", st(run(game({ away: team({ sp: sp("0.93", "99.2") }), home: team({ sp: sp("0.98", "106.0") }) })), "whip").state === "miss");
check("先發未公布＝ na", st(run(game({ home: team({ sp: null }) })), "whip").state === "na");

// 牛棚：前三日完整才比
const full = p => [day("played", p), day("off"), day("played", 0)];
check("牛棚差 80 球＝ hit", st(run(game(), bp([...full(150), day("off")], [...full(70), day("off")])), "bp_load").state === "hit");
check("牛棚差 79 球＝ miss", st(run(game(), bp([...full(149), day("off")], [...full(70), day("off")])), "bp_load").state === "miss");
check("有一天不完整＝ na（不拿部分小計比）", st(run(game(), bp([day("played", 150), day("incomplete", 40, { complete: false }), day("played", 0), day("off")], [...full(10), day("off")])), "bp_load").state === "na");
check("有登板但球數缺＝ na", st(run(game(), bp([day("played", 150, { rpAppsNoCount: 1 }), day("off"), day("off"), day("off")], [...full(10), day("off")])), "bp_load").state === "na");
check("牛棚資料沒取得＝ na", st(run(game(), null), "bp_load").state === "na" && st(run(game(), { status: "failed" }), "bp_streak").state === "na");
const P = (name, streak) => ({ name, streak });
check("一方 2 位連投 2 天＝ hit，列出姓名", (() => { const c = st(run(game(), bp([...full(10), day("off")], [...full(10), day("off")], [P("A", 2), P("B", 3), P("C", 1)])), "bp_streak"); return c.state === "hit" && c.says[0].includes("A 連 2 天") && c.says[0].includes("B 連 3 天"); })());
check("只有 1 位＝ miss", st(run(game(), bp([...full(10), day("off")], [...full(10), day("off")], [P("A", 2)], [P("B", 2)])), "bp_streak").state === "miss");

// 雙重賽：找到同一天另一場，寫「表定開賽相差」
const g1 = game({ pk: 11, dh: "G1", startUTC: "2026-09-25T17:05:00Z", twTime: "01:05", rescheduledFrom: "2026-05-23T17:35:00Z" }), g2 = game({ pk: 12, dh: "G2" });
const d2 = st(run(g2, null, [g1, g2]), "dh");
check("G2：找到 G1、相差 6 小時、註明延賽補賽", d2.state === "hit" && d2.nums.some(n => n.v === "6 小時") && d2.says[0].includes("5/23"));
check("雙重賽文字不出現「休息 N 小時」", !JSON.stringify(d2).match(/休息 ?\d/));
check("非雙重賽＝ miss", st(run(game()), "dh").state === "miss");

// 每條都有紀錄：成立、未達、資料不足都記
const r = run(game({ away: team({ l10: "8-2" }), home: team({ sp: null }) }));
check("九條規則都留紀錄", r.checks.length === 9 && r.checks.every(c => ["hit", "miss", "na"].includes(c.state)));
check("未達的記實際算出值、資料不足的記原因", r.checks.filter(c => c.state === "miss").every(c => c.value) && r.checks.filter(c => c.state === "na").every(c => c.why));
check("hits 只列成立的", r.hits.every(id => st(r, id).state === "hit") && r.hits.length === r.checks.filter(c => c.state === "hit").length);
check("MAXCARDS＝5", MAXCARDS === 5);

// 凍結：開賽後沿用最後一次賽前的結果
const pre = run(game()), live = run(game({ status: { code: "live" } }));
const NOW = "2026-09-25T23:10:00.000Z", L = { status: { code: "live" } };
check("賽前：用這次算的，sample＝pregame", (() => { const r = decide(game(), pre, run(game()), NOW); return r.updatedAt === "2026-09-25T12:00:00.000Z" && r.sample === "pregame"; })());
check("開賽後、有賽前紀錄：checks 原封不動沿用，記下凍結時間與距開賽分鐘", (() => { const r = decide(game(L), pre, live, NOW); return r.checks === pre.checks && r.sample === "pregame" && r.frozen.at === NOW && r.frozen.minutesBeforeStart === 665; })());
check("已凍結的再跑一次：完全不變", (() => { const a = decide(game(L), pre, live, NOW); return decide(game(L), a, live, "2026-09-26T01:00:00.000Z") .frozen.at === NOW; })());
check("開賽後、沒有賽前紀錄：sample＝late（不列入賽前樣本）、不加 frozen", (() => { const r = decide(game(L), null, live, NOW); return r.sample === "late" && !r.frozen; })());
check("延賽也凍結", decide(game({ status: { code: "ppd" } }), pre, run(game({ status: { code: "ppd" } })), NOW).checks === pre.checks);
check("v0.2 舊紀錄（沒有 game、sample）凍結時補上", (() => { const old = { ...pre }; delete old.game; delete old.sample; const r = decide(game(L), old, live, NOW); return r.game.pk === 1 && r.sample === "pregame"; })());

// ── v0.3：資料不足、未達、成立要分清楚 ──
check(`規則版本＝${RULES}`, RULES === "ctx-rules v0.3");
const spx = (whip, ip) => ({ name: "P", s: { whip, era: null, ip, gs: 20 } });
check("WHIP 缺值、局數有值＝ na（v0.2 會因 null < 1 判成立）", st(run(game({ away: team({ sp: spx("0.90", "150.0") }), home: team({ sp: spx(null, "120.0") }) })), "whip").state === "na");
check("WHIP 為 -.-- ＝ na", st(run(game({ away: team({ sp: spx("0.90", "150.0") }), home: team({ sp: spx("-.--", "120.0") }) })), "whip").state === "na");
check("局數缺值＝ na", st(run(game({ away: team({ sp: spx("0.90", null) }), home: team({ sp: spx("0.80", "120.0") }) })), "whip").state === "na");
check("OPS 為 -.--- ＝ na（v0.2 會因 NaN 判成立）", st(run(game({ home: team({ ops: "-.---" }) })), "ops").state === "na");
check("得分缺值＝ na", st(run(game({ home: team({ rs: null }) })), "rpg").state === "na" && st(run(game({ home: team({ gp: 0 }) })), "rapg").state === "na");
check("近十場 0-0 ＝ na", st(run(game({ home: team({ l10: "0-0" }) })), "l10").state === "na");
const unc = (st, p = null) => ({ st, complete: false, rpPitches: p, rpAppsNoCount: 0 });
check("牛棚有缺場、確認 0 位＝ na（v0.2 會判未達）", st(run(game(), bp([day("played", 10), unc("incomplete", 5), day("played", 0), day("off")], [...full(10), day("off")])), "bp_streak").state === "na");
check("有人連投天數不確定、確認 1 位＝ na", st(run(game(), bp([...full(10), day("off")], [...full(10), day("off")], [{ name: "A", streak: 1, streakUncertain: true }])), "bp_streak").state === "na");
check("本日 G1 還在打（partial）、確認 0 位＝ na", st(run(game(), bp([...full(10), unc("partial", 5)], [...full(10), day("off")])), "bp_streak").state === "na");
check("有缺場但已確認 2 位＝ hit（人數只會少算）", (() => { const c = st(run(game(), bp([day("played", 10), unc("incomplete", 5), day("played", 0), day("off")], [...full(10), day("off")], [P("A", 2), P("B", 2)])), "bp_streak"); return c.state === "hit" && c.v.awayUncertain === true && c.value.includes("2+"); })());
check("資料齊全、0 位＝ miss", st(run(game(), bp([...full(10), day("off")], [...full(10), day("off")])), "bp_streak").state === "miss");

// 沿用舊值：照算，但標出來，不當成剛確認的新資料
const failRec = { rec: { since: "2026-09-26T10:00:00Z", error: "HTTP 503", fetchedAt: "2026-09-26T09:30:00Z" } };
const sg = run(game({ away: team({ l10: "8-2", failed: failRec }) }));
check("戰績沿用舊值：近十場仍成立，但標 stale（哪一項、哪一隊、舊值時間）", (() => { const c = st(sg, "l10"); return c.state === "hit" && c.stale?.[0].what === "rec" && c.stale[0].side === "away" && c.stale[0].fetchedAt === "2026-09-26T09:30:00Z"; })());
check("戰績沿用舊值：平均得分、主場也標；OPS、先發不標", ["rpg", "rapg", "home"].every(id => st(sg, id).stale) && !st(sg, "ops").stale && !st(sg, "whip").stale);
check("沒有舊值可用（fetchedAt null）：不標 stale，照資料不足處理", !st(run(game({ away: team({ l10: null, failed: { rec: { since: "x", fetchedAt: null } } }) })), "l10").stale);
check("牛棚重抓失敗沿用上一版：兩條牛棚規則都標 stale", (() => { const b = { ...bp([...full(150), day("off")], [...full(10), day("off")]), retryFailedSince: "2026-09-26T10:00:00Z", fetchedAt: "2026-09-26T09:00:00Z" }; const r = run(game(), b); return st(r, "bp_load").stale?.[0].what === "bullpen" && st(r, "bp_streak").stale?.[0].what === "bullpen"; })());
check("整場整理失敗：所有有結果的規則都標 stale", (() => { const r = run(game({ failed: { game: { since: "a", fetchedAt: "b" } } })); return r.checks.filter(c => c.state !== "na").every(c => c.stale?.some(x => x.what === "game")); })());

// 紀錄要能直接計算：身分、門檻、數值
check("紀錄有比賽與球隊識別、開賽時間", (() => { const g = pre.game; return g.pk === 1 && g.usDate && g.startUTC && g.away.id === 1 && g.home.id === 2; })());
check("每條有 th（門檻數值），未達與成立都有 v（算出數值）", pre.checks.filter(c => c.id !== "dh").every(c => c.th) && pre.checks.filter(c => c.state !== "na").every(c => c.v && typeof c.v === "object"));
check("近十場 v 是數字", (() => { const v = st(run(game({ away: team({ l10: "7-3" }) })), "l10").v; return v.away === 0.7 && v.home === 0.5 && v.diff === 0.2; })());

// ── 賽後結果（post.mjs） ──
const ls = { scheduledInnings: 9, innings: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ num: n, away: { runs: n === 1 ? 1 : n === 2 ? 2 : 0 }, home: n === 9 ? {} : { runs: [0, 0, 1, 0, 2, 0, 1, 0][n - 1] } })),
  teams: { away: { runs: 3, hits: 7, errors: 1 }, home: { runs: 4, hits: 9, errors: 0 } } };
const pl = (id, pitches, ip, runs) => ["ID" + id, { person: { id, fullName: "P" + id }, stats: { pitching: { numberOfPitches: pitches, inningsPitched: ip, runs, earnedRuns: runs } } }];
const box = { teams: { away: { pitchers: [1, 2, 3], players: Object.fromEntries([pl(1, 78, "4.1", 3), pl(2, 13, "1.1", 0), pl(3, 38, "2.1", 1)]) },
  home: { pitchers: [4, 5], players: Object.fromEntries([pl(4, 90, "6.0", 3), pl(5, 40, "3.0", 0)]) } } };
const fe = { gamePk: 1, gameDate: "2026-09-25T17:05:00Z", officialDate: "2026-09-25", status: { abstractGameState: "Final", detailedState: "Final" }, linescore: ls, teams: { away: { score: 3 }, home: { score: 4 } } };
const po = summarizePost(fe, box, NOW);
check("賽後：最終比分、安打、失誤", po.done && po.final.away.runs === 3 && po.final.home.runs === 4 && po.final.home.hits === 9 && po.final.away.errors === 1);
check("賽後：九下沒打記 null（不記 0）", po.innings[8].home === null && po.innings[8].away === 0);
check("賽後：第 7 局起得分", po.late.fromInning === 7 && po.late.away === 0 && po.late.home === 1);
check("賽後：先發與牛棚（人次、用球數、出局數、失分）", po.pitching.away.sp.id === 1 && po.pitching.away.rp.apps === 2 && po.pitching.away.rp.pitches === 51 && po.pitching.away.rp.outs === 11 && po.pitching.away.rp.runs === 1 && po.pitching.home.rp.pitches === 40);
check("賽後：有牛棚投手球數缺 → 合計 null、記缺幾人", (() => { const b2 = JSON.parse(JSON.stringify(box)); b2.teams.away.players.ID2.stats.pitching.numberOfPitches = undefined; const p = summarizePost(fe, b2, NOW); return p.pitching.away.rp.pitches === null && p.pitching.away.rp.noCount === 1; })());
check("延賽（abstract 是 Final、detailed 是 Postponed）：不算完賽、繼續追", (() => { const p = summarizePost({ ...fe, status: { abstractGameState: "Final", detailedState: "Postponed" } }, null, NOW); return !p.done && !p.final; })());
check("暫停：不算完賽、繼續追", !summarizePost({ ...fe, status: { detailedState: "Suspended: Rain" } }, null, NOW).done);
check("取消：結束追蹤、沒有比分", (() => { const p = summarizePost({ ...fe, status: { detailedState: "Cancelled" } }, null, NOW); return p.done && !p.final; })());
check("同一 gamePk 兩筆（原日期延賽＋補賽日完賽）：取完賽那筆", pickEntry([{ gameDate: "2026-09-20T00:00:00Z", status: { detailedState: "Postponed" } }, { gameDate: "2026-09-21T00:00:00Z", status: { detailedState: "Final" } }]).gameDate.startsWith("2026-09-21"));
check("待補：開賽 1 小時後、還沒補完才查；補完不再查", pending({ game: { startUTC: "2026-09-25T21:00:00Z" } }, Date.parse(NOW)) && !pending({ game: { startUTC: "2026-09-25T22:30:00Z" } }, Date.parse(NOW)) && !pending({ game: { startUTC: "2026-09-20T00:00:00Z" }, post: { done: true } }, Date.parse(NOW)));
check("跨日：五天前暫停、還沒補完的也會查", pending({ game: { startUTC: "2026-09-20T23:00:00Z" }, post: { status: "Suspended: Rain", done: false } }, Date.parse(NOW)));

console.log(`\n${fails.length ? "FAIL" : "PASS"}：${total - fails.length}/${total}`);
process.exit(fails.length ? 1 : 0);
