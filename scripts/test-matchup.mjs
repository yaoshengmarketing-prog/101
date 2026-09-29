// 對位卡離線測試：node scripts/test-matchup.mjs
// 數字取自 2026-09-29 MLB Stats API 實查（Tolle 分項、Schlittler 最近三次先發、洋基預估打線打擊側）
import assert from "node:assert/strict";
import { outs, validOps, pickSplits, recentStarts, composition, effective, unknownOf, notesOf, lineupOf, lineupSig, buildMatchup } from "./matchup.mjs";

let n = 0; const t = (name, f) => { const r = f(); n++; console.log("ok", name); return r; };
const split = (code, pa, ops, team) => ({ split: { code }, stat: { battersFaced: pa, ops }, ...(team ? { team: { id: team } } : {}) });
const log = (date, gs, ip, np, er, gameType = "R", opp = 139) => ({ date, gameType, game: { gamePk: +date.replace(/-/g, "") }, opponent: { id: opp }, isHome: true, stat: { gamesStarted: gs, inningsPitched: ip, numberOfPitches: np, earnedRuns: er } });
const NYY = ["L", "L", "L", "L", "R", "L", "R", "L", "L"].map((bats, i) => ({ n: i + 1, name: `P${i + 1}`, bats }));
const TOLLE = { vl: { ops: ".705", pa: 173 }, vr: { ops: ".624", pa: 430 } };
const lu = (slots, short = "預估打線") => ({ team: "洋基", short, comp: composition(slots) });
const R3 = recentStarts([log("2026-09-13", 1, "6.0", 94, 0), log("2026-09-19", 1, "6.0", 98, 1), log("2026-09-24", 1, "3.0", 70, 1)]);

t("局數換出局數（5.2＝17）", () => { assert.equal(outs("5.2"), 17); assert.equal(outs("6.0"), 18); assert.equal(outs(null), null); assert.equal(outs("x"), null); });
t("分項：取合計列；只有分隊列不合計", () => {
  assert.deepEqual(pickSplits([split("vl", 173, ".705", 111), split("vr", 430, ".624", 111)]), TOLLE); // 實際 API：單隊也帶 team
  assert.deepEqual(pickSplits([split("vl", 50, ".600", 1), split("vl", 60, ".700", 2), split("vl", 110, ".655"), split("vr", 200, ".610")]).vl, { ops: ".655", pa: 110 });
  assert.equal(pickSplits([split("vl", 50, ".600", 1), split("vl", 60, ".700", 2), split("vr", 200, ".610")]).vl, null);
  assert.equal(pickSplits([]).vr, null); });
t("組成：左右開弓、未知分開，不併入左右", () => { const c = composition([...NYY.slice(0, 7), { n: 8, bats: "S" }, { n: 9, bats: null }]);
  assert.deepEqual([c.n, c.L.length, c.R.length, c.S, c.U], [9, 5, 2, [8], [9]]); });
t("觀察：左打多 → 先看對左打；不再只對樣本較少的一邊提醒（閱讀提醒改由頁面固定顯示）", () => { const { obs } = notesOf({ pitcher: { name: "Tolle", hand: "L" }, splits: TOLLE, recent: R3, lineup: lu(NYY) });
  assert.equal(obs.length, 1);
  assert.match(obs[0], /洋基預估打線 9 人中左打 7、右打 2，所以 Tolle 的「對左打」分項最值得先看：本季被打 OPS \.705（173 打席），高於他對右打的 \.624（430 打席）/);
  assert.doesNotMatch(obs.join(""), /樣本/);
  assert.doesNotMatch(obs.join(""), /有利|勝|贏|輸/); });
t("觀察：多數那邊樣本較多就不加樣本句；右打多看對右打", () => { const R = NYY.map(x => ({ ...x, bats: x.bats === "L" ? "R" : "L" }));
  const { obs } = notesOf({ pitcher: { name: "X" }, splits: TOLLE, recent: R3, lineup: lu(R, "官方打線") });
  assert.equal(obs.length, 1); assert.match(obs[0], /洋基官方打線 9 人中左打 2、右打 7，所以 X 的「對右打」分項最值得先看：本季被打 OPS \.624（430 打席），低於他對左打的 \.705/); });
