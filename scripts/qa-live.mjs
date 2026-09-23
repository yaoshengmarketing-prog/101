// 運彩 101 /live/ 資料 QA：node scripts/qa-live.mjs [輸出資料夾，預設 .build]
// 檢查 build-live.mjs 的產出；任何 FAIL 讓 workflow 停止，不覆蓋上一版公開資料。
import fs from "node:fs";
import { twDate, twTime } from "./build-live.mjs";

const OUT = process.argv[2] || ".build", D = `${OUT}/live-data`;
const res = [], ok = (name, pass, detail = "") => res.push({ name, pass: !!pass, detail });
const read = f => JSON.parse(fs.readFileSync(f, "utf8"));
const LU = ["none", "partial", "estimate", "official", "late"], TEAM_LU = ["none", "official", "late"], ST = ["pre", "live", "final", "ppd", "cxl", "susp"];

const M = read(`${D}/manifest.json`);
ok("manifest 有今天與明天", M.days?.length === 2 && M.days[0].key === "today" && M.days[1].key === "tomorrow");
const seen = new Map();
for (const d of M.days) {
  const df = read(`${D}/dates/${d.date}.json`);
  ok(`${d.label} ${d.date}：日期檔場數＝manifest 場數`, df.games.length === d.count, `${df.games.length}/${d.count}`);
  let files = 0, tzOk = 0, fields = 0, luOk = 0, slotsOk = 0;
  for (const c of df.games) {
    if (seen.has(c.pk)) ok(`gamePk ${c.pk} 不重複`, false, `同時出現在 ${seen.get(c.pk)} 與 ${d.date}`); seen.set(c.pk, d.date);
    const f = `${D}/games/${c.pk}.json`; if (!fs.existsSync(f)) continue; files++;
    const g = read(f);
    if (g.twDate === d.date && twDate(g.startUTC) === d.date && (g.tbd || g.twTime === twTime(g.startUTC))) tzOk++;
    if (g.pk && g.venue && ST.includes(g.status?.code) && g.status.text && g.away?.name && g.home?.name && (g.tbd || g.twTime)) fields++;
    if (LU.includes(g.lineup) && TEAM_LU.includes(g.away.lineup.state) && TEAM_LU.includes(g.home.lineup.state)) luOk++;
    const sl = [g.away.lineup.slots, g.home.lineup.slots, g.away.prev?.slots, g.home.prev?.slots].filter(Boolean);
    if (sl.every(s => s.length === 9 && s.every((x, i) => x.n === i + 1 && x.name))) slotsOk++;
  }
  const n = df.games.length;
  ok(`${d.label}：每場都有單場資料檔`, files === n, `${files}/${n}`);
  ok(`${d.label}：台灣日期／時間與 startUTC 換算一致`, tzOk === n, `${tzOk}/${n}`);
  ok(`${d.label}：必要欄位齊全（gamePk、球場、狀態、隊名、台灣時間）`, fields === n, `${fields}/${n}`);
  ok(`${d.label}：打線狀態只用 none/partial/estimate/official/late`, luOk === n, `${luOk}/${n}`);
  ok(`${d.label}：打線名單皆為 1–9 棒`, slotsOk === n, `${slotsOk}/${n}`);
}
const all = fs.readdirSync(`${D}/games`).map(f => fs.readFileSync(`${D}/games/${f}`, "utf8")).join("\n") + fs.readFileSync(`${D}/manifest.json`, "utf8");
const bad = ["示範", "Mock", "mock", "原型", "demo", "3/4", "odds", "consensus"].filter(w => all.includes(w));
ok("無示範／Mock／盤口／共識字樣", !bad.length, bad.join("、"));
ok("本次建置錯誤數（僅記錄，不擋）", true, `${M.errors.length} 筆`);

// 牛棚（scripts/bullpen.mjs 的產出）：部分失敗照常發布並標示；全部失敗才擋
const B = read(`${D}/bullpen/index.json`), pks = [...seen.keys()], BS = ["ok", "incomplete", "failed"];
ok("牛棚：每場都有牛棚檔", pks.every(pk => fs.existsSync(`${D}/bullpen/${pk}.json`)), `${pks.filter(pk => fs.existsSync(`${D}/bullpen/${pk}.json`)).length}/${pks.length}`);
ok("牛棚：狀態只用 ok/incomplete/failed", Object.values(B.games).every(g => BS.includes(g.status)));
let inv = 0, invN = 0;
for (const pk of pks) {
  if (!fs.existsSync(`${D}/bullpen/${pk}.json`)) continue;
  const b = read(`${D}/bullpen/${pk}.json`); if (b.status === "failed") continue;
  for (const side of ["away", "home"]) for (const d of b.summary[side].days) { invN++; if (d.complete === (d.st === "played" && d.gamesMissing === 0) && (d.gamesMissing === 0 || !d.complete)) inv++; }
}
ok("牛棚：標為完整的日子都沒有缺場（complete ⇔ played 且缺 0 場）", inv === invN, `${inv}/${invN} 隊日`);
ok("牛棚：不是全部失敗", !(B.counts.total > 0 && B.counts.failed === B.counts.total), `完整 ${B.counts.ok}／部分 ${B.counts.incomplete}／失敗 ${B.counts.failed}／共 ${B.counts.total} 場`);

const fail = res.filter(r => !r.pass);
const md = `# QA ${M.generatedAtTW}\n\n| 檢查 | 結果 | 細節 |\n|---|---|---|\n${res.map(r => `| ${r.name} | ${r.pass ? "PASS" : "FAIL"} | ${r.detail} |`).join("\n")}\n\n合計：${res.length - fail.length}/${res.length} 通過\n`;
fs.writeFileSync(`${OUT}/qa.md`, md);
console.log(md);
process.exit(fail.length ? 1 : 0);
