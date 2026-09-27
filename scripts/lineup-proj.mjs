// 預估打線（非官方）：MLB 官方打線公布前，先記下第三方的預估名單，並用第二個來源逐棒比對找出還不確定的席位
// 用法：node scripts/lineup-proj.mjs [輸出資料夾，預設 .build]
//   主來源 RotoWire daily-lineups（今天＋明天頁，美東日期；有守位、左右打、來源標示 Expected／Confirmed）
//   比對來源 RotoGrinders lineups（只有今天頁）：同一棒次名字不同＝「不確定」；沒有比對來源＝「無法比對」
//   寫回單場檔 proj.away／proj.home：來源、來源標示、本站首次取得時間、當時距表定開賽幾分鐘、最後變動時間、每棒比對結果
//   該隊 MLB 官方打線出現後、或比賽已開打，保留最後一版預估、不再更新（之後才能和官方對照）
//   上一場打線不參與這裡的任何判斷：預估只來自上面兩個來源
// 這是公開網頁的個人非商業使用；兩站條款都限制自動擷取（見 Source Audit 紀錄），每 15 分鐘各抓 1～3 頁
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const PROJ_RULES = "proj v0.1";
const RW = "https://www.rotowire.com/baseball/daily-lineups.php", RG = "https://rotogrinders.com/lineups/mlb";
const AB = { ARI: "AZ", WAS: "WSH", CHW: "CWS", KCR: "KC", SDP: "SD", SFG: "SF", TBR: "TB", OAK: "ATH", AZ: "AZ" };
const ab = x => AB[x] || x;
const ENT = { amp: "&", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const MARK = { acute: "\u0301", grave: "\u0300", tilde: "\u0303", uml: "\u0308", circ: "\u0302", cedil: "\u0327" };
const txt = s => s == null ? null : s.replace(/&([a-z])(acute|grave|tilde|uml|circ|cedil);/gi, (m, c, k) => (c + MARK[k.toLowerCase()]).normalize("NFC")).replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => ENT[e] ?? (e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : m)).replace(/\s+/g, " ").trim();
export const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "").replace(/[^a-z]/g, "");
// 比對用：名字首字母＋姓（兩站對同一人常用不同寫法，例：Donovan Walton／Donnie Walton、J.T.／JT）
export const pkey = s => { const w = (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,']/g, "").split(/\s+/).filter(x => x && !/^(jr|sr|ii|iii|iv)$/.test(x));
  return w.length ? w[0][0] + w.at(-1).replace(/[^a-z]/g, "") : ""; };

// RotoWire：每場 <div class="lineup is-mlb …">，客隊 ul.lineup__list.is-visit、主隊 is-home；li.lineup__player 依棒次排列
export function parseRotoWire(html) {
  const out = [];
  for (const p of html.split(/class="lineup is-mlb/).slice(1)) {
    if (/^[^"]*is-tools/.test(p)) continue;
    const abbr = [...p.matchAll(/class="lineup__abbr"[^>]*>([^<]*)</g)].map(m => ab(txt(m[1])));
    const side = cls => {
      const i = p.indexOf(`lineup__list ${cls}`); if (i < 0) return null;
      const s = p.slice(i, p.indexOf("</ul>", i)), st = s.match(/class="lineup__status ([^"]*)"[^>]*>([\s\S]*?)<\/li>/);
      const slots = [...s.matchAll(/<li class="lineup__player"[^>]*>([\s\S]*?)<\/li>/g)].map((m, k) => ({ n: k + 1,
        pos: txt(m[1].match(/lineup__pos"[^>]*>([^<]*)/)?.[1]), name: txt(m[1].match(/title="([^"]*)"/)?.[1]), bats: txt(m[1].match(/lineup__bats"[^>]*>([^<]*)/)?.[1]) }));
      return { status: txt(st?.[2]?.replace(/<[^>]*>/g, " ")) || null, statusKey: st?.[1].replace(/^is-/, "").trim() || null, slots };
    };
    if (abbr.length < 2) continue;
    out.push({ time: txt(p.match(/class="lineup__time"[^>]*>([^<]*)</)?.[1]), away: abbr[0], home: abbr[1], sides: { away: side("is-visit"), home: side("is-home") } });
  }
  return out;
}

// RotoGrinders：每場 div.module.game-card，兩個 span.team-nameplate-title[data-abbr]，兩張 div.lineup-card（客、主），li.lineup-card-player 依棒次
export function parseRotoGrinders(html) {
  const out = [], m = html.match(/MLB STARTING LINEUPS\s*(?:<[^>]*>\s*)*([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/i);
  const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const date = m && MON[m[1]] ? `${m[3]}-${String(MON[m[1]]).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
  for (const p of html.split(/class="module game-card"/).slice(1)) {
    const abbr = [...p.matchAll(/team-nameplate-title"[^>]*data-abbr="([^"]*)"/g)].map(x => ab(x[1]));
    const cards = p.split(/class="lineup-card"/).slice(1).map(c => ({
      unconfirmed: /lineup-card-(body )?unconfirmed/.test(c),
      slots: [...c.matchAll(/<li class="lineup-card-player"[^>]*>([\s\S]*?)<\/li>/g)].map((x, k) => ({ n: k + 1, name: txt(x[1].match(/player-nameplate-name"[^>]*>([^<]*)</)?.[1]) })) }));
    if (abbr.length < 2 || cards.length < 2) continue;
    out.push({ date, away: abbr[0], home: abbr[1], sides: { away: cards[0], home: cards[1] } });
  }
  return { date, games: out };
}

// 逐棒比對：同棒同名＝一致；不同＝不確定（附上比對來源的名字；若主來源這位球員在比對來源的其他棒次，一併註明）
export function crossCheck(slots, alt) {
  if (!alt?.slots?.length) return slots.map(s => ({ ...s, check: "none" }));
  const at = new Map(alt.slots.map(x => [pkey(x.name), x.n]));
  return slots.map(s => { const a = alt.slots.find(x => x.n === s.n);
    if (a && pkey(a.name) === pkey(s.name)) return { ...s, check: "same" };
    return { ...s, check: "diff", alt: a?.name ?? null, altAt: at.get(pkey(s.name)) ?? null }; });
}

const sig = slots => (slots || []).map(s => `${s.n}:${norm(s.name)}:${s.pos || ""}`).join("|");
const minsBefore = (g, iso) => g.tbd || !g.startUTC ? null : Math.round((Date.parse(g.startUTC) - Date.parse(iso)) / 6e4);

// 一隊一場的預估紀錄：首次取得時間只在第一次寫；名單或守位變了才更新 changedAt
export function nextTeam(prev, rw, rg, g, nowISO, srcAt) {
  if (!rw?.slots?.length) return prev ? { ...prev, missingSince: prev.missingSince || nowISO } : null;
  const slots = crossCheck(rw.slots, rg), changed = !prev || sig(prev.slots) !== sig(slots);
  return { source: "RotoWire", sourceStatus: rw.status, sourceStatusKey: rw.statusKey, cross: rg?.slots?.length ? "RotoGrinders" : null,
    firstSeen: prev?.firstSeen || nowISO, firstSeenMinutesBeforeScheduledStart: prev ? prev.firstSeenMinutesBeforeScheduledStart : minsBefore(g, nowISO),
    changedAt: changed ? nowISO : prev.changedAt, fetchedAt: srcAt, uncertain: slots.filter(s => s.check === "diff").map(s => s.n), slots };
}

const official = t => ["official", "late"].includes(t?.lineup?.state);
export const frozen = (g, side) => g.status?.code !== "pre" || official(g[side]);

// 把解析結果對到本站的比賽：美東日期＋客主隊；同一天同組合（雙重賽）依開賽時間順序對
export function matchGames(games, parsed, dateOf) {
  const m = new Map();
  for (const x of parsed) { const k = `${dateOf(x)}|${x.away}|${x.home}`; (m.get(k) || m.set(k, []).get(k)).push(x); }
  const res = new Map(), byKey = new Map();
  for (const g of [...games].sort((a, b) => String(a.startUTC).localeCompare(String(b.startUTC)))) {
    const k = `${g.usDate}|${g.away.ab}|${g.home.ab}`, i = byKey.get(k) || 0; byKey.set(k, i + 1);
    const x = m.get(k)?.[i]; if (x) res.set(g.pk, x);
  }
  return res;
}

const etDate = (ms, addDays = 0) => new Date(ms + addDays * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

async function getText(url, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (personal non-commercial research; yuncai101)", accept: "text/html" } });
      if (r.ok) return r.text(); last = new Error(`HTTP ${r.status}`); if (r.status < 500 && r.status !== 429) break; }
    catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 2000 * (i + 1)));
  }
  throw last;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data/games`, now = Date.now(), nowISO = new Date(now).toISOString();
  const read = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const games = fs.readdirSync(D).filter(f => f.endsWith(".json")).map(f => read(`${D}/${f}`)).filter(Boolean);
  const prevOf = pk => read(`live/data/games/${pk}.json`)?.proj || null;
  const errs = [], pages = [];
  // RotoWire 今天、明天兩頁（美東日期）；RotoGrinders 今天一頁
  const rw = [];
  for (const [q, add] of [["", 0], ["?date=tomorrow", 1]]) {
    const d = etDate(now, add);
    try { const ps = parseRotoWire(await getText(RW + q)); ps.forEach(x => rw.push({ ...x, date: d, at: nowISO })); pages.push(`RotoWire ${d}：${ps.length} 場`); }
    catch (e) { errs.push(`RotoWire ${d}：${e.message}`); }
  }
  let rg = [];
  try { const r = parseRotoGrinders(await getText(RG)); rg = r.games; pages.push(`RotoGrinders ${r.date || "日期未解析"}：${rg.length} 場`); }
  catch (e) { errs.push(`RotoGrinders：${e.message}`); }
  const mRW = matchGames(games, rw, x => x.date), mRG = matchGames(games, rg, x => x.date);
  const c = { games: 0, teams: 0, cross: 0, uncertainTeams: 0, frozen: 0, none: 0 };
  for (const g of games) {
    const prev = prevOf(g.pk), a = mRW.get(g.pk), b = mRG.get(g.pk);
    const proj = { rules: PROJ_RULES, fetchedAt: nowISO, failed: errs.length ? errs : undefined };
    let any = false;
    for (const side of ["away", "home"]) {
      if (frozen(g, side)) { proj[side] = prev?.[side] ? { ...prev[side], frozenAt: prev[side].frozenAt || nowISO } : null; if (proj[side]) { c.frozen++; any = true; } continue; }
      // 這次主來源抓取失敗：沿用上一版並標示，不當成「來源沒有」
      if (errs.some(e => e.startsWith("RotoWire")) && !a) { proj[side] = prev?.[side] ? { ...prev[side], retryFailedSince: prev[side].retryFailedSince || nowISO } : null; if (proj[side]) any = true; continue; }
      proj[side] = nextTeam(prev?.[side], a?.sides[side], b?.sides[side], g, nowISO, a?.at);
      if (proj[side]) { any = true; c.teams++; if (proj[side].cross) c.cross++; if (proj[side].uncertain.length) c.uncertainTeams++; } else if (g.status?.code === "pre") c.none++;
    }
    if (any) c.games++;
    g.proj = any ? proj : null;
    fs.writeFileSync(`${D}/${g.pk}.json`, JSON.stringify(g));
  }
  const line = `${pages.join("；")}｜有預估 ${c.games} 場；更新中 ${c.teams} 隊（有第二來源比對 ${c.cross} 隊，其中有不一致席位 ${c.uncertainTeams} 隊）；官方打線已出或已開賽而凍結 ${c.frozen} 隊；賽前仍無預估 ${c.none} 隊`
    + (errs.length ? "\n" + errs.map(e => "- " + e).join("\n") : "");
  fs.appendFileSync(`${OUT}/report.md`, `\n## 預估打線（${PROJ_RULES}，非官方）\n\n${line}\n`);
  console.log("預估打線：" + line);
}