t("觀察：慣用手未知時左右開弓算無法判斷，不說接近；未滿 9 人不判斷", () => {
  const eq = [...NYY.slice(0, 4), ...NYY.slice(0, 4).map(x => ({ ...x, bats: "R" })), { n: 9, bats: "S" }];
  const o0 = notesOf({ pitcher: { name: "X" }, splits: TOLLE, recent: R3, lineup: lu(eq) }).obs[0];
  assert.match(o0, /9 人中左打 4、右打 4、左右開弓 1；先發慣用手未知，左右開弓無法估算站位；站位已知的 8 人中左打席 4、右打席 4，另有 1 人無法判斷，所以還不能確定以哪一邊為主/);
  assert.doesNotMatch(o0, /接近/);
  const o = notesOf({ pitcher: { name: "X" }, splits: TOLLE, recent: R3, lineup: lu(NYY.slice(0, 7)) }).obs;
  assert.equal(o.length, 1); assert.match(o[0], /目前只有 7 人（未滿 9 人）：左打 5、右打 2，名單未滿 9 人，先不判斷/); });
t("觀察：沒分項、沒打線", () => {
  assert.match(notesOf({ pitcher: { name: "X" }, splits: { vl: null, vr: TOLLE.vr }, recent: R3, lineup: lu(NYY) }).obs[0], /分項本站沒有有效數字|沒有有效的大聯盟例行賽/);
  assert.match(notesOf({ pitcher: { name: "X" }, splits: TOLLE, recent: R3, lineup: null }).obs[0], /還沒公布、也沒有預估名單/); });
t("最近先發：比前兩次都少至少 2 局才註記（5.2 vs 6.0 不註記），且不推測原因", () => { const { recentNote } = notesOf({ pitcher: { name: "S" }, splits: TOLLE, recent: R3, lineup: lu(NYY) });
  assert.equal(recentNote, "最近一次先發（9/24）投 3.0 局、70 球，比前兩次（6.0 局、6.0 局）短；本站沒有原因資料，不推測傷病或限球數。");
  const ok = recentStarts([log("2026-09-06", 1, "6.0", 91, 1), log("2026-09-13", 1, "6.0", 96, 0), log("2026-09-22", 1, "5.2", 91, 2)]);
  assert.equal(notesOf({ pitcher: { name: "T" }, splits: TOLLE, recent: ok, lineup: lu(NYY) }).recentNote, null); });
t("最近先發：只取先發、依日期、含季後賽；之後的中繼另記；不到三次照實說", () => {
  const r = recentStarts([log("2026-10-01", 0, "1.0", 15, 0, "F"), log("2026-09-20", 1, "5.0", 80, 2), log("2026-09-10", 1, "6.0", 90, 1), log("2026-09-25", 0, "2.0", 30, 0), log("2026-09-02", 1, "7.0", 99, 0), log("2026-09-27", 1, "4.0", 70, 3, "F")]);
  assert.deepEqual(r.starts.map(x => x.date), ["2026-09-10", "2026-09-20", "2026-09-27"]);
  assert.equal(r.starts[2].gameType, "F"); assert.equal(r.reliefAfter.date, "2026-10-01"); assert.equal(r.starts[0].opp, "光芒");
  assert.match(notesOf({ pitcher: { name: "Z" }, splits: TOLLE, recent: r, lineup: lu(NYY) }).recentNote, /最近一次登板是 10\/1 中繼 1\.0 局、15 球/);
  assert.equal(notesOf({ pitcher: { name: "Z" }, splits: TOLLE, recent: recentStarts([log("2026-09-02", 1, "7.0", 99, 0)]), lineup: lu(NYY) }).recentNote, "本季（例行賽＋季後賽）登板 1 次、先發 1 次；上方對左右打分項只算例行賽的登板。");
  assert.equal(r.totalStarts, 4); assert.equal(r.totalApps, 6); });
