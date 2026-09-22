// 運彩 101 /live/ 每日資料建置：只用 MLB 官方 Stats API（statsapi.mlb.com）
// 用法：node scripts/build-live.mjs   （Node 20+，無外部套件）
// 產出：live/data.json、data/state.json、data/events.jsonl、research/daily-production/auto/<台灣日期>.md

const API = "https://statsapi.mlb.com/api/v1";
const TEAM_ZH = { 109: "響尾蛇", 133: "運動家", 144: "勇士", 110: "金鶯", 111: "紅襪", 112: "小熊", 145: "白襪", 113: "紅人", 114: "守護者", 115: "洛磯", 116: "老虎", 117: "太空人", 118: "皇家", 108: "天使", 119: "道奇", 146: "馬林魚", 158: "釀酒人", 142: "雙城", 121: "大都會", 147: "洋基", 143: "費城人", 134: "海盜", 135: "教士", 137: "巨人", 136: "水手", 138: "紅雀", 139: "光芒", 140: "遊騎兵", 141: "藍鳥", 120: "國民" };
const STATE_ZH = { Scheduled: "已排定", "Pre-Game": "賽前準備", Warmup: "熱身中", "In Progress": "進行中", "Game Over": "已結束", Final: "已結束", "Completed Early": "提前結束", Postponed: "延期", Cancelled: "取消", Suspended: "暫停（待續賽）", Delayed: "延遲", "Delayed Start": "延後開賽" };

const twDate = d => new Date(new Date(d).getTime() + 8 * 36e5).toISOString().slice(0, 10); // UTC+8 日期
const addDays = (ymd, n) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const twTime = d => new Date(new Date(d).getTime() + 8 * 36e5).toISOString().slice(11, 16);
const twStamp = d => { const s = new Date(new Date(d).getTime() + 8 * 36e5).toISOString(); return `${s.slice(5, 10).replace("-", "/")} ${s.slice(11, 16)}`; };
const localTime = (d, tz) => { try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }).format(new Date(d)); } catch { return null; } };

function statusOf(g) {
  const s = g.status || {}, det = s.detailedState || "";
  let code = { Preview: "pre", Live: "live", Final: "final" }[s.abstractGameState] || "pre";
  if (/Postponed/i.test(det)) code = "ppd"; else if (/Cancel/i.test(det)) code = "cxl"; else if (/Suspended/i.test(det)) code = "susp";
  const base = Object.keys(STATE_ZH).find(k => det.startsWith(k));
  return { code, text: base ? STATE_ZH[base] + (det.length > base.length ? `（${det}）` : "") : det, raw: det, reason: s.reason || null };
}

