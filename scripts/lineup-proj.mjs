// 預估打線（非官方）：MLB 官方打線公布前，先記下第三方的預估名單，並用第二個來源逐棒比對找出還不確定的席位
// 用法：node scripts/lineup-proj.mjs [輸出資料夾，預設 .build]
//   主來源 RotoWire daily-lineups（今天＋明天頁，美東日期；有守位、左右打、來源標示 Expected／Confirmed）
//   比對來源 RotoGrinders lineups（只有今天頁）：同一棒次名字不同＝「不確定」；沒有比對來源＝「無法比對」
//   寫回單場檔 proj.away／proj.home：來源、來源標示、本站首次取得時間、當時距表定開賽幾分鐘、最後變動時間、每棒比對結果
//   該隊 MLB 官方打線出現後、或比賽已開打，保留最後一版預估、不再更新（之後才能和官方對照）
//   上一場打線不參與這裡的任何判斷：預估只來自上面兩個來源
// v0.2：兩站比對分成「人選幾位相同」「棒次幾棒相同」；保留首份完整預估（first）；官方打線出現時記下官方名單（official），
//   之後的臨場異動另記 officialLate、不覆蓋對照基準；vsOfficial＝首份／最後一版各自與官方的人選、棒次相同數
//   另記來源觀察紀錄 live-data/proj/sources.json：來源第一次被本站看到有 9 人名單的時間、何時對到本站收錄的比賽（分開「來源沒提供」與「本站沒收」）
// 這是公開網頁的個人非商業使用；兩站條款都限制自動擷取（見 Source Audit 紀錄），每 15 分鐘各抓 1～3 頁
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const PROJ_RULES = "proj v0.2";
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
const sigN = slots => (slots || []).map(s => `${s.n}:${pkey(s.name)}`).join("|");
const pick = slots => slots.map(({ n, name, pos }) => ({ n, name, pos: pos ?? null }));
const full = slots => (slots || []).length >= 9;

// 兩份名單比：人選＝b 的球員有幾位出現在 a（不管棒次）；棒次＝同一棒次同一人有幾棒；n＝b 的人數
export function cmpLists(a, b) {
  if (!a?.length || !b?.length) return null;
  const ka = new Set(a.map(x => pkey(x.name))), at = new Map(a.map(x => [x.n, pkey(x.name)]));
  return { people: b.filter(x => ka.has(pkey(x.name))).length, order: b.filter(x => at.get(x.n) === pkey(x.name)).length, n: b.length };
}
// 兩站比對摘要（從逐棒結果算）：人選相同＝一致＋只是換棒次；棒次相同＝一致
export const crossCmp = slots => slots.some(s => s.check === "none") ? null
  : { people: slots.filter(s => s.check === "same" || s.altAt).length, order: slots.filter(s => s.check === "same").length, n: slots.length };
const minsBefore = (g, iso) => g.tbd || !g.startUTC ? null : Math.round((Date.parse(g.startUTC) - Date.parse(iso)) / 6e4);

// v0.1 的舊紀錄沒有 first：名單從未變過（changedAt＝firstSeen）才能確定首份就是現在這份；變過就留空，不拿後來的名單冒充
export const legacyFirst = p => p.first !== undefined ? p.first : full(p.slots) && p.changedAt === p.firstSeen ? { at: p.firstSeen, slots: pick(p.slots) } : null;

// 一隊一場的預估紀錄：首次取得時間只在第一次寫；名單或守位變了才更新 changedAt
export function nextTeam(prev, rw, rg, g, nowISO, srcAt) {
  if (!rw?.slots?.length) return prev ? { ...prev, missingSince: prev.missingSince || nowISO } : null;
  const slots = crossCheck(rw.slots, rg), changed = !prev || sig(prev.slots) !== sig(slots);
  // 首份完整預估：第一次拿到 9 人名單的時間＋當時那份名單，之後不改（舊紀錄只有在名單從未變過時才能補回）
  const first = prev ? legacyFirst(prev) ?? (full(prev.slots) ? null : full(slots) ? { at: nowISO, slots: pick(slots) } : null)
    : full(slots) ? { at: nowISO, slots: pick(slots) } : null;
  return { source: "RotoWire", sourceStatus: rw.status, sourceStatusKey: rw.statusKey, cross: rg?.slots?.length ? "RotoGrinders" : null,
    firstSeen: prev?.firstSeen || nowISO, firstSeenMinutesBeforeScheduledStart: prev ? prev.firstSeenMinutesBeforeScheduledStart : minsBefore(g, nowISO),
    changedAt: changed ? nowISO : prev.changedAt, fetchedAt: srcAt, uncertain: slots.filter(s => s.check === "diff").map(s => s.n),
    crossCmp: crossCmp(slots), first, slots };
}

const official = t => ["official", "late"].includes(t?.lineup?.state);
export const frozen = (g, side) => g.status?.code !== "pre" || official(g[side]);