t("先發不到 3 次：寫登板與先發次數（例行賽＋季後賽），分項範圍（例行賽）另寫；0 次先發和查不到紀錄分開（AJ Blubaugh 64 次登板 0 先發）", () => {
  const bl = recentStarts(Array.from({ length: 64 }, (_, i) => log(`2026-0${4 + Math.floor(i / 12)}-${String(1 + (i % 12) * 2).padStart(2, "0")}`, 0, "1.0", 15, 0)));
  assert.deepEqual([bl.starts.length, bl.totalApps, bl.totalStarts], [0, 64, 0]);
  assert.equal(notesOf({ pitcher: { name: "AJ Blubaugh", hand: "R" }, splits: TOLLE, recent: bl, lineup: lu(NYY) }).recentNote, "本季（例行賽＋季後賽）登板 64 次、先發 0 次，全部是後援；上方對左右打分項只算例行賽的登板。");
  const two = recentStarts([log("2026-09-02", 1, "3.0", 50, 0), log("2026-09-10", 0, "1.0", 12, 0), log("2026-09-20", 1, "2.0", 33, 0)]);
  assert.equal(notesOf({ pitcher: { name: "H" }, splits: TOLLE, recent: two, lineup: lu(NYY) }).recentNote, "本季（例行賽＋季後賽）登板 3 次、先發 2 次，其餘 1 次是後援；上方對左右打分項只算例行賽的登板。");
  assert.equal(notesOf({ pitcher: { name: "New Guy" }, splits: { vl: null, vr: null }, recent: recentStarts([]), lineup: lu(NYY) }).recentNote, "MLB 官方資料查不到 New Guy 本季（例行賽＋季後賽）的大聯盟登板紀錄，本站沒有他的投球紀錄可列。");
  assert.doesNotMatch(notesOf({ pitcher: { name: "AJ" }, splits: TOLLE, recent: bl, lineup: lu(NYY) }).recentNote, /角色|限球|局數/); });
t("左右開弓：面對右投算左打席、面對左投算右打席；慣用手未知不計；5 對 4 兩邊都看（紅襪預估 L3 R4 S2 對 Schlittler 右投）", () => {
  const BOS = ["L", "S", "L", "R", "R", "R", "L", "R", "S"].map((bats, i) => ({ n: i + 1, bats })), c = composition(BOS);
  assert.deepEqual(effective(c, "R"), { L: 5, R: 4 }); assert.deepEqual(effective(c, "L"), { L: 3, R: 6 }); assert.deepEqual(effective(c, null), { L: 3, R: 4 });
  const S = { vl: { ops: ".560", pa: 458 }, vr: { ops: ".520", pa: 303 } };
  const o = notesOf({ pitcher: { name: "Schlittler", hand: "R" }, splits: S, recent: R3, lineup: { team: "紅襪", short: "預估打線", comp: c } }).obs;
  assert.equal(o[0], "紅襪預估打線 9 人中左打 3、右打 4、左右開弓 2；左右開弓依通常站位估算，站左打席約 5 位、右打席約 4 位，兩邊人數接近，兩個分項都要看：Schlittler 對左打被打 OPS .560（458 打席）、對右打 .520（303 打席）。");
  assert.equal(o.length, 1);
  assert.match(notesOf({ pitcher: { name: "X", hand: null }, splits: S, recent: R3, lineup: { team: "紅襪", short: "預估打線", comp: c } }).obs[0], /先發慣用手未知，左右開弓無法估算站位；站位已知的 7 人中左打席 3、右打席 4，另有 2 人無法判斷/); });
t("明顯多數＝9 人中至少 6 人同一邊（6 對 3 指出先看哪邊）", () => {
  const six = ["L", "L", "L", "L", "L", "L", "R", "R", "R"].map((bats, i) => ({ n: i + 1, bats }));
  assert.match(notesOf({ pitcher: { name: "X", hand: "R" }, splits: TOLLE, recent: R3, lineup: lu(six) }).obs[0], /所以 X 的「對左打」分項最值得先看/); });