export async function build({ fetchJson, now = new Date(), state = { games: {} } }) {
  const today = twDate(now), tomorrow = addDays(today, 1), nowISO = now.toISOString();
  const events = [];
  const ev = (pk, type, detail) => events.push({ at: nowISO, pk, type, ...detail });

  // 1) 賽程：台灣「今天」最早可對應美國前一天，「明天」最晚對應美國當天；往前多抓 12 天找上一場
  const sched = await fetchJson(`${API}/schedule?sportId=1&startDate=${addDays(today, -12)}&endDate=${tomorrow}&hydrate=probablePitcher,linescore,venue(timezone),team`);
  const all = sched.dates.flatMap(d => d.games.map(g => ({ ...g, _date: d.date })));
  const byPk = new Map();
  for (const g of all) {
    const d = twDate(g.gameDate);
    if (d !== today && d !== tomorrow) continue;
    const prev = byPk.get(g.gamePk); // 同一 gamePk 出現在兩個日期（延期改期）時，保留非延期那筆
    if (!prev || (statusOf(prev).code === "ppd" && statusOf(g).code !== "ppd")) byPk.set(g.gamePk, g);
  }
  const games = [...byPk.values()].sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk);
  const finals = all.filter(g => g.status?.abstractGameState === "Final" && !/Postponed|Cancel/i.test(g.status.detailedState));

  // 2) 戰績、團隊打擊／投球
  const [st, hit, pit] = await Promise.all([
    fetchJson(`${API}/standings?leagueId=103,104&season=${today.slice(0, 4)}&standingsTypes=regularSeason`),
    fetchJson(`${API}/teams/stats?season=${today.slice(0, 4)}&group=hitting&stats=season&sportIds=1`),
    fetchJson(`${API}/teams/stats?season=${today.slice(0, 4)}&group=pitching&stats=season&sportIds=1`)]);
  const rec = {};
  for (const r of st.records || []) for (const t of r.teamRecords) {
    const sp = Object.fromEntries((t.records?.splitRecords || []).map(x => [x.type, `${x.wins}-${x.losses}`]));
    rec[t.team.id] = { rec: `${t.wins}-${t.losses}`, pct: t.winningPercentage, home: sp.home || null, road: sp.away || null, l10: sp.lastTen || null, streak: t.streak?.streakCode || null, rs: t.runsScored, ra: t.runsAllowed, gp: t.gamesPlayed };
  }
  const ops = Object.fromEntries((hit.stats?.[0]?.splits || []).map(s => [s.team.id, s.stat.ops]));
  const era = Object.fromEntries((pit.stats?.[0]?.splits || []).map(s => [s.team.id, s.stat.era]));

  // 3) 先發投手：慣用手＋本季大聯盟成績（被交易者取不分隊合計）
  const spIds = [...new Set(games.flatMap(g => ["away", "home"].map(s => g.teams[s].probablePitcher?.id).filter(Boolean)))];
  const ppl = {};
  if (spIds.length) {
    const r = await fetchJson(`${API}/people?personIds=${spIds.join(",")}&hydrate=stats(group=[pitching],type=[season],season=${today.slice(0, 4)})`);
    for (const p of r.people || []) {
      const sp = p.stats?.[0]?.splits || [], s = (sp.find(x => !x.team) || sp[0])?.stat;
      ppl[p.id] = { hand: p.pitchHand?.code || null, s: s ? { wl: `${s.wins}-${s.losses}`, era: s.era, ip: s.inningsPitched, gs: s.gamesStarted, whip: s.whip, so: s.strikeOuts, bb: s.baseOnBalls } : null };
    }
  }

  // 4) 打線：本場 boxscore battingOrder（官方）＋各隊上一場已完賽 boxscore（參考）
  const prevOf = (teamId, beforeISO, pk) => finals.filter(g => g.gamePk !== pk && g.gameDate < beforeISO && (g.teams.away.team.id === teamId || g.teams.home.team.id === teamId)).sort((a, b) => b.gameDate.localeCompare(a.gameDate))[0];
  const need = new Set(games.map(g => g.gamePk));
  const prevMap = {};
  for (const g of games) for (const s of ["away", "home"]) { const p = prevOf(g.teams[s].team.id, g.gameDate, g.gamePk); prevMap[`${g.gamePk}:${s}`] = p || null; if (p) need.add(p.gamePk); }
  const box = {};
  const pks = [...need];
  for (let i = 0; i < pks.length; i += 6) await Promise.all(pks.slice(i, i + 6).map(async pk => { try { box[pk] = await fetchJson(`${API}/game/${pk}/boxscore`); } catch (e) { box[pk] = null; } }));
  const slotsOf = (bx, side) => {
    const t = bx?.teams?.[side]; if (!t?.battingOrder?.length) return null;
    return t.battingOrder.map((id, i) => { const p = t.players["ID" + id] || {}, b = p.seasonStats?.batting || {};
      return { n: i + 1, id, name: p.person?.fullName || String(id), pos: p.allPositions?.[0]?.abbreviation || p.position?.abbreviation || null, avg: b.avg ?? null, ops: b.ops ?? null }; });
  };

  // 5) 組資料＋首次看到時間
  const out = {};
  for (const g of games) {
    const pk = g.gamePk, S = (state.games[pk] ||= { firstSeen: nowISO, sp: {}, lu: {}, late: {} });
    const status = statusOf(g);
    if (S.status && S.status !== status.raw) ev(pk, "status", { from: S.status, to: status.raw });
    S.status = status.raw;
    const side = s => {
      const t = g.teams[s], id = t.team.id, P = t.probablePitcher;
      if ((S.sp[s]?.id || null) !== (P?.id || null)) { if (S.sp[s] || P) ev(pk, "sp", { side: s, from: S.sp[s]?.name || null, to: P?.fullName || null }); S.sp[s] = P ? { id: P.id, name: P.fullName, at: nowISO } : null; }
      let slots = slotsOf(box[pk], s), lu = "none";
      if (slots) {
        const ids = slots.map(x => x.id).join(",");
        if (!S.lu[s]) { S.lu[s] = { at: nowISO, ids }; ev(pk, "lineup_official", { side: s }); }
        else if (S.lu[s].ids !== ids && status.code === "pre" && S.late[s]?.ids !== ids) { S.late[s] = { at: nowISO, ids }; ev(pk, "lineup_late", { side: s }); }
        lu = S.late[s] ? "late" : "official";
      }
      const pg = prevMap[`${pk}:${s}`], pside = pg && (pg.teams.away.team.id === id ? "away" : "home");
      return { id, ab: t.team.abbreviation || null, name: TEAM_ZH[id] || t.team.name, en: t.team.name, ...(rec[id] || {}), ops: ops[id] || null, era: era[id] || null, score: t.score ?? null,
        sp: P ? { id: P.id, name: P.fullName, hand: ppl[P.id]?.hand || null, s: ppl[P.id]?.s || null, firstSeen: S.sp[s]?.at || null } : null,
        lineup: { state: lu, firstSeen: S.lu[s]?.at || null, lateAt: S.late[s]?.at || null, slots },
        prev: pg ? { pk: pg.gamePk, date: pg.officialDate, ha: pside === "home" ? "主" : "客", opp: TEAM_ZH[pg.teams[pside === "home" ? "away" : "home"].team.id] || "", score: `${pg.teams[pside].score}-${pg.teams[pside === "home" ? "away" : "home"].score}`, slots: slotsOf(box[pg.gamePk], pside) } : null };
    };
    const away = side("away"), home = side("home");
    const tz = g.venue?.timezone?.id || null, tbd = !!g.status?.startTimeTBD;
    out[pk] = { pk, twDate: twDate(g.gameDate), usDate: g.officialDate, startUTC: g.gameDate, tbd, twTime: tbd ? null : twTime(g.gameDate), localTime: tbd ? null : localTime(g.gameDate, tz), tz,
      venue: g.venue?.name || null, status, dh: g.doubleHeader && g.doubleHeader !== "N" ? `G${g.gameNumber}` : null,
      rescheduledFrom: g.rescheduledFrom || null, rescheduleDate: g.rescheduleDate || null, inning: g.linescore?.currentInningOrdinal || null, inningHalf: g.linescore?.inningHalf || null,
      firstSeen: S.firstSeen, away, home };
  }
  const days = [[today, "today", "今天"], [tomorrow, "tomorrow", "明天"]].map(([date, key, label]) => ({ key, label, date, pks: games.filter(g => twDate(g.gameDate) === date).map(g => g.gamePk) }));
  // state 只保留 7 天內出現過的比賽
  for (const pk of Object.keys(state.games)) if (Date.parse(state.games[pk].firstSeen) < now - 7 * 864e5) delete state.games[pk];
  return { live: { generatedAt: nowISO, generatedAtTW: twStamp(nowISO), source: "MLB Stats API（statsapi.mlb.com）", days, games: out }, state, events };
}

