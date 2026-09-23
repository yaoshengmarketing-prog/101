// 牛棚：每場比賽「本場之前」兩隊的逐投手、逐日使用
// 用法：node scripts/bullpen.mjs [輸出資料夾，預設 .build]
//   讀 <out>/live-data/games/*.json（build-live.mjs 的產出），寫 <out>/live-data/bullpen/<gamePk>.json 與 index.json
// 規則 bullpen v0.2：
//   視窗＝本場 officialDate 往回 3 個完整日＋本日（只算開賽時間早於本場的比賽）
//   比賽依「列在賽程哪一天」（dates[].date）歸日，不用 officialDate（延賽重排後同一 gamePk 會有兩筆）
//   每場第一位登板者視為先發，不算牛棚
//   取不到的東西一律標明，不補 0、不把部分小計當完整合計
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { TEAM_ZH } from "./build-live.mjs";

export const RULES_VERSION = "bullpen v0.2";
export const FINAL = new Set(["Final", "Game Over", "Completed Early"]);
export const LIVE = new Set(["In Progress", "Manager challenge", "Delayed"]);
const API = "https://statsapi.mlb.com";
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function extract(t) {
  return (t.pitchers || []).map((id, i) => {
    const p = (t.players || {})["ID" + id] || {};
    const pt = (p.stats && p.stats.pitching) || {};
    const n = pt.numberOfPitches ?? pt.pitchesThrown;
    return { id, name: (p.person && p.person.fullName) || null, role: i === 0 ? "SP" : "RP",
             pitches: typeof n === "number" ? n : null, ip: pt.inningsPitched ?? null };
  });
}

// ── 收集（純函式；fetchJson 由外部注入）──
export async function collectBullpen({ gamePk, fetchJson, nowISO }) {
  const sources = [];
  const get = async (path) => { const url = API + path; sources.push(url); return fetchJson(url); };
  const s = await get(`/api/v1/schedule?sportId=1&gamePks=${gamePk}`);
  const tg = s.dates && s.dates[0] && s.dates[0].games && s.dates[0].games[0];
  if (!tg) throw new Error("找不到 gamePk " + gamePk);
  const D = tg.officialDate, full = [addDays(D, -3), addDays(D, -2), addDays(D, -1)];
  const out = { rules: RULES_VERSION, fetchedAt: nowISO,
    target: { pk: tg.gamePk, officialDate: D, startUTC: tg.gameDate, status: tg.status.detailedState,
              dh: tg.doubleHeader, gameNumber: tg.gameNumber, venue: tg.venue && tg.venue.name },
    window: { full, today: D }, teams: {}, sources };
  for (const side of ["away", "home"]) {
    const team = tg.teams[side].team;
    const sch = await get(`/api/v1/schedule?sportId=1&teamId=${team.id}&startDate=${full[0]}&endDate=${D}`);
    const seen = new Set();
    const prior = (sch.dates || []).flatMap((d) => d.games.map((g) => ({ g, listed: d.date })))
      .filter(({ g }) => !(g.gamePk === tg.gamePk && g.status.detailedState !== "Postponed"))
      .filter(({ g }) => Date.parse(g.gameDate) < Date.parse(tg.gameDate))
      .filter(({ g, listed }) => { const k = g.gamePk + "|" + listed; if (seen.has(k)) return false; seen.add(k); return true; });
    const games = [];
    for (const { g, listed } of prior) {
      const st = g.status.detailedState, my = g.teams.away.team.id === team.id ? "away" : "home";
      const rec = { pk: g.gamePk, day: listed, officialDate: g.officialDate, startUTC: g.gameDate, status: st,
                    gameNumber: g.gameNumber, opp: ((o) => TEAM_ZH[o.id] || o.name)(g.teams[my === "away" ? "home" : "away"].team), pitchers: null, partial: false };
      if (FINAL.has(st) || LIVE.has(st)) {
        try { const bx = await get(`/api/v1/game/${g.gamePk}/boxscore`); rec.pitchers = extract(bx.teams[my]); rec.partial = !FINAL.has(st); }
        catch (e) { rec.error = String(e.message || e); }
      }
      games.push(rec);
    }
    out.teams[side] = { id: team.id, name: team.name, games };
  }
  return out;
}