t("人工案例 1：左打 5、打擊側未知 4 → 不說接近，寫已知與無法判斷", () => {
  const five = [..."LLLLL"].map((b, i) => ({ n: i + 1, bats: b })).concat([6, 7, 8, 9].map(n => ({ n, bats: null })));
  assert.equal(unknownOf(composition(five), "L"), 4);
  const o = notesOf({ pitcher: { name: "Tolle", hand: "L" }, splits: TOLLE, recent: R3, lineup: lu(five) }).obs;
  assert.equal(o[0], "洋基預估打線 9 人中左打 5、右打 0、打擊側未知 4；站位已知的 5 人中左打席 5、右打席 0，另有 4 人無法判斷，所以還不能確定以哪一邊為主：Tolle 對左打被打 OPS .705（173 打席）、對右打 .624（430 打席）。");
  assert.doesNotMatch(o.join(""), /接近/);
  // 已知就達 6 人：未知再多也不可能翻盤，照常指出
  const six = [..."LLLLLL"].map((b, i) => ({ n: i + 1, bats: b })).concat([7, 8, 9].map(n => ({ n, bats: null })));
  assert.match(notesOf({ pitcher: { name: "T", hand: "L" }, splits: TOLLE, recent: R3, lineup: lu(six) }).obs[0], /左打 6、右打 0、打擊側未知 3，所以 T 的「對左打」分項最值得先看/); });
t("人工案例 2：OPS 是 -.--- 等無效值 → 當缺值，不比較高低或相等", () => {
  for (const bad of ["-.---", "", ".---", "abc", null, 0.7]) assert.equal(validOps(bad), null);
  for (const ok of [".705", "1.023", "0.650"]) assert.equal(validOps(ok), ok);
  const sp = pickSplits([split("vl", 173, ".705", 1), split("vr", 430, "-.---", 1)]);
  assert.equal(sp.vr, null);
  const o = notesOf({ pitcher: { name: "Tolle", hand: "L" }, splits: sp, recent: R3, lineup: lu(NYY) }).obs;
  assert.equal(o.length, 1);
  assert.match(o[0], /「對左打」分項最值得先看：本季被打 OPS \.705（173 打席）；對右打的分項本站沒有有效數字，不做比較。$/);
  assert.doesNotMatch(o[0], /等於|高於|低於/);
  const o2 = notesOf({ pitcher: { name: "Tolle", hand: "L" }, splits: { vl: null, vr: TOLLE.vr }, recent: R3, lineup: lu(NYY) }).obs;
  assert.match(o2[0], /「對左打」分項最值得先看，但這個分項本站沒有有效數字，無法對照（對右打：\.624（430 打席））/);
  const eq5 = [..."LLLLRRRRR"].map((b, i) => ({ n: i + 1, bats: b }));
  assert.match(notesOf({ pitcher: { name: "X", hand: "R" }, splits: { vl: TOLLE.vl, vr: null }, recent: R3, lineup: lu(eq5) }).obs[0], /對左打被打 OPS \.705（173 打席）、對右打分項沒有有效數字。$/);
  assert.equal(pickSplits([split("vl", 0, ".705", 1)]).vl, null); // 0 打席也當缺值
});
t("最近先發：局數、用球、自責分無效就當缺值，不進入「投得短」比較", () => {
  const r = recentStarts([log("2026-09-13", 1, "6.0", 94, 0), log("2026-09-19", 1, "6.0", "98", -1), log("2026-09-24", 1, "-.--", 70, 1)]);
  assert.deepEqual(r.starts.map(x => [x.ip, x.np, x.er]), [["6.0", 94, 0], ["6.0", null, null], [null, 70, 1]]);
  assert.equal(notesOf({ pitcher: { name: "S" }, splits: TOLLE, recent: r, lineup: lu(NYY) }).recentNote, null); });