export function report(live, events) {
  const L = [`# Daily Production 自動報告 ${live.days[0].date}（台灣）`, "", `最後更新：${live.generatedAtTW}（台灣）｜來源：${live.source}`, ""];
  for (const d of live.days) {
    const G = d.pks.map(pk => live.games[pk]), N = G.length, c = f => G.filter(f).length;
    const sides = G.flatMap(g => [g.away, g.home]);
    L.push(`## ${d.label} ${d.date}：${N} 場`, "",
      `| 項目 | 分子/分母 |`, `|---|---|`,
      `| 首頁卡＋單場頁 | ${N}/${N} |`,
      `| 雙方預計先發皆公布 | ${c(g => g.away.sp && g.home.sp)}/${N} |`,
      `| 官方打線已確認（隊） | ${sides.filter(s => s.lineup.slots).length}/${2 * N} |`,
      `| 上一場官方打線（隊） | ${sides.filter(s => s.prev?.slots).length}/${2 * N} |`,
      `| 賽前／進行中／已結束／延期取消暫停 | ${c(g => g.status.code === "pre")}／${c(g => g.status.code === "live")}／${c(g => g.status.code === "final")}／${c(g => ["ppd", "cxl", "susp"].includes(g.status.code))} |`,
      `| 雙重賽場次 | ${c(g => g.dh)} |`, `| 開賽時間未定（TBD） | ${c(g => g.tbd)} |`, "");
  }
  L.push(`本次執行事件：${events.length} 筆（見 data/events.jsonl）`, "", "未納入（尚未取得或未授權）：預估打線、盤口、天氣、主審、傷兵、牛棚負荷。");
  return L.join("\n") + "\n";
}

// ---- Node 執行入口 ----
if (typeof process !== "undefined" && process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const fs = await import("node:fs");
  const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  const fetchJson = async url => { for (let i = 0; ; i++) { try { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return await r.json(); } catch (e) { if (i >= 2) throw e; await new Promise(r => setTimeout(r, 2000 * (i + 1))); } } };
  const { live, state, events } = await build({ fetchJson, state: read("data/state.json", { games: {} }) });
  fs.mkdirSync("data", { recursive: true }); fs.mkdirSync("research/daily-production/auto", { recursive: true });
  fs.writeFileSync("live/data.json", JSON.stringify(live));
  fs.writeFileSync("data/state.json", JSON.stringify(state, null, 1));
  if (events.length) fs.appendFileSync("data/events.jsonl", events.map(e => JSON.stringify(e)).join("\n") + "\n");
  fs.writeFileSync(`research/daily-production/auto/${live.days[0].date}.md`, report(live, events));
  console.log(live.days.map(d => `${d.date} ${d.pks.length} 場`).join("｜"), `事件 ${events.length}`);
}
