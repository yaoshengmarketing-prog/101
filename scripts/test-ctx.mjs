// 情境卡規則的離線測試（不連網）：node scripts/test-ctx.mjs
import { compute, decide, MAXCARDS } from "./ctx.mjs";

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
check("賽前：用這次算的", decide(game(), pre, run(game())).updatedAt === "2026-09-25T12:00:00.000Z");
check("開賽後、有賽前紀錄：原封不動沿用", decide(game({ status: { code: "live" } }), pre, live) === pre);
check("開賽後、沒有賽前紀錄：用開賽後算的，phase 記 live", decide(game({ status: { code: "live" } }), null, live).phase === "live");
check("延賽也凍結", decide(game({ status: { code: "ppd" } }), pre, run(game({ status: { code: "ppd" } }))) === pre);

console.log(`\n${fails.length ? "FAIL" : "PASS"}：${total - fails.length}/${total}`);
process.exit(fails.length ? 1 : 0);
