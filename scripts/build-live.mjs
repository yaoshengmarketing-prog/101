// 運彩 101 /live/ 每日資料建置：只用 MLB 官方 Stats API（statsapi.mlb.com）
// 用法：node scripts/build-live.mjs [輸出資料夾，預設 .build]   （Node 20+，無外部套件）
// 產出先寫到輸出資料夾，QA 通過後才由 workflow 複製進 live/data 與 data/：
//   <out>/live-data/manifest.json、dates/<台灣日期>.json、games/<gamePk>.json
//   <out>/state.json（首次看到時間）、<out>/events.jsonl（本次變化）、<out>/report.md
// 抓取與標準化寫在同一支：兩者之間沒有其他消費者，拆成兩支只會多一份中間檔。

const API = "https://statsapi.mlb.com/api/v1";
export const TEAM_ZH = { 109: "響尾蛇", 133: "運動家", 144: "勇士", 110: "金鶯", 111: "紅襪", 112: "小熊", 145: "白襪", 113: "紅人", 114: "守護者", 115: "落磯", 116: "老虎", 117: "太空人", 118: "皇家", 108: "天使", 119: "道奇", 146: "馬林魚", 158: "釀酒人", 142: "雙城", 121: "大都會", 147: "洋基", 143: "費城人", 134: "海盜", 135: "教士", 137: "巨人", 136: "水手", 138: "紅雀", 139: "光芒", 140: "遊騎兵", 141: "藍鳥", 120: "國民" };
const STATE_ZH = { Scheduled: "已排定", "Pre-Game": "賽前準備", Warmup: "熱身中", "In Progress": "進行中", "Game Over": "已結束", Final: "已結束", "Completed Early": "提前結束", Postponed: "延期", Cancelled: "取消", Suspended: "暫停（待續賽）", Delayed: "延遲", "Delayed Start": "延後開賽" };

export const twDate = d => new Date(Date.parse(d) + 8 * 36e5).toISOString().slice(0, 10); // UTC+8 日期
export const twTime = d => new Date(Date.parse(d) + 8 * 36e5).toISOString().slice(11, 16);
const addDays = (ymd, n) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const twStamp = d => { const s = new Date(Date.parse(d) + 8 * 36e5).toISOString(); return `${s.slice(5, 10).replace("-", "/")} ${s.slice(11, 16)}`; };
const localTime = (d, tz) => { try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }).format(new Date(d)); } catch { return null; } };

function statusOf(g) {
  const s = g.status || {}, det = s.detailedState || "";
  let code = { Preview: "pre", Live: "live", Final: "final" }[s.abstractGameState] || "pre";
  if (/Postponed/i.test(det)) code = "ppd"; else if (/Cancel/i.test(det)) code = "cxl"; else if (/Suspended/i.test(det)) code = "susp";
  const base = Object.keys(STATE_ZH).find(k => det.startsWith(k));
  return { code, text: base ? STATE_ZH[base] + (det.length > base.length ? `（${det}）` : "") : det, raw: det, reason: s.reason || null };
}