// ── 整理 ──
// 日狀態（每一種都有依據）：
//   played      該日應有資料的場次全部取得且已完賽 → 合計是完整日合計
//   partial     已取得，但有場次仍在進行中 → 只是目前為止
//   incomplete  有場次取得、有場次沒取得 → 只是部分小計
//   error       應有資料的場次一場都沒取得
//   off／ppd／notstarted／other  沒有應計入的投球
// 人次＝登板次數（同一人雙重賽兩場都投算 2）；人數＝不同投手數
export const UNCERTAIN = new Set(["partial", "incomplete", "error", "other"]);
export function summarize(raw) {
  const days = [...raw.window.full, raw.window.today];
  const res = {};
  for (const side of ["away", "home"]) {
    const t = raw.teams[side];
    const dayInfo = days.map((d) => {
      const gs = t.games.filter((g) => g.day === d);
      const exp = gs.filter((g) => FINAL.has(g.status) || LIVE.has(g.status));
      const got = exp.filter((g) => g.pitchers), missing = exp.filter((g) => !g.pitchers);
      let st;
      if (!gs.length) st = "off";
      else if (!exp.length) st = gs.every((g) => /Postponed|Cancelled/.test(g.status)) ? "ppd"
        : gs.some((g) => /Scheduled|Pre-Game|Warmup/.test(g.status)) ? "notstarted" : "other";
      else if (!got.length) st = "error";
      else if (missing.length) st = "incomplete";
      else if (got.some((g) => g.partial)) st = "partial";
      else st = "played";
      const rp = got.flatMap((g) => g.pitchers.filter((p) => p.role === "RP"));
      const known = rp.filter((p) => p.pitches !== null);
      return { d, st, complete: st === "played",
        games: gs.map((g) => ({ pk: g.pk, status: g.status, gameNumber: g.gameNumber, opp: g.opp,
          data: g.pitchers ? (g.partial ? "partial" : "full") : (FINAL.has(g.status) || LIVE.has(g.status)) ? "missing" : "n/a" })),
        gamesExpected: exp.length, gamesMissing: missing.length,
        rpApps: rp.length, rpPitchers: new Set(rp.map((p) => p.id)).size,
        rpPitches: got.length ? known.reduce((a, p) => a + p.pitches, 0) : null,
        rpAppsNoCount: rp.length - known.length };
    });
    const byP = new Map();
    t.games.forEach((g) => (g.pitchers || []).filter((p) => p.role === "RP").forEach((p) => {
      if (!byP.has(p.id)) byP.set(p.id, { id: p.id, name: p.name, days: {} });
      const e = byP.get(p.id).days[g.day] || (byP.get(p.id).days[g.day] = { pitches: 0, apps: 0, noCount: 0, gameNumbers: [] });
      e.apps++; e.gameNumbers.push(g.gameNumber); if (p.pitches === null) e.noCount++; else e.pitches += p.pitches;
    }));
    const T = raw.window.today, idx = days.indexOf(T), unc = (i) => UNCERTAIN.has(dayInfo[i].st);
    const pitchers = [...byP.values()].map((p) => {
      let uncertain = false, i = idx;
      if (!p.days[T]) { if (unc(idx)) uncertain = true; i = idx - 1; }   // 本日沒看到他，但本日資料不全 → 可能漏算
      let streak = 0;
      while (i >= 0 && p.days[days[i]]) { streak++; i--; }
      if (i >= 0 && unc(i)) uncertain = true;                             // 斷點那天資料不全 → 可能其實沒斷
      const atEdge = i < 0 && streak > 0;
      const last = [...days].reverse().find((d) => p.days[d]);
      return { ...p, streak, streakAtEdge: atEdge, streakUncertain: uncertain, last,
               total: Object.values(p.days).reduce((a, e) => a + e.pitches, 0) };
    }).sort((a, b) => b.streak - a.streak || b.last.localeCompare(a.last) || b.total - a.total);
    res[side] = { name: t.name, days: dayInfo, pitchers };
  }
  return res;
}

// ── 每日建置：對 today＋tomorrow 每一場收集 ──
function cachedFetch(fetchJson) {
  const memo = new Map();
  return (url) => { if (!memo.has(url)) memo.set(url, fetchJson(url).catch((e) => { memo.delete(url); throw e; })); return memo.get(url); };
}
export async function buildBullpen({ games, fetchJson, nowISO }) {
  const f = cachedFetch(fetchJson), files = {}, index = {};
  for (const g of games) {
    try {
      const raw = await collectBullpen({ gamePk: g.pk, fetchJson: f, nowISO });
      const s = summarize(raw);
      const days = ["away", "home"].flatMap((k) => s[k].days);
      const missing = days.reduce((a, d) => a + d.gamesMissing, 0);
      const status = days.some((d) => ["incomplete", "error"].includes(d.st)) ? "incomplete" : "ok";
      files[g.pk] = { rules: RULES_VERSION, fetchedAt: nowISO, status, target: raw.target, window: raw.window, summary: s,
                      sources: raw.sources, gamesMissing: missing };
      index[g.pk] = { status, gamesMissing: missing };
    } catch (e) {
      const msg = String(e.message || e);
      files[g.pk] = { rules: RULES_VERSION, fetchedAt: nowISO, status: "failed", error: msg };
      index[g.pk] = { status: "failed", error: msg };
    }
  }
  return { files, index };
}

async function fetchWithRetry(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r.json(); last = new Error(`HTTP ${r.status} ${url}`); if (r.status < 500 && r.status !== 429) break; }
    catch (e) { last = e; }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  throw last;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data`;
  const games = fs.readdirSync(`${D}/games`).map((f) => JSON.parse(fs.readFileSync(`${D}/games/${f}`, "utf8")));
  const nowISO = new Date().toISOString();
  const { files, index } = await buildBullpen({ games, fetchJson: fetchWithRetry, nowISO });
  fs.mkdirSync(`${D}/bullpen`, { recursive: true });
  for (const [pk, v] of Object.entries(files)) fs.writeFileSync(`${D}/bullpen/${pk}.json`, JSON.stringify(v));
  const n = (s) => Object.values(index).filter((x) => x.status === s).length;
  const idx = { rules: RULES_VERSION, generatedAt: nowISO, counts: { ok: n("ok"), incomplete: n("incomplete"), failed: n("failed"), total: games.length }, games: index };
  fs.writeFileSync(`${D}/bullpen/index.json`, JSON.stringify(idx, null, 1));
  fs.appendFileSync(`${OUT}/report.md`, `\n## 牛棚（${RULES_VERSION}）\n\n完整 ${idx.counts.ok}／部分 ${idx.counts.incomplete}／失敗 ${idx.counts.failed}／共 ${idx.counts.total} 場\n` +
    Object.entries(index).filter(([, v]) => v.status !== "ok").map(([pk, v]) => `- ${pk}：${v.status}${v.error ? "（" + v.error + "）" : `（未取得 ${v.gamesMissing} 場）`}`).join("\n") + "\n");
  console.log(`牛棚：完整 ${idx.counts.ok}／部分 ${idx.counts.incomplete}／失敗 ${idx.counts.failed}／共 ${idx.counts.total}`);
}
