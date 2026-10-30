// 運彩 101 足球試作：每次從來源重建，沒有跨次球賽資料庫或舊值回退。
// node scripts/build-football.mjs [--event 401878761] [--out football/data]
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const LOTTERY = 'https://www-talo-ssb-pr.sportslottery.com.tw/daily-coupons';
const LEAGUES = [
  { id: 'eng.1', label: '英超' },
  { id: 'uefa.europa', label: '歐聯' },
  { id: 'eng.league_cup', label: '聯賽盃' },
];
const TZ = 'Asia/Taipei';
const args = process.argv.slice(2);
const arg = key => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1]; };
const outDir = path.resolve(arg('--out') || 'football/data');
const requestedEvent = arg('--event');
const now = new Date();
const generatedAt = now.toISOString();
const errors = [];
const sourceChecks = [];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const plusDays = (date, days) => new Date(date.getTime() + days * 86400000);
const ymdUTC = date => date.toISOString().slice(0, 10).replaceAll('-', '');
const twDay = iso => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const seasonOf = iso => { const d = new Date(iso); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };
const gameKey = (league, id) => `${league}:${id}`;

async function getJson(url, label, required = false) {
  const started = new Date().toISOString();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      sourceChecks.push({ label, url, checkedAt: started, status: 'ok' });
      return json;
    } catch (e) {
      if (attempt === 0) { await sleep(500); continue; }
      const message = String(e?.message || e);
      sourceChecks.push({ label, url, checkedAt: started, status: 'failed', error: message });
      errors.push({ label, url, message });
      if (required) throw new Error(`${label}: ${message}`);
      return null;
    }
  }
}

const compOf = event => event?.competitions?.[0] || null;
const sideOf = (event, side) => compOf(event)?.competitors?.find(c => c.homeAway === side) || null;
const teamOf = c => ({ id: String(c?.team?.id || c?.id || ''), name: c?.team?.displayName || c?.team?.name || c?.name || '' });
const scoreOf = c => Number.isFinite(Number(c?.score?.value)) ? Number(c.score.value) : null;
const finished = e => compOf(e)?.status?.type?.state === 'post' && compOf(e)?.status?.type?.completed === true;
const eventUrl = (league, id) => `https://www.espn.com/soccer/match/_/gameId/${id}`;

function normalEvent(e, league) {
  const home = sideOf(e, 'home'), away = sideOf(e, 'away');
  if (!home || !away || !Number.isFinite(Date.parse(e.date))) return null;
  return {
    id: String(e.id), key: gameKey(league, e.id), league,
    leagueLabel: LEAGUES.find(x => x.id === league)?.label || league,
    kickoffUTC: e.date, twDate: twDay(e.date),
    home: teamOf(home), away: teamOf(away),
    score: finished(e) ? { home: scoreOf(home), away: scoreOf(away) } : null,
    status: compOf(e)?.status?.type?.name || 'unknown',
    finished: finished(e), source: eventUrl(league, e.id),
  };
}

function pairForTeam(e, id) {
  const ownHome = e.home.id === id;
  return {
    ...e,
    side: ownHome ? 'home' : 'away',
    opponent: ownHome ? e.away : e.home,
    goalsFor: e.score ? (ownHome ? e.score.home : e.score.away) : null,
    goalsAgainst: e.score ? (ownHome ? e.score.away : e.score.home) : null,
    totalGoals: e.score ? e.score.home + e.score.away : null,
  };
}

function eventScoreText(text, home, away) {
  const normalized = String(text || '').replace(/\band\b/gi, '&');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = normalized.match(new RegExp(`${esc(home.replace(/\band\b/gi, '&'))}\\s+(\\d+),\\s+${esc(away.replace(/\band\b/gi, '&'))}\\s+(\\d+)`, 'i'));
  return match ? { home: Number(match[1]), away: Number(match[2]) } : null;
}