// prevGame(pk)：上一版已公開的 games/<pk>.json（沒有就 null）。某項抓取失敗時沿用它並標示原取得時間，不用空值蓋掉。
export async function build({ fetchJson, now = new Date(), state = { games: {} }, prevGame = () => null }) {
  const today = twDate(now.toISOString()), tomorrow = addDays(today, 1), nowISO = now.toISOString();
  const events = [], errors = [];
  const ev = (pk, type, detail) => events.push({ at: nowISO, pk, type, ...detail });
  const errBy = {}; // 抓取失敗的項目 → 錯誤訊息
  const soft = async (what, p) => { try { return await p; } catch (e) { const error = String(e.message || e); errors.push({ what, error }); errBy[what] = error; return null; } };

  // 1) 賽程（必要；失敗就整次失敗，保留上一版）：台灣今天/明天 ≈ 美國前一天到當天；往前多抓 12 天找各隊上一場；
  //    往後多看 7 天（同一次呼叫）只用來判斷「近期有沒有賽事」（首頁無賽呈現，站長 10-18 B1），不產生那幾天的資料
  const sched = await fetchJson(`${API}/schedule?sportId=1&startDate=${addDays(today, -12)}&endDate=${addDays(tomorrow, 7)}&hydrate=probablePitcher,linescore,venue(timezone),team,weather`);
  const all = sched.dates.flatMap(d => d.games);
  const byPk = new Map();
  for (const g of all) {
    const d = twDate(g.gameDate);
    if (d !== today && d !== tomorrow) continue;
    const prev = byPk.get(g.gamePk); // 同一 gamePk 在賽程出現兩次（延期改期）時只留一筆，優先非延期那筆
    if (!prev || (statusOf(prev).code === "ppd" && statusOf(g).code !== "ppd")) byPk.set(g.gamePk, g);
  }
  const games = [...byPk.values()].sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk);
  // The statistics belong to the scheduled game's US season, never the year in which this script happens to run.
  const gameSeasons = [...new Set(games.map(g => String(g.officialDate).slice(0, 4)))];
  if (gameSeasons.length > 1) throw new Error("同輪含不同賽季；不可共用一份本季統計");
  const season = gameSeasons[0] || today.slice(0, 4);
  const statsScope = { season, gameType: "R" };
  // 明天之後 7 天（台灣日期）的正式賽程場數；延期、取消不算。只說「有沒有近期賽事」，不推論賽季是否結束
  const upFrom = addDays(tomorrow, 1), upTo = addDays(tomorrow, 7);
  const ahead = [...new Map(all.filter(g => { const d = twDate(g.gameDate); return d >= upFrom && d <= upTo && !["ppd", "cxl"].includes(statusOf(g).code); }).map(g => [g.gamePk, g])).values()];
  const upcoming = { from: upFrom, to: upTo, count: ahead.length, next: ahead.length ? ahead.map(g => twDate(g.gameDate)).sort()[0] : null };
  const finals = all.filter(g => g.status?.abstractGameState === "Final" && !/Postponed|Cancel/i.test(g.status.detailedState));

  // 2) 戰績、團隊打擊／投球（選配；失敗記錯誤，欄位顯示尚未取得）
  const [st, hit, pit] = await Promise.all([
    soft("standings", fetchJson(`${API}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`)),
    soft("team hitting", fetchJson(`${API}/teams/stats?season=${season}&group=hitting&stats=season&sportIds=1&gameType=R`)),
    soft("team pitching", fetchJson(`${API}/teams/stats?season=${season}&group=pitching&stats=season&sportIds=1&gameType=R`))]);
  const rec = {};
  for (const r of st?.records || []) for (const t of r.teamRecords) {
    const sp = Object.fromEntries((t.records?.splitRecords || []).map(x => [x.type, `${x.wins}-${x.losses}`]));
    rec[t.team.id] = { rec: `${t.wins}-${t.losses}`, pct: t.winningPercentage, home: sp.home || null, road: sp.away || null, l10: sp.lastTen || null, streak: t.streak?.streakCode || null, rs: t.runsScored, ra: t.runsAllowed, gp: t.gamesPlayed };
  }
  const REC = ["rec", "pct", "home", "road", "l10", "streak", "rs", "ra", "gp"];
  const sameSeason = s => !s.season || String(s.season) === season;
  const teamScope = s => sameSeason(s) && (!s.gameType || s.gameType === "R"); // team API may omit gameType; explicit request above is R
  const hitRows = hit?.stats?.[0]?.splits || [], pitRows = pit?.stats?.[0]?.splits || [];
  const ops = Object.fromEntries(hitRows.filter(teamScope).map(s => [s.team.id, s.stat.ops]));
  const era = Object.fromEntries(pitRows.filter(teamScope).map(s => [s.team.id, s.stat.era]));
  const wrongScope = (rows, id) => rows.some(s => s.team?.id === id && !teamScope(s));

  // 多隊分列時取不分隊合計列；只有一列就用那列；多隊分列但缺合計＝null（不把其中一隊當全季、不平均）
  const tot = rows => rows.length === 1 ? rows[0] : rows.find(x => !x.team) || null;
  // 3) 先發投手：慣用手＋本季大聯盟成績（被交易者取不分隊合計）
  const spIds = [...new Set(games.flatMap(g => ["away", "home"].map(s => g.teams[s].probablePitcher?.id).filter(Boolean)))];
  const ppl = {}; let peopleOk = true;
  if (spIds.length) {
    const r = await soft("pitchers", fetchJson(`${API}/people?personIds=${spIds.join(",")}&hydrate=stats(group=[pitching],type=[season],season=${season},gameType=R)`));
    peopleOk = !!r;
    for (const p of r?.people || []) {
      const raw = p.stats?.[0]?.splits || [], sp = raw.filter(x => sameSeason(x) && x.gameType === "R"), s = tot(sp)?.stat;
      ppl[p.id] = { hand: p.pitchHand?.code || null, s: s ? { wl: `${s.wins}-${s.losses}`, era: s.era, ip: s.inningsPitched, gs: s.gamesStarted, whip: s.whip, so: s.strikeOuts, bb: s.baseOnBalls } : null,
        statStatus: s ? "value" : sp.length ? "unavailable" : raw.length ? "scope_unconfirmed" : "no_record", ...(sp.length > 1 && !s ? { sNote: "multi" } : {}) };
    }
  }

  // 4) 打線：本場 boxscore battingOrder（官方）＋各隊上一場已完賽 boxscore（參考）
  const prevOf = (teamId, beforeISO, pk) => finals.filter(g => g.gamePk !== pk && g.gameDate < beforeISO && (g.teams.away.team.id === teamId || g.teams.home.team.id === teamId)).sort((a, b) => b.gameDate.localeCompare(a.gameDate))[0];
  const need = new Set(games.map(g => g.gamePk)), prevMap = {};
  for (const g of games) for (const s of ["away", "home"]) { const p = prevOf(g.teams[s].team.id, g.gameDate, g.gamePk); prevMap[`${g.gamePk}:${s}`] = p || null; if (p) need.add(p.gamePk); }
  const box = {}, pks = [...need];
  for (let i = 0; i < pks.length; i += 6) await Promise.all(pks.slice(i, i + 6).map(async pk => { box[pk] = await soft(`boxscore ${pk}`, fetchJson(`${API}/game/${pk}/boxscore`)); }));
  const slotsOf = (bx, side) => {
    // 只取先發：players[].battingOrder 為 "100","200"…"900"（替補是 301、302…）；teams.battingOrder 陣列在賽後會是最後在場者，不能直接用
    const t = bx?.teams?.[side]; if (!t) return null;
    let st = Object.values(t.players || {}).filter(p => p.battingOrder && +p.battingOrder % 100 === 0).sort((x, y) => x.battingOrder - y.battingOrder);
    if (!st.length && t.battingOrder?.length) st = t.battingOrder.map(id => t.players["ID" + id] || { person: { id } });
    if (!st.length) return null;
    return st.map((p, i) => { const b = bat[p.person?.id] || {};
      return { n: i + 1, id: p.person?.id, name: p.person?.fullName || String(p.person?.id), pos: p.allPositions?.[0]?.abbreviation || p.position?.abbreviation || null, avg: b.avg ?? null, ops: b.ops ?? null, pa: b.pa ?? null, statStatus: b.statStatus || "unavailable" }; });
  };
  // 打線 AVG／OPS：另查 people 的該場賽季例行賽成績（被交易者取不分隊合計）。boxscore 的 seasonStats 在季後賽會變成季後賽累計（開賽前可能全是 .000），不能當「本季」
  //   查不到就是 null（顯示 —），不回頭用 boxscore 的數字
  const bat = {}, batIds = [...new Set(pks.flatMap(pk => ["away", "home"].flatMap(s => Object.values(box[pk]?.teams?.[s]?.players || {}).filter(p => p.battingOrder && +p.battingOrder % 100 === 0).map(p => p.person?.id).concat(box[pk]?.teams?.[s]?.battingOrder || []))).filter(Boolean))];
  for (let i = 0; i < batIds.length; i += 100) {
    const r = await soft("batters", fetchJson(`${API}/people?personIds=${batIds.slice(i, i + 100).join(",")}&hydrate=stats(group=[hitting],type=[season],season=${season},gameType=R)`));
    for (const p of r?.people || []) { const raw = p.stats?.[0]?.splits || [], splits = raw.filter(x => sameSeason(x) && x.gameType === "R"), s = tot(splits)?.stat;
      bat[p.id] = s ? { avg: s.avg ?? null, ops: s.ops ?? null, pa: s.plateAppearances ?? null, statStatus: "value" } : { statStatus: splits.length ? "unavailable" : raw.length ? "scope_unconfirmed" : "no_record" }; }
  }

  // 天氣：MLB 官方賽前天氣（schedule 的 weather，通常開賽前幾小時才有）。沒有就是 null＝尚未公布，不補預報
  //   firstSeen＝本站第一次看到；changedAt＝內容最後一次變動。原文與數值都留著
  const weatherOf = (w, S, nowISO) => {
    if (!w || !(w.condition || w.temp || w.wind)) return null;
    const raw = { condition: w.condition || null, temp: w.temp || null, wind: w.wind || null }, key = JSON.stringify(raw);
    if (!S.wx) S.wx = { firstSeen: nowISO };
    if (S.wx.key !== key) { S.wx.key = key; S.wx.changedAt = nowISO; }
    const m = /^(\d+)\s*mph,?\s*(.*)$/.exec(raw.wind || "");
    return { ...raw, tempF: raw.temp != null && /^-?\d+$/.test(raw.temp) ? +raw.temp : null, windMph: m ? +m[1] : null, windDir: m ? m[2] || null : null,
      firstSeen: S.wx.firstSeen, changedAt: S.wx.changedAt };
  };

  // 5) 逐場組資料＋首次看到時間；單場出錯只影響該場的選配欄位
  const out = {};
  for (const g of games) {
    const pk = g.gamePk, S = (state.games[pk] ||= { firstSeen: nowISO, sp: {}, lu: {}, late: {} }), P0 = prevGame(pk);
    const oldStatsSame = P0 && (P0.statsScope?.season || String(P0.usDate || "").slice(0, 4)) === season
      && (!P0.statsScope || P0.statsScope.gameType === "R");
    const status = statusOf(g), tz = g.venue?.timeZone?.id || null, tbd = !!g.status?.startTimeTBD;
    const base = { pk, season: String(g.officialDate).slice(0, 4), statsScope, twDate: twDate(g.gameDate), usDate: g.officialDate, startUTC: g.gameDate, tbd, twTime: tbd ? null : twTime(g.gameDate), localTime: tbd || !tz ? null : localTime(g.gameDate, tz), tz,
      venue: g.venue?.name || null, status, dh: g.doubleHeader && g.doubleHeader !== "N" ? `G${g.gameNumber}` : null,
      rescheduledFrom: g.rescheduledFrom || null, rescheduleDate: g.rescheduleDate || null, inning: g.linescore?.currentInningOrdinal || null, inningHalf: g.linescore?.inningHalf || null,
      gameType: g.gameType || null, series: g.seriesDescription ? { desc: g.seriesDescription, n: g.seriesGameNumber ?? null, of: g.gamesInSeries ?? null } : null, // 名單狀態的比較基準依賽事型態選（scripts/roster.mjs）
      firstSeen: S.firstSeen, updatedAt: nowISO, errors: [], weather: weatherOf(g.weather, S, nowISO) };
    const minimal = s => { const t = g.teams[s].team; return { id: t.id, ab: t.abbreviation || null, name: TEAM_ZH[t.id] || t.name, en: t.name, score: g.teams[s].score ?? null, sp: null, lineup: { state: "none", firstSeen: null, lateAt: null, slots: null }, roster: null, prev: null }; };
    try {
      if (S.status && S.status !== status.raw) ev(pk, "status", { from: S.status, to: status.raw });
      S.status = status.raw;
      const side = s => {
        const t = g.teams[s], id = t.team.id, P = t.probablePitcher, o = P0?.[s];
        // 抓取失敗 → failed[項目]＝{ since 從何時起連續失敗, error, fetchedAt 目前顯示的舊值是何時取得（null＝沒有舊值可用） }
        // 來源回應成功但內容變了／沒了，是來源真的修改或撤回，不算失敗，照來源的新內容
        const failed = {}, fail = (key, what, hasOld) => { const f = o?.failed?.[key];
          failed[key] = { since: f?.since || nowISO, error: errBy[what] || "未取得", fetchedAt: hasOld ? (f ? f.fetchedAt : P0.updatedAt) : null }; };
        if ((S.sp[s]?.id || null) !== (P?.id || null)) { if (S.sp[s] || P) ev(pk, "sp", { side: s, from: S.sp[s]?.name || null, to: P?.fullName || null }); S.sp[s] = P ? { id: P.id, name: P.fullName, at: nowISO } : null; }
        // 先發投手成績（people API）
        let pp = P ? ppl[P.id] : null;
        if (P && !peopleOk) { const same = oldStatsSame && o?.sp?.id === P.id; pp = same ? { hand: o.sp.hand, s: o.sp.s, statStatus: o.sp.statStatus } : null; fail("sp", "pitchers", same); }
        // 本場打線（boxscore）
        let lineup;
        if (box[pk] === null) {
          fail("lineup", `boxscore ${pk}`, !!o?.lineup?.slots);
          lineup = o?.lineup ? { ...o.lineup } : { state: "none", firstSeen: S.lu[s]?.at || null, lateAt: null, slots: null }; // 沿用上一版（含「未公布」「來源撤回」）
        } else {
          const slots = slotsOf(box[pk], s); let lu = "none", withdrawnAt = null;
          if (slots) {
            const ids = slots.map(x => x.id).join(",");
            if (!S.lu[s]) { S.lu[s] = { at: nowISO, ids }; ev(pk, "lineup_official", { side: s }); }
            else if (S.lu[s].ids !== ids && status.code === "pre" && S.late[s]?.ids !== ids) { S.late[s] = { at: nowISO, ids }; ev(pk, "lineup_late", { side: s }); }
            lu = S.late[s] ? "late" : "official";
          } else if (o?.lineup?.slots || o?.lineup?.withdrawnAt) { // 上一版有打線，這次來源回應成功但沒有了＝來源撤回
            lu = "withdrawn"; withdrawnAt = o.lineup.withdrawnAt || nowISO;
            if (!o.lineup.withdrawnAt) ev(pk, "lineup_withdrawn", { side: s });
          }
          lineup = { state: lu, firstSeen: S.lu[s]?.at || null, lateAt: S.late[s]?.at || null, slots, ...(withdrawnAt ? { withdrawnAt } : {}) };
        }
        // 本場資料列出的名單（同一份 boxscore 的 players，賽前＝該隊本場可用名單；名單狀態模組用，不另外呼叫）；boxscore 失敗就沿用上一版
        let roster = box[pk] === null ? (o?.roster ?? null)
          : Object.values(box[pk]?.teams?.[s]?.players || {}).map(p => ({ id: p.person?.id, name: p.person?.fullName || String(p.person?.id), pos: p.position?.abbreviation || null })).filter(p => p.id);
        if (!roster?.length) roster = null;
        // 戰績／團隊打擊／團隊投球
        const team = { ...(rec[id] || {}), ops: ops[id] ?? null, era: era[id] ?? null, statsScope,
          statStatus: { rec: rec[id] ? (rec[id].gp === 0 ? "no_record" : "value") : "unavailable",
            ops: wrongScope(hitRows,id) && ops[id] == null ? "scope_unconfirmed" : rec[id]?.gp === 0 ? "no_record" : ops[id] != null ? "value" : "unavailable",
            era: wrongScope(pitRows,id) && era[id] == null ? "scope_unconfirmed" : rec[id]?.gp === 0 ? "no_record" : era[id] != null ? "value" : "unavailable" } };
        if (!st) { const has = oldStatsSame && REC.some(k => o?.[k] != null); if (has) for (const k of REC) team[k] = o[k]; fail("rec", "standings", has); team.statStatus.rec = has ? "stale" : "unavailable"; }
        if (!hit) { team.ops = oldStatsSame ? o?.ops ?? null : null; fail("ops", "team hitting", team.ops != null); team.statStatus.ops = team.ops != null ? "stale" : "unavailable"; }
        if (!pit) { team.era = oldStatsSame ? o?.era ?? null : null; fail("era", "team pitching", team.era != null); team.statStatus.era = team.era != null ? "stale" : "unavailable"; }
        // 上一場打線（參考）
        const pg = prevMap[`${pk}:${s}`], ps = pg && (pg.teams.away.team.id === id ? "away" : "home"), os = ps === "home" ? "away" : "home";
        let prevSlots = pg ? slotsOf(box[pg.gamePk], ps) : null;
        if (pg && box[pg.gamePk] === null) { const same = o?.prev?.pk === pg.gamePk && o.prev.slots; prevSlots = same ? o.prev.slots : null; fail("prev", `boxscore ${pg.gamePk}`, !!same); }
        return { ...minimal(s), ...team,
          sp: P ? { id: P.id, name: P.fullName, hand: pp?.hand || null, s: pp?.s || null, statStatus: pp?.statStatus || "unavailable", statsScope, ...(pp?.sNote ? { sNote: pp.sNote } : {}), firstSeen: S.sp[s]?.at || null } : null,
          lineup: { ...lineup, statsScope }, roster,
          prev: pg ? { pk: pg.gamePk, date: pg.officialDate, gameType: pg.gameType || null, ha: ps === "home" ? "主" : "客", opp: TEAM_ZH[pg.teams[os].team.id] || pg.teams[os].team.name, score: `${pg.teams[ps].score}-${pg.teams[os].score}`, slots: prevSlots } : null,
          ...(Object.keys(failed).length ? { failed } : {}) };
      };
      out[pk] = { ...base, away: side("away"), home: side("home") };
    } catch (e) {
      const msg = String(e.message || e); errors.push({ what: `game ${pk}`, error: msg });
      // 整場組資料出錯：有上一版就沿用並標示，沒有才用最小資料
      const f = P0?.failed?.game;
      out[pk] = P0 ? { ...P0, ...base, errors: [msg], failed: { game: { since: f?.since || nowISO, error: msg, fetchedAt: f ? f.fetchedAt : P0.updatedAt } } }
        : { ...base, errors: [msg], away: minimal("away"), home: minimal("home") };
    }
    const a = out[pk].away.lineup.state, h = out[pk].home.lineup.state;
    // 全場打線狀態：late＞official（兩隊皆官方）＞partial（只有一隊官方）＞none；estimate 保留給日後的初步預估，本版不產生
    const has = x => x === "official" || x === "late"; // withdrawn（來源撤回）算沒有打線
    out[pk].lineup = a === "late" || h === "late" ? "late" : has(a) && has(h) ? "official" : has(a) || has(h) ? "partial" : "none";
  }
  const days = [[today, "today", "今天"], [tomorrow, "tomorrow", "明天"]].map(([date, key, label]) => ({ key, label, date, pks: games.filter(g => twDate(g.gameDate) === date).map(g => g.gamePk) }));
  for (const pk of Object.keys(state.games)) if (Date.parse(state.games[pk].firstSeen) < now - 7 * 864e5) delete state.games[pk]; // state 只留 7 天
  const manifest = { generatedAt: nowISO, generatedAtTW: twStamp(nowISO), source: "MLB Stats API（statsapi.mlb.com）", days: days.map(({ pks, ...d }) => ({ ...d, count: pks.length })), upcoming, errors };
  return { manifest, days, games: out, state, events, errors };
}

