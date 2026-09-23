// 這次產出和上一版（git HEAD）比，有沒有「真的資料變動」；每次都會變的時間戳不算
// 用法（在 publish 複製完之後）：node scripts/data-changed.mjs [輸出資料夾，預設 .build]
//   exit 0＝有變動（要 commit）；exit 10＝沒有變動；其他＝程式錯誤
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = process.argv[2] || ".build";
const VOLATILE = new Set(["generatedAt", "generatedAtTW", "updatedAt", "fetchedAt"]);
const norm = s => JSON.stringify(JSON.parse(s), (k, v) => VOLATILE.has(k) ? undefined : v);
const head = p => { try { return execFileSync("git", ["show", `HEAD:${p}`], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);

// 本次寫出的檔案（live/data 底下對應的路徑）＋ state.json
const files = [...walk(`${OUT}/live-data`).map(f => "live/data/" + f.slice(`${OUT}/live-data/`.length)), "data/state.json"];
const changed = files.filter(f => { const h = head(f); return h === null || norm(h) !== norm(fs.readFileSync(f, "utf8")); });
console.log(`資料變動：${changed.length}/${files.length} 檔` + (changed.length ? "\n" + changed.slice(0, 20).map(f => "- " + f).join("\n") : ""));
process.exit(changed.length ? 0 : 10);