function compactSummary(j, game) {
  if (!j) return { status: 'not_acquired', rosters: null, events: [], source: game.source };
  const rosters = {};
  const stat = (p, name) => {
    const value = p.stats?.find(s => s.name === name)?.value;
    return value === undefined || value === null || !Number.isFinite(Number(value)) ? null : Number(value);
  };
  for (const side of j.rosters || []) {
    const teamId = String(side.team?.id || '');
    if (!teamId) continue;
    rosters[teamId] = (side.roster || []).map(p => ({
      id: String(p.athlete?.id || ''), name: p.athlete?.displayName || '',
      role: p.starter ? 'starter' : p.subbedIn ? 'sub_on' : 'bench_unused',
      subbedOut: !!p.subbedOut,
      goals: stat(p, 'totalGoals'),
      assists: stat(p, 'goalAssists'),
    })).filter(p => p.id && p.name);
  }
  let score = { home: 0, away: 0 };
  let scoreKnown = true;
  const events = [];
  for (const [index, e] of (j.keyEvents || []).entries()) {
    const type = e.type?.type || '';
    if (type === 'goal' || e.scoringPlay) {
      const observed = eventScoreText(e.text, game.home.name, game.away.name);
      if (observed) score = observed; else scoreKnown = false;
      events.push({ index, type: 'goal', minute: e.clock?.displayValue || null,
        text: e.text || '', team: e.team?.displayName || null,
        scoreAfter: scoreKnown ? { ...score } : null });
    } else if (type === 'substitution') {
      events.push({ index, type: 'substitution', minute: e.clock?.displayValue || null,
        text: e.text || '', team: e.team?.displayName || null,
        in: e.participants?.[0]?.athlete ? { id: String(e.participants[0].athlete.id), name: e.participants[0].athlete.displayName } : null,
        out: e.participants?.[1]?.athlete ? { id: String(e.participants[1].athlete.id), name: e.participants[1].athlete.displayName } : null,
        scoreAt: scoreKnown ? { ...score } : null });
    } else if (/red-card|second-yellow/.test(type)) {
      events.push({ index, type: 'red_card', minute: e.clock?.displayValue || null,
        text: e.text || '', team: e.team?.displayName || null,
        scoreAt: scoreKnown ? { ...score } : null });
    }
  }
  const completeRosters = Object.fromEntries(Object.entries(rosters).map(([id, list]) => [id, list.filter(p => p.role === 'starter').length === 11]));
  return { status: 'acquired', rosters, completeRosters, events, source: game.source };
}

function makePairs(games, target, teamId, details) {
  const ordered = [...games].sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));
  const list = [...ordered, target];
  return list.slice(1).map((right, index) => {
    const left = list[index];
    const a = details[left.key], b = details[right.key];
    const starters = d => d?.rosters?.[teamId]?.filter(p => p.role === 'starter').map(p => p.id) || [];
    const sa = starters(a), sb = starters(b);
    const continuation = a?.completeRosters?.[teamId] && b?.completeRosters?.[teamId]
      ? sa.filter(id => sb.includes(id)).length : null;
    return { from: left.key, to: right.key,
      kickoffGapMinutes: Math.round((Date.parse(right.kickoffUTC) - Date.parse(left.kickoffUTC)) / 60000),
      continuation, status: right.key === target.key ? 'target_lineup_unannounced' : continuation === null ? 'not_acquired' : 'acquired' };
  });
}

function makePlayers(games, teamId, details) {
  const ordered = [...games].sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));
  const known = new Map();
  for (const g of ordered) for (const p of details[g.key]?.rosters?.[teamId] || []) known.set(p.id, p.name);
  return [...known].map(([id, name]) => ({ id, name,
    games: ordered.map(g => {
      const detail = details[g.key];
      const p = detail?.rosters?.[teamId]?.find(p => p.id === id);
      return { key: g.key,
        role: p?.role || (detail?.completeRosters?.[teamId] ? 'not_listed' : 'not_acquired'),
        goals: p?.goals ?? null, assists: p?.assists ?? null };
    }),
  })).sort((a, b) => {
    const aStarts = a.games.filter(g => g.role === 'starter').length;
    const bStarts = b.games.filter(g => g.role === 'starter').length;
    return bStarts - aStarts || a.name.localeCompare(b.name);
  });
}

async function inspectLottery() {
  const checkedAt = new Date().toISOString();
  try {
    const r = await fetch(LOTTERY, { signal: AbortSignal.timeout(9000), headers: { Accept: 'text/html' } });
    return { status: 'not_acquired', checkedAt, source: LOTTERY, httpStatus: r.status,
      reason: r.status === 403 ? '官方網站對此伺服器請求回 HTTP 403；本次未取得盤口。' : `未建立受支援的機器取數路徑（HTTP ${r.status}）。`,
      markets: null, sourceUpdatedAt: null };
  } catch (e) {
    return { status: 'not_acquired', checkedAt, source: LOTTERY, httpStatus: null,
      reason: `官方網站請求失敗：${String(e?.message || e)}`, markets: null, sourceUpdatedAt: null };
  }
}