// 首頁無賽時的「最近完賽」：本站已存的單場資料（live/data/games）中狀態為已結束的，依表定開賽新到舊取 n 場；只放日期、對戰、比分、單場頁入口
export const recentFinals = (games, n = 10) => [...new Map(games.filter(g => g?.status?.code === "final" && g.away?.score != null && g.home?.score != null).map(g => [g.pk, g])).values()]
  .sort((a, b) => b.startUTC.localeCompare(a.startUTC) || b.pk - a.pk).slice(0, n)
  .map(g => ({ pk: g.pk, twDate: g.twDate, usDate: g.usDate, gameType: g.gameType ?? null, dh: g.dh ?? null,
    away: { ab: g.away.ab, name: g.away.name, score: g.away.score }, home: { ab: g.home.ab, name: g.home.name, score: g.home.score } }));

// 首頁卡用：去掉打線名單，其餘同單場
export const cardOf = g => ({ ...g, away: { ...g.away, lineup: { ...g.away.lineup, slots: null }, roster: null, prev: g.away.prev ? { ...g.away.prev, slots: null, has: !!g.away.prev.slots } : null }, home: { ...g.home, lineup: { ...g.home.lineup, slots: null }, roster: null, prev: g.home.prev ? { ...g.home.prev, slots: null, has: !!g.home.prev.slots } : null } });

