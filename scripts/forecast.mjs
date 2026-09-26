// 賽前天氣預報：MLB 官方天氣要開賽前幾小時才有，更早的時段用模型預報補上（明確標「預報」，不是官方）
// 用法：node scripts/forecast.mjs [輸出資料夾，預設 .build]
//   對 <out>/live-data/games 裡「賽前、表定開賽在 48 小時內、時間已定」的比賽：
//   1) MLB schedule（gamePks 批次）取球場座標、本壘→中外野方位角（azimuthAngle）、屋頂類型
//   2) Open-Meteo 每個球場一次，取表定開賽那一小時的氣溫、風速、風從哪裡吹來、降雨機率
//   3) 風向換成相對球場的說法（與 MLB 官方相同用語：Out To CF、In From LF、L To R…）
//   寫回單場檔的 forecast 欄位；開賽後保留最後一次賽前預報、不再更新；這次抓不到就沿用上一版並標 retryFailedSince
// 數值四捨五入（°C、km/h 取整數，風向取 10 度）以免每小時的模型小幅變動造成大量提交
// 來源：Open-Meteo.com（CC BY 4.0），非商業使用免金鑰
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const FC_RULES = "forecast v0.1";
const MLB = "https://statsapi.mlb.com/api/v1", OM = "https://api.open-meteo.com/v1/forecast";
const HORIZON_H = 48;

// 風從 fromDeg 吹來 → 吹往 fromDeg+180；和本壘→中外野方位角 az 的夾角決定說法
export function relLabel(az, fromDeg) {
  if (typeof az !== "number" || typeof fromDeg !== "number") return null;
  const rel = ((fromDeg + 180 - az) % 360 + 540) % 360 - 180, a = Math.abs(rel);
  if (a <= 22.5) return "Out To CF";
  if (a <= 67.5) return rel > 0 ? "Out To RF" : "Out To LF";
  if (a <= 112.5) return rel > 0 ? "L To R" : "R To L";
  if (a <= 157.5) return rel > 0 ? "In From LF" : "In From RF";
  return "In From CF";
}

// 純函式：Open-Meteo hourly ＋ 球場 → 表定開賽那一小時的預報
export function pickForecast(hourly, startUTC, venue, nowISO) {
  const hr = startUTC.slice(0, 13) + ":00", i = (hourly?.time || []).indexOf(hr);
  if (i < 0) return null;
  const v = k => { const x = hourly[k]?.[i]; return typeof x === "number" && Number.isFinite(x) ? x : null; };
  const tF = v("temperature_2m"), mph = v("wind_speed_10m"), from = v("wind_direction_10m"), pp = v("precipitation_probability");
  const fromR = from === null ? null : (Math.round(from / 10) * 10) % 360;
  return { rules: FC_RULES, source: "Open-Meteo 模型預報", targetHourUTC: hr, fetchedAt: nowISO,
    tempC: tF === null ? null : Math.round((tF - 32) * 5 / 9), windKmh: mph === null ? null : Math.round(mph * 1.609),
    windFromDeg: fromR, windRel: mph === 0 ? "None" : relLabel(venue.azimuth, fromR), precipProb: pp === null ? null : Math.round(pp / 10) * 10,
    roofType: venue.roofType ?? null, azimuth: venue.azimuth ?? null };
}

export const wanted = (g, now) => g.status?.code === "pre" && !g.tbd && g.startUTC && Date.parse(g.startUTC) - now < HORIZON_H * 36e5 && Date.parse(g.startUTC) > now - 36e5;

async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r.json(); last = new Error(`HTTP ${r.status} ${url}`); if (r.status < 500 && r.status !== 429) break; }
    catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 1500 * (i + 1)));
  }
  throw last;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data/games`, now = Date.now(), nowISO = new Date(now).toISOString();
  const read = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const games = fs.readdirSync(D).filter(f => f.endsWith(".json")).map(f => read(`${D}/${f}`)).filter(Boolean);
  const prevOf = pk => read(`live/data/games/${pk}.json`)?.forecast || null;
  const c = { fresh: 0, carried: 0, failed: 0, frozen: 0 }, errs = [];
  // 賽前以外：保留最後一次賽前預報（凍結）
  for (const g of games) if (!wanted(g, now)) { const p = prevOf(g.pk); if (p) { g.forecast = p; c.frozen++; fs.writeFileSync(`${D}/${g.pk}.json`, JSON.stringify(g)); } }
  const todo = games.filter(g => wanted(g, now));
  const fail = (g, msg) => { const p = prevOf(g.pk); c.failed++; errs.push(`${g.pk}：${msg}`);
    if (p && p.targetHourUTC === g.startUTC.slice(0, 13) + ":00") { g.forecast = { ...p, retryFailedSince: p.retryFailedSince || nowISO }; c.carried++; }
    else g.forecast = null;
    fs.writeFileSync(`${D}/${g.pk}.json`, JSON.stringify(g)); };
  let venues = new Map();
  if (todo.length) {
    try {
      const s = await getJson(`${MLB}/schedule?sportId=1&hydrate=venue(location,fieldInfo)&gamePks=${todo.map(g => g.pk).join(",")}`);
      for (const d of s.dates || []) for (const e of d.games || []) { const L = e.venue?.location;
        venues.set(e.gamePk, { id: e.venue?.id, lat: L?.defaultCoordinates?.latitude, lon: L?.defaultCoordinates?.longitude, azimuth: L?.azimuthAngle, roofType: e.venue?.fieldInfo?.roofType }); }
    } catch (e) { errs.push(`球場資料：${e.message}`); }
  }
  const byVenue = new Map();
  for (const g of todo) { const v = venues.get(g.pk); if (!v || v.lat == null || v.lon == null) { fail(g, "球場座標未取得"); continue; }
    (byVenue.get(v.id) || byVenue.set(v.id, { v, games: [] }).get(v.id)).games.push(g); }
  for (const { v, games: gs } of byVenue.values()) {
    const days = gs.map(g => g.startUTC.slice(0, 10)).sort();
    let om;
    try { om = await getJson(`${OM}?latitude=${v.lat}&longitude=${v.lon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=GMT&start_date=${days[0]}&end_date=${days.at(-1)}`); }
    catch (e) { gs.forEach(g => fail(g, e.message)); continue; }
    for (const g of gs) {
      const f = pickForecast(om.hourly, g.startUTC, v, nowISO);
      if (!f) { fail(g, "預報沒有表定開賽那一小時"); continue; }
      g.forecast = f; c.fresh++; fs.writeFileSync(`${D}/${g.pk}.json`, JSON.stringify(g));
    }
  }
  const line = `賽前 48 小時內 ${todo.length} 場：取得 ${c.fresh}／失敗 ${c.failed}（其中沿用上一版 ${c.carried}）；開賽後保留賽前預報 ${c.frozen} 場` + (errs.length ? "\n" + errs.slice(0, 10).map(e => "- " + e).join("\n") : "");
  fs.appendFileSync(`${OUT}/report.md`, `\n## 天氣預報（${FC_RULES}）\n\n${line}\n`);
  console.log("天氣預報：" + line);
}