// 凍結後補上官方名單與對照：第一次看到的官方名單是對照基準；之後名單再變（臨場異動）另記 officialLate，不覆蓋基準
export function withOfficial(p, L, nowISO) {
  if (!p || !L?.slots?.length || !["official", "late"].includes(L.state)) return p;
  const cur = pick(L.slots);
  let off = p.official, late = p.officialLate;
  if (!off) off = { at: L.firstSeen || nowISO, slots: cur, ...(L.state === "late" ? { capturedAfterLate: true } : {}) };
  else if (sigN(cur) !== sigN(off.slots) && sigN(cur) !== sigN(late?.slots)) late = { at: L.lateAt || nowISO, slots: cur };
  return { ...p, official: off, ...(late ? { officialLate: late } : {}), vsOfficial: { first: cmpLists(p.first?.slots, off.slots), last: cmpLists(p.slots, off.slots) } };
}

// 來源觀察紀錄：每個來源頁、每隊一筆；first＝本站第一次看到這隊 9 人名單，inScopeAt＝第一次對到本站收錄的比賽
export function updateSources(log, obs, nowISO, keepFrom) {
  const out = { ...(log || {}) };
  for (const o of obs) { if (!full(o.slots)) continue;
    const e = out[o.key] || { source: o.source, date: o.date, team: o.team, first: nowISO, pk: null, inScopeAt: null };
    out[o.key] = { ...e, fetchedAt: nowISO, ...(o.pk && !e.pk ? { pk: o.pk, inScopeAt: nowISO } : {}) }; }
  for (const k of Object.keys(out)) if (out[k].date < keepFrom) delete out[k];
  return out;
}

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
  // 來源觀察紀錄（含本站沒收錄的比賽）
  const pkOf = (m, x) => [...m].find(([, y]) => y === x)?.[0] || null, obs = [], dup = new Map();
  for (const [src, list, m] of [["RotoWire", rw, mRW], ["RotoGrinders", rg, mRG]]) for (const x of list) {
    const k0 = `${src}|${x.date}|${x.away}@${x.home}`, i = (dup.get(k0) || 0) + 1; dup.set(k0, i);
    for (const side of ["away", "home"]) obs.push({ key: `${k0}${i > 1 ? `#${i}` : ""}|${side}`, source: src, date: x.date, team: x[side], slots: x.sides[side]?.slots, pk: pkOf(m, x) }); }
  const SL = `${OUT}/live-data/proj/sources.json`, prevLog = read("live/data/proj/sources.json")?.teams;
  const log = updateSources(prevLog, obs, nowISO, etDate(now, -10));
  fs.mkdirSync(`${OUT}/live-data/proj`, { recursive: true });
  fs.writeFileSync(SL, JSON.stringify({ rules: PROJ_RULES, note: "first＝本站第一次看到來源有這隊 9 人名單（受本站抓取時間限制，是上界）；inScopeAt＝第一次對到本站收錄的比賽；pk 空白＝來源有、本站收錄範圍（台灣今天／明天）沒有這場", teams: log }, null, 1));
  const outScope = obs.filter(o => full(o.slots) && !o.pk).length;
  const c = { games: 0, teams: 0, cross: 0, uncertainTeams: 0, frozen: 0, none: 0, vs: 0 };
  for (const g of games) {
    const prev = prevOf(g.pk), a = mRW.get(g.pk), b = mRG.get(g.pk);
    const proj = { rules: PROJ_RULES, fetchedAt: nowISO, failed: errs.length ? errs : undefined };
    let any = false;
    for (const side of ["away", "home"]) {
      if (frozen(g, side)) { proj[side] = prev?.[side] ? withOfficial({ ...prev[side], first: legacyFirst(prev[side]), frozenAt: prev[side].frozenAt || nowISO }, g[side].lineup, nowISO) : null; if (proj[side]) { c.frozen++; any = true; if (proj[side].official) c.vs++; } continue; }
      // 這次主來源抓取失敗：沿用上一版並標示，不當成「來源沒有」
      if (errs.some(e => e.startsWith("RotoWire")) && !a) { proj[side] = prev?.[side] ? { ...prev[side], retryFailedSince: prev[side].retryFailedSince || nowISO } : null; if (proj[side]) any = true; continue; }
      proj[side] = nextTeam(prev?.[side], a?.sides[side], b?.sides[side], g, nowISO, a?.at);
      if (proj[side]) { any = true; c.teams++; if (proj[side].cross) c.cross++; if (proj[side].uncertain.length) c.uncertainTeams++; } else if (g.status?.code === "pre") c.none++;
    }
    if (any) c.games++;
    g.proj = proj; // 沒有任何一隊預估也保留檢查時間，頁面才能說「來源目前沒有」而不是空白
    fs.writeFileSync(`${D}/${g.pk}.json`, JSON.stringify(g));
  }
  const line = `${pages.join("；")}｜有預估 ${c.games} 場；更新中 ${c.teams} 隊（有第二來源比對 ${c.cross} 隊，其中有不一致席位 ${c.uncertainTeams} 隊）；官方打線已出或已開賽而凍結 ${c.frozen} 隊（其中已記官方名單可對照 ${c.vs} 隊）；賽前仍無預估 ${c.none} 隊；來源有 9 人名單但本站收錄範圍沒有這場 ${outScope} 隊`
    + (errs.length ? "\n" + errs.map(e => "- " + e).join("\n") : "");
  fs.appendFileSync(`${OUT}/report.md`, `\n## 預估打線（${PROJ_RULES}，非官方）\n\n${line}\n`);
  console.log("預估打線：" + line);
}