t("打線版本簽章：官方看 id 順序、預估看來源標示與名字；換人、改順序、預估變確認都會變", () => {
  const g = { home: { lineup: { state: "official", slots: [{ id: 1 }, { id: 2 }] } }, away: { lineup: { state: "none" } }, proj: { away: { sourceStatusKey: "expected", slots: [{ name: "A" }, { name: "B" }] } } };
  assert.equal(lineupSig(g, "home"), "official:1,2"); assert.equal(lineupSig(g, "away"), "proj:expected:A,B");
  assert.notEqual(lineupSig({ ...g, home: { lineup: { state: "late", slots: [{ id: 2 }, { id: 1 }] } } }, "home"), "official:1,2");
  assert.notEqual(lineupSig({ ...g, proj: { away: { sourceStatusKey: "confirmed", slots: [{ name: "A" }, { name: "B" }] } } }, "away"), "proj:expected:A,B");
  assert.equal(lineupSig({ home: { lineup: { state: "none" } } }, "home"), "none"); });
const G = { pk: 1, usDate: "2026-09-29", away: { name: "紅襪", ab: "BOS", sp: { id: 10, name: "Tolle", hand: "L" }, lineup: { state: "none", slots: null } },
  home: { name: "洋基", ab: "NYY", sp: { id: 20, name: "Schlittler", hand: "R" }, lineup: { state: "official", firstSeen: "2026-09-29T20:00:00Z", slots: [{ n: 1, id: 101, name: "A" }, { n: 2, id: 102, name: "B" }] } },
  proj: { away: { sourceStatusKey: "expected", firstSeen: "2026-09-28T11:21:00Z", slots: NYY }, home: { sourceStatusKey: "expected", slots: NYY } } };
t("打線：官方優先（打擊側用 people API），沒有官方才用預估並標來源", () => {
  const h = lineupOf(G, "home", { 101: "S", 102: "R" }); assert.equal(h.source, "official"); assert.deepEqual(h.slots.map(x => x.bats), ["S", "R"]);
  const a = lineupOf(G, "away", {}); assert.equal(a.source, "proj"); assert.equal(a.label, "RotoWire 預估打線（非官方）");
  assert.equal(lineupOf({ ...G, proj: { away: { ...G.proj.away, sourceStatusKey: "confirmed" } } }, "away", {}).label, "RotoWire 已確認名單（非 MLB 官方）");
  assert.equal(lineupOf({ ...G, proj: null }, "away", {}), null); });
await (async () => { const urls = [];
  const fj = async u => { urls.push(u); if (u.includes("personIds")) return { people: [{ id: 101, batSide: { code: "L" } }, { id: 102, batSide: { code: "R" } }] };
    if (u.includes("statSplits")) return { stats: [{ splits: [split("vl", 173, ".705"), split("vr", 430, ".624")] }] };
    return { stats: [{ splits: [log("2026-09-13", 1, "6.0", 94, 0)] }] }; };
  const m = await buildMatchup(G, "2026-09-29T00:00:00Z", fj);
  assert.deepEqual(m.pairs.map(p => [p.pitcher.name, p.lineup.ab, p.lineup.source]), [["Tolle", "NYY", "official"], ["Schlittler", "BOS", "proj"]]);
  assert.ok(urls.some(u => u.includes("sitCodes=vl,vr&gameType=R")) && urls.some(u => u.includes("gameLog") && u.includes("gameType=R,F,D,L,W")));
  assert.equal(m.pairs[0].splitScope, "2026 例行賽");
  assert.deepEqual(m.pairs.map(p => p.basis), [{ sp: 10, lineup: "official:101,102" }, { sp: 20, lineup: `proj:expected:${NYY.map(x => x.name).join(",")}` }]); n++; console.log("ok 組裝：客隊先發對主隊官方打線、主隊先發對客隊預估；分項只取例行賽、最近先發含季後賽"); })();
console.log(`${n}/${n} 通過`);