export function report({ manifest, days, games, events, errors }) {
  const L = [`# Daily Production 自動報告 ${days[0].date}（台灣）`, "", `產生時間：${manifest.generatedAtTW}（台灣）｜來源：${manifest.source}`, ""];
  for (const d of days) {
    const G = d.pks.map(pk => games[pk]), N = G.length, c = f => G.filter(f).length, sides = G.flatMap(g => [g.away, g.home]);
    L.push(`## ${d.label} ${d.date}：${N} 場`, "", `| 項目 | 分子/分母 |`, `|---|---|`,
      `| 首頁卡＋單場頁資料 | ${N}/${N} |`,
      `| 預計先發：雙方皆公布／只公布一方／皆未公布 | ${c(g => g.away.sp && g.home.sp)}／${c(g => !g.away.sp !== !g.home.sp)}／${c(g => !g.away.sp && !g.home.sp)}（共 ${N}） |`,
      `| 官方打線已確認（隊） | ${sides.filter(s => s.lineup.slots).length}/${2 * N} |`,
      `| 初步預估打線（隊） | 0/${2 * N}（本版未產生） |`,
      `| 上一場官方打線參考（隊） | ${sides.filter(s => s.prev?.slots).length}/${2 * N} |`,
      `| 賽前／進行中／已結束／延期取消暫停 | ${c(g => g.status.code === "pre")}／${c(g => g.status.code === "live")}／${c(g => g.status.code === "final")}／${c(g => ["ppd", "cxl", "susp"].includes(g.status.code))} |`,
      `| 雙重賽場次／開賽時間未定 | ${c(g => g.dh)}／${c(g => g.tbd)} |`, "");
  }
  const kept = Object.values(games).flatMap(g => [g.away, g.home].flatMap(t => Object.entries(t.failed || {}).map(([k, f]) => `- ${g.pk} ${t.ab} ${k}：自 ${twStamp(f.since)} 起抓取失敗${f.fetchedAt ? `，沿用 ${twStamp(f.fetchedAt)} 取得的舊值` : "，沒有舊值可用"}（${f.error}）`)));
  L.push(`## 抓取失敗、沿用舊值的項目（${kept.length}）`, "", ...(kept.length ? kept : ["無"]), "");
  L.push(`## 錯誤（${errors.length}）`, "", ...(errors.length ? errors.map(e => `- ${e.what}：${e.error}`) : ["無"]), "",
    `本次事件：${events.length} 筆（先發變動、官方打線首次出現、臨場異動、狀態變化）`, "",
    `之後 7 天（${manifest.upcoming.from}～${manifest.upcoming.to}）正式賽程：${manifest.upcoming.count} 場${manifest.upcoming.next ? `，最近一場 ${manifest.upcoming.next}` : ""}`, "",
    "未取得（本版不顯示）：初步預估打線、盤口、天氣、主審、傷兵、投手 3A／分項成績。");
  return L.join("\n") + "\n";
}

