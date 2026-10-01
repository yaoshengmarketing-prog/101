// 名單狀態試作離線測試：node scripts/test-roster.mjs
// 資料＝scripts/fixtures/roster-849844-20261001T1450Z.json（2026-10-01 14:50Z 實抓，PHI@ATL 外卡第 3 戰賽前）
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRoster, ilInfo, unexplained } from "./roster.mjs";

let n = 0; const t = (name, f) => { f(); n++; console.log("ok", name); };
const S = JSON.parse(fs.readFileSync(new URL("./fixtures/roster-849844-20261001T1450Z.json", import.meta.url), "utf8"));
const R = buildRoster(S, 849844, "2026-09-27");
const A = R.away, H = R.home, by = (T, name) => T.people.find(p => p.name === name);
const names = (T, g) => T.people.filter(p => p.group === g).map(p => p.name);

t("傷兵描述：類型、天數、回溯日、部位；沒寫部位就是 null", () => {
  assert.deepEqual(ilInfo("Atlanta Braves placed LHP Martín Pérez on the 15-day injured list retroactive to September 21, 2026. Low back inflammation."),
    { kind: "placed", days: 15, retro: "2026-09-21", injury: "Low back inflammation" });
  assert.deepEqual(ilInfo("Philadelphia Phillies transferred RHP Caleb Kilian from the 15-day injured list to the 60-day injured list. Left oblique strain."),
    { kind: "transferred", days: 60, retro: null, injury: "Left oblique strain" });
  assert.equal(ilInfo("Atlanta Braves placed RHP Joe Jiménez on the 60-day injured list.").injury, null);
  assert.equal(ilInfo("Philadelphia Phillies activated CF Johan Rojas from the restricted list."), null);
  assert.equal(unexplained("2B Luis Arraez roster status changed by Philadelphia Phillies."), true); });
t("取得時間、比較基準、範圍照快照；取得時官方打線未公布", () => {
  assert.equal(R.fetchedAt, "2026-10-01T14:50:22.058Z"); assert.equal(R.basis.date, "2026-09-27");
  assert.deepEqual(R.window, { from: "2026-09-14", to: "2026-09-27", days: 14 }); assert.equal(R.lineupPostedAtFetch, false);
  assert.deepEqual(R.prior.map(p => p.date), ["2026-09-29", "2026-09-30"]); });
t("本場資料名單 26／26，與本輪前兩場相同（補充，不保證之後）", () => {
  for (const T of [A, H]) { assert.equal(T.listedN, 26); assert.equal(T.basisN, 28); assert.ok(T.sameAsPrior.every(x => x.same)); } });
t("名單增減：PHI 少 3 多 1；ATL 少 4 多 2", () => {
  assert.deepEqual(names(A, "out"), ["Luis Arraez", "Brooks Raley", "Max Lazar"]); assert.deepEqual(names(A, "in"), ["Otto Kemp"]);
  assert.deepEqual(names(H, "out"), ["Kyle Farmer", "JR Ritchie", "AJ Smith-Shawver", "Elieser Hernández"]); assert.deepEqual(names(H, "in"), ["Rowdy Tellez", "Luke Williams"]); });
t("展開分組：PHI 6、ATL 10；其他保留 PHI 14、ATL 13", () => {
  const ex = T => T.people.filter(p => p.group !== "other").length;
  assert.equal(ex(A), 6); assert.equal(ex(H), 10); assert.equal(names(A, "other").length, 14); assert.equal(names(H, "other").length, 13);
  assert.deepEqual(names(A, "recentOff"), ["Orion Kerkering"]); assert.deepEqual(names(H, "recentOff"), ["Martín Pérez", "Reynaldo López", "Owen Murphy"]);
  assert.deepEqual(names(A, "ilMove"), ["Jesús Luzardo"]); assert.deepEqual(names(H, "ilMove"), ["Robert Suarez"]); });
t("其他保留依例行賽最後出賽日排序，未出賽在最後", () => {
  const o = A.people.filter(p => p.group === "other"); assert.equal(o[0].name, "Grant Holman"); assert.equal(o.at(-1).lastReg, null);
  for (let i = 1; i < o.length; i++) assert.ok((o[i - 1].lastReg || "") >= (o[i].lastReg || "")); });
t("例行賽最後出賽與本輪出賽分開：Luzardo 例行賽 9/27、本輪 9/29 第 1 戰先發投手", () => {
  const L = by(A, "Jesús Luzardo"); assert.equal(L.lastReg, "2026-09-27"); assert.deepEqual(L.post, [{ n: 1, date: "2026-09-29", role: "先發投手" }]);
  assert.deepEqual(by(A, "Otto Kemp").post, []); // 本場名單內、前兩場沒上場
  assert.deepEqual(by(H, "Robert Suarez").post.map(x => x.n), []); });
t("狀態只取來源：Arraez 40M、Hernández 不在 40Man 回應（null）、Pérez D15；原因未寫明的異動標記出來", () => {
  assert.equal(by(A, "Luis Arraez").status, "40M"); assert.equal(by(H, "Elieser Hernández").status, null); assert.equal(by(H, "Martín Pérez").status, "D15");
  assert.ok(by(A, "Luis Arraez").tx.some(x => x.unexplained)); assert.ok(!by(H, "Martín Pérez").tx.some(x => x.unexplained)); });
t("傷兵：PHI 5（60 天 5）、ATL 6（15 天 1、60 天 5）；第一層傷兵異動 PHI 3 筆、ATL 5 筆", () => {
  assert.equal(A.ilCount, 5); assert.deepEqual(A.ilBy, { D60: 5 }); assert.equal(H.ilCount, 6); assert.deepEqual(H.ilBy, { D60: 5, D15: 1 });
  assert.equal(A.ilEvents.length, 3); assert.equal(H.ilEvents.length, 5); assert.ok(A.ilEvents.every(e => e.date >= "2026-09-15")); });
t("結果只由快照決定（同輸入同輸出）", () => assert.deepEqual(buildRoster(S, 849844, "2026-09-27"), R));
console.log(`名單狀態試作測試 ${n}/${n} 通過`);
