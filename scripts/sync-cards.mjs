// 首頁卡片同步：forecast.mjs、lineup-proj.mjs 在 build 之後才寫進單場檔，這裡把首頁需要的摘要補回 dates/<日期>.json
// 用法：node scripts/sync-cards.mjs [輸出資料夾，預設 .build]
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { crossCmp } from "./lineup-proj.mjs";

// cc＝兩站人選／棒次相同數（單一來源為 null）；vs＝官方公布前最後一版與官方的人選／棒次相同數
export const projCard = p => p ? { n: p.slots.length, cross: p.cross, cc: p.crossCmp ?? (p.cross ? crossCmp(p.slots) : null), vs: p.vsOfficial?.last ?? null, sourceStatusKey: p.sourceStatusKey, firstSeen: p.firstSeen } : null;
export const cardExtra = g => ({ forecast: g.forecast ?? null, proj: g.proj ? { away: projCard(g.proj.away), home: projCard(g.proj.home) } : null });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const D = `${process.argv[2] || ".build"}/live-data`, read = f => JSON.parse(fs.readFileSync(f, "utf8"));
  let n = 0;
  for (const f of fs.readdirSync(`${D}/dates`).filter(f => f.endsWith(".json"))) {
    const d = read(`${D}/dates/${f}`);
    d.games = d.games.map(c => { try { n++; return { ...c, ...cardExtra(read(`${D}/games/${c.pk}.json`)) }; } catch { return c; } });
    fs.writeFileSync(`${D}/dates/${f}`, JSON.stringify(d));
  }
  console.log(`首頁卡片同步天氣預報與預估打線摘要：${n} 場`);
}