// ---- Node 執行入口 ----
if (typeof process !== "undefined" && process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const fs = await import("node:fs");
  const OUT = process.argv[2] || ".build", D = `${OUT}/live-data`;
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  const log = [];
  const fetchJson = async url => { for (let i = 0; ; i++) { const t0 = Date.now(); try { const r = await fetch(url); log.push(`${r.status} ${Date.now() - t0}ms ${url}`); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return await r.json(); } catch (e) { if (i >= 2) throw e; await new Promise(r => setTimeout(r, 2000 * (i + 1))); } } };
  fs.mkdirSync(`${D}/dates`, { recursive: true }); fs.mkdirSync(`${D}/games`, { recursive: true });
  try {
    const R = await build({ fetchJson, state: read("data/state.json", { games: {} }), prevGame: pk => read(`live/data/games/${pk}.json`, null) });
    const kept = fs.existsSync("live/data/games") ? fs.readdirSync("live/data/games").filter(f => f.endsWith(".json")).map(f => read(`live/data/games/${f}`, null)) : [];
    R.manifest.recent = recentFinals([...Object.values(R.games), ...kept.filter(g => g && !R.games[g.pk])]);
    fs.writeFileSync(`${D}/manifest.json`, JSON.stringify(R.manifest, null, 1));
    for (const d of R.days) fs.writeFileSync(`${D}/dates/${d.date}.json`, JSON.stringify({ date: d.date, generatedAt: R.manifest.generatedAt, games: d.pks.map(pk => cardOf(R.games[pk])) }));
    for (const g of Object.values(R.games)) fs.writeFileSync(`${D}/games/${g.pk}.json`, JSON.stringify(g));
    fs.writeFileSync(`${OUT}/state.json`, JSON.stringify(R.state, null, 1));
    fs.writeFileSync(`${OUT}/events.jsonl`, R.events.map(e => JSON.stringify(e)).join("\n") + (R.events.length ? "\n" : ""));
    fs.writeFileSync(`${OUT}/report.md`, report(R) + `\n## StatsAPI 請求（${log.length}）\n\n` + log.map(x => `- ${x}`).join("\n") + "\n");
    console.log(R.days.map(d => `${d.date} ${d.pks.length} 場`).join("｜"), `事件 ${R.events.length}｜錯誤 ${R.errors.length}｜請求 ${log.length}`);
  } catch (e) {
    fs.writeFileSync(`${OUT}/report.md`, `# 建置失敗\n\n${e.stack || e}\n\n## StatsAPI 請求（${log.length}）\n\n${log.map(x => `- ${x}`).join("\n")}\n`);
    console.error(e); process.exit(1);
  }
}