async function main() {
  // 為台灣今天與明天跨 UTC 日期，多查前一天；另看未來十天供「下一個英超日」。
  const boardDays = Array.from({ length: 11 }, (_, i) => ymdUTC(plusDays(now, i - 1)));
  const boards = await Promise.all(boardDays.map(d => getJson(`${API}/eng.1/scoreboard?dates=${d}`, `英超賽程 ${d}`, true)));
  const fixtures = [...new Map(boards.flatMap(b => b.events || []).map(e => [String(e.id), normalEvent(e, 'eng.1')]).filter(([, e]) => e)).values()]
    .sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));
  const future = fixtures.filter(g => Date.parse(g.kickoffUTC) > now.getTime() && !g.finished);
  const target = requestedEvent ? fixtures.find(g => g.id === requestedEvent) : future[0];
  if (!target) throw new Error(`找不到目標未開賽場次 ${requestedEvent || '(next)'}`);
  if (Date.parse(target.kickoffUTC) <= now.getTime()) throw new Error(`目標場已開球：${target.id}`);
  const today = twDay(generatedAt), tomorrow = twDay(plusDays(now, 1));
  const overview = { generatedAt, scope: '英超', dates: [today, tomorrow], target: target.key, targetGame: target,
    games: future.filter(g => g.twDate === today || g.twDate === tomorrow),
    nextKnownDate: future[0]?.twDate || null,
    source: `${API}/eng.1/scoreboard`, coverage: '台灣今天、明天；無賽事時顯示下一個已知英超日' };

  const teamData = {};
  const gameMap = new Map();
  for (const team of [target.away, target.home]) {
    const teamGames = [];
    for (const league of LEAGUES) {
      const season = seasonOf(target.kickoffUTC);
      const url = `${API}/${league.id}/teams/${team.id}/schedule?season=${season}`;
      const j = await getJson(url, `${team.name} ${league.label}賽程`);
      for (const raw of j?.events || []) {
        const g = normalEvent(raw, league.id);
        if (g && g.finished && Date.parse(g.kickoffUTC) < Date.parse(target.kickoffUTC)) teamGames.push(g);
      }
    }
    const unique = [...new Map(teamGames.map(g => [g.key, g])).values()];
    const leagueFive = unique.filter(g => g.league === 'eng.1').sort((a, b) => b.kickoffUTC.localeCompare(a.kickoffUTC)).slice(0, 5);
    const start14 = Date.parse(target.kickoffUTC) - 14 * 86400000;
    const recent14 = unique.filter(g => Date.parse(g.kickoffUTC) >= start14)
      .sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));
    for (const g of [...leagueFive, ...recent14]) gameMap.set(g.key, g);
    teamData[team.id] = { team, leagueFive: leagueFive.map(g => g.key), recent14: recent14.map(g => g.key),
      scheduleStatus: LEAGUES.map(l => sourceChecks.find(c => c.label === `${team.name} ${l.label}賽程`)) };
  }
  const details = {};
  const games = Object.fromEntries([...gameMap].map(([key, g]) => [key, g]));
  games[target.key] = target;
  const entries = [...gameMap.values()];
  // 幾個 summary 並行，避免對來源一次丟太多請求。
  for (let i = 0; i < entries.length; i += 4) {
    const batch = entries.slice(i, i + 4);
    await Promise.all(batch.map(async g => {
      const url = `${API}/${g.league}/summary?event=${g.id}`;
      const j = await getJson(url, `${g.leagueLabel} ${g.id} 名單與事件`);
      details[g.key] = compactSummary(j, g);
    }));
  }
  details[target.key] = { status: 'official_lineup_unannounced', rosters: null, events: [], source: target.source };
  for (const teamId of [target.away.id, target.home.id]) {
    const t = teamData[teamId];
    const recent = t.recent14.map(k => games[k]);
    t.pairs = makePairs(recent, target, teamId, details);
    t.players = makePlayers(recent, teamId, details);
    t.leagueFive = t.leagueFive.map(k => pairForTeam(games[k], teamId));
    t.recent14 = t.recent14.map(k => pairForTeam(games[k], teamId));
    t.goals = { for: t.leagueFive.reduce((n, g) => n + (g.goalsFor || 0), 0),
      against: t.leagueFive.reduce((n, g) => n + (g.goalsAgainst || 0), 0),
      games: t.leagueFive.length };
  }
  const lottery = await inspectLottery();
  const detail = { generatedAt, target, lottery, teamData,
    games, details, errors, sourceChecks,
    limitations: ['ESPN 網頁資料端點未提供公開穩定性承諾；此為研究試作。', 'xG 本次未取得。', '14 日跨賽事僅涵蓋英超、歐聯與英格蘭聯賽盃。', '本場正式名單公布前只顯示近期用人，不推測先發。'] };
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'overview.json'), JSON.stringify(overview, null, 2) + '\n');
  await fs.writeFile(path.join(outDir, 'game.json'), JSON.stringify(detail, null, 2) + '\n');
  const report = { generatedAt, target: `${target.away.name} @ ${target.home.name}`, targetId: target.id,
    targetKickoffUTC: target.kickoffUTC, overviewGames: overview.games.length,
    teams: Object.values(teamData).map(t => ({ name: t.team.name, leagueFive: t.leagueFive.length,
      recent14: t.recent14.length, players: t.players.length,
      pairsWithContinuation: t.pairs.filter(p => p.continuation !== null).length,
      pairs: t.pairs.length })), lottery: { status: lottery.status, httpStatus: lottery.httpStatus,
      checkedAt: lottery.checkedAt }, sourceErrors: errors.length };
  await fs.writeFile(path.join(outDir, 'run-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

main().catch(e => { console.error(`build-football failed: ${String(e?.stack || e)}`); process.exitCode = 1; });
