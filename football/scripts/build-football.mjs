// 運彩 101 足球試作：每次從來源重建，沒有跨次球賽資料庫或舊值回退。
// node scripts/build-football.mjs [--event 401878761] [--out football/data]
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const LOTTERY = 'https://www-talo-ssb-pr.sportslottery.com.tw/daily-coupons';
const LEAGUES = [
  { id: 'eng.1', label: '英超' },
  { id: 'uefa.champions', label: '歐冠' },
  { id: 'uefa.europa', label: '歐聯' },
  { id: 'uefa.europa.conf', label: '歐協' },
  { id: 'eng.fa', label: '足總盃' },
  { id: 'eng.league_cup', label: '聯賽盃' },
];
const TZ = 'Asia/Taipei';
const args = process.argv.slice(2);
const arg = key => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1]; };
const outDir = path.resolve(arg('--out') || 'football/data');
const requestedEvent = arg('--event');
const oddsFile = arg('--odds-file');
const now = new Date();
const generatedAt = now.toISOString();
const errors = [];
const sourceChecks = [];
const responseCache = new Map();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const plusDays = (date, days) => new Date(date.getTime() + days * 86400000);
const ymdUTC = date => date.toISOString().slice(0, 10).replaceAll('-', '');
const twDay = iso => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const seasonOf = iso => { const d = new Date(iso); return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1; };
const gameKey = (league, id) => `${league}:${id}`;

async function getJson(url, label, required = false) {
  if (responseCache.has(url)) return responseCache.get(url);
  const started = new Date().toISOString();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      sourceChecks.push({ label, url, checkedAt: started, status: 'ok' });
      responseCache.set(url, json);
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
const scoreOf = c => {
  const value = c?.score?.value;
  return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
};
const finished = e => compOf(e)?.status?.type?.state === 'post' && compOf(e)?.status?.type?.completed === true;
const eventUrl = (league, id) => `https://www.espn.com/soccer/match/_/gameId/${id}`;

function normalEvent(e, league) {
  const home = sideOf(e, 'home'), away = sideOf(e, 'away');
  if (!home || !away || !Number.isFinite(Date.parse(e.date))) return null;
  const homeScore = scoreOf(home), awayScore = scoreOf(away);
  const rawStatus = compOf(e)?.status?.type || {};
  const statusName = rawStatus.name || 'unknown';
  const phase = /POSTPONED|CANCELED|CANCELLED/i.test(statusName) ? 'postponed'
    : rawStatus.state === 'post' ? 'final' : rawStatus.state === 'in' ? 'live' : 'pre';
  return {
    id: String(e.id), key: gameKey(league, e.id), league,
    leagueLabel: LEAGUES.find(x => x.id === league)?.label || league,
    kickoffUTC: e.date, twDate: twDay(e.date),
    home: teamOf(home), away: teamOf(away),
    score: finished(e) && homeScore !== null && awayScore !== null ? { home: homeScore, away: awayScore } : null,
    status: statusName, phase, statusDetail: rawStatus.detail || null,
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
    totalGoals: e.score?.home !== null && e.score?.home !== undefined && e.score?.away !== null && e.score?.away !== undefined
      ? e.score.home + e.score.away : null,
  };
}

function eventScoreText(text, home, away) {
  const normalized = String(text || '').replace(/\band\b/gi, '&');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = normalized.match(new RegExp(`${esc(home.replace(/\band\b/gi, '&'))}\\s+(\\d+),\\s+${esc(away.replace(/\band\b/gi, '&'))}\\s+(\\d+)`, 'i'));
  return match ? { home: Number(match[1]), away: Number(match[2]) } : null;
}

function compactSummary(j, game) {
  if (!j) return { status: 'not_acquired', rosters: null, rosterPresence: {}, completeRosters: {},
    events: [], source: game.source };
  const rosters = {};
  const rosterPresence = {};
  const stat = (p, name) => {
    const value = p.stats?.find(s => s.name === name)?.value;
    return value === undefined || value === null || !Number.isFinite(Number(value)) ? null : Number(value);
  };
  for (const side of j.rosters || []) {
    const teamId = String(side.team?.id || '');
    if (!teamId) continue;
    rosterPresence[teamId] = Array.isArray(side.roster);
    if (!rosterPresence[teamId]) continue;
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
  // 只代表來源列出 11 位先發；不能由此推斷替補名單已完整。
  const completeRosters = Object.fromEntries(Object.entries(rosters).map(([id, list]) => [id, list.filter(p => p.role === 'starter').length === 11]));
  return { status: 'acquired', rosters, rosterPresence, completeRosters,
    benchCompleteness: 'unverified', events, source: game.source };
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
      continuation, status: right.key === target.key && b?.status === 'not_acquired' ? 'target_lineup_fetch_failed'
        : right.key === target.key && !b?.completeRosters?.[teamId] ? 'target_lineup_unannounced'
          : continuation === null ? 'not_acquired' : 'acquired' };
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
      const onEvent = detail?.events?.find(e => e.type === 'substitution' && e.in?.id === id);
      const offEvent = detail?.events?.find(e => e.type === 'substitution' && e.out?.id === id);
      return { key: g.key,
        role: p?.role || (detail?.rosterPresence?.[teamId] && detail?.completeRosters?.[teamId] ? 'not_listed' : 'not_acquired'),
        subOnMinute: onEvent?.minute || null, subOffMinute: offEvent?.minute || null,
        goals: p?.goals ?? null, assists: p?.assists ?? null };
    }),
  })).sort((a, b) => {
    const aStarts = a.games.filter(g => g.role === 'starter').length;
    const bStarts = b.games.filter(g => g.role === 'starter').length;
    return bStarts - aStarts || a.name.localeCompare(b.name);
  });
}

async function loadOddsSnapshots() {
  const file = path.resolve(oddsFile || 'football/official-odds-snapshots.json');
  let raw;
  try { raw = await fs.readFile(file, 'utf8'); }
  catch (error) {
    if (!oddsFile && error?.code === 'ENOENT') return {};
    throw error;
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('台彩快照必須是以英超賽事 ID 為鍵的物件');
  return parsed;
}

function oddsForTarget(target, snapshots) {
  const snapshot = snapshots[target.id];
  const empty = { status: 'not_acquired', capturedAt: null, source: LOTTERY,
    reason: '本場尚未取得已配對的台彩官方賠率快照。', lotteryEventId: null, markets: null };
  if (!snapshot) return empty;
  const sameTeams = String(snapshot.matchedHomeId) === target.home.id && String(snapshot.matchedAwayId) === target.away.id;
  const sameKickoff = Math.abs(Date.parse(snapshot.kickoffUTC) - Date.parse(target.kickoffUTC)) <= 3 * 3600000;
  const sourcePage = snapshot.sourcePage || LOTTERY;
  const officialPage = /^https:\/\/www-talo-ssb-pr\.sportslottery\.com\.tw\//.test(sourcePage);
  const marketsValid = Array.isArray(snapshot.markets) && snapshot.markets.length > 0
    && snapshot.markets.every(m => typeof m.play === 'string' && m.play.length > 0
      && Array.isArray(m.odds) && m.odds.length > 0
      && m.odds.every(o => typeof o.choice === 'string' && o.choice.length > 0 && Number(o.price) > 1));
  const valid = String(snapshot.eventId) === target.id && sameTeams && sameKickoff
    && /^\d+$/.test(String(snapshot.lotteryEventId || '')) && Number.isFinite(Date.parse(snapshot.capturedAt))
    && snapshot.source === LOTTERY && officialPage && marketsValid;
  if (!valid) return { ...empty, status: 'match_failed', reason: '快照的賽事 ID、主客隊、開球時間或必要欄位與本場不符；未顯示賠率。' };
  return { status: 'snapshot', lotteryEventId: String(snapshot.lotteryEventId),
    capturedAt: snapshot.capturedAt, source: LOTTERY, sourcePage,
    officialTeams: snapshot.officialTeams || null, markets: snapshot.markets,
    matchedHomeId: target.home.id, matchedAwayId: target.away.id, eventId: target.id };
}

function deriveLineupStatus(target, detail) {
  if (detail.status === 'not_acquired') return 'fetch_failed';
  if ([target.home.id, target.away.id].every(id => detail.completeRosters?.[id])) return 'source_listed';
  return Object.values(detail.rosterPresence || {}).some(Boolean) ? 'partial' : 'unannounced';
}

async function main() {
  // 跨 UTC 多查一天；總覽顯示台灣昨天至後天，涵蓋開賽與賽後狀態。
  const boardDays = Array.from({ length: 11 }, (_, i) => ymdUTC(plusDays(now, i - 1)));
  const boards = await Promise.all(boardDays.map(d => getJson(`${API}/eng.1/scoreboard?dates=${d}`, `英超賽程 ${d}`, true)));
  const fixtures = [...new Map(boards.flatMap(b => b.events || []).map(e => [String(e.id), normalEvent(e, 'eng.1')]).filter(([, e]) => e)).values()]
    .sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));
  const today = twDay(generatedAt);
  const displayDates = [-1, 0, 1, 2].map(n => twDay(plusDays(now, n)));
  let selected = fixtures.filter(g => displayDates.includes(g.twDate));
  if (requestedEvent) {
    const explicit = fixtures.find(g => g.id === requestedEvent);
    if (!explicit) throw new Error(`找不到指定英超賽事 ${requestedEvent}`);
    if (!selected.some(g => g.id === explicit.id)) selected.push(explicit);
  }
  if (!selected.length) {
    const next = fixtures.find(g => Date.parse(g.kickoffUTC) > now.getTime());
    if (next) selected = fixtures.filter(g => g.twDate === next.twDate);
  }
  selected.sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));
  if (!selected.length) throw new Error('目前賽程來源未提供可顯示的英超場次');
  const expiresAt = new Date(now.getTime() + 18 * 3600000).toISOString();
  const snapshots = await loadOddsSnapshots();
  const overview = { generatedAt, expiresAt, scope: '英超', dates: [...new Set(selected.map(g => g.twDate))],
    games: selected.map(g => ({ ...g, dataStatus: 'pending' })),
    source: `${API}/eng.1/scoreboard`, coverage: '台灣昨天至後天的已知英超場次；空窗時顯示下一個賽事日' };
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(path.join(outDir, 'games'), { recursive: true });
  const gameReports = [];
  for (const target of selected) {
    const teamData = {}, gameMap = new Map(), gameErrorsStart = errors.length;
    for (const team of [target.away, target.home]) {
      const teamGames = [];
      for (const league of LEAGUES) {
        const url = `${API}/${league.id}/teams/${team.id}/schedule?season=${seasonOf(target.kickoffUTC)}`;
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
        scheduleStatus: LEAGUES.map(l => ({ league: l.id,
          status: responseCache.has(`${API}/${l.id}/teams/${team.id}/schedule?season=${seasonOf(target.kickoffUTC)}`) ? 'acquired' : 'not_acquired' })) };
    }
    const details = {}, games = Object.fromEntries([...gameMap]);
    games[target.key] = target;
    const entries = [...gameMap.values(), target];
    for (let i = 0; i < entries.length; i += 4) {
      await Promise.all(entries.slice(i, i + 4).map(async g => {
        const j = await getJson(`${API}/${g.league}/summary?event=${g.id}`, `${g.leagueLabel} ${g.id} 名單與事件`);
        details[g.key] = compactSummary(j, g);
      }));
    }
    const targetDetail = details[target.key];
    const lineupStatus = deriveLineupStatus(target, targetDetail);
    for (const teamId of [target.away.id, target.home.id]) {
      const t = teamData[teamId], recent = t.recent14.map(k => games[k]);
      t.pairs = makePairs(recent, target, teamId, details);
      t.players = makePlayers(recent, teamId, details);
      t.leagueFive = t.leagueFive.map(k => pairForTeam(games[k], teamId));
      t.recent14 = t.recent14.map(k => pairForTeam(games[k], teamId));
      const complete = t.leagueFive.filter(g => g.goalsFor !== null && g.goalsAgainst !== null);
      const full = complete.length === t.leagueFive.length && complete.length > 0;
      t.goals = { for: full ? complete.reduce((n, g) => n + g.goalsFor, 0) : null,
        against: full ? complete.reduce((n, g) => n + g.goalsAgainst, 0) : null,
        games: complete.length, requested: t.leagueFive.length };
    }
    const lottery = oddsForTarget(target, snapshots);
    const detail = { generatedAt, expiresAt, target, lineupStatus, lineupCheckedAt: new Date().toISOString(),
      lottery, teamData, games, details, errors: errors.slice(gameErrorsStart),
      limitations: ['ESPN 網頁資料端點未提供公開穩定性承諾；此為試行版本。', 'xG 本次未取得。',
        '14 日跨賽事已查英超、歐冠、歐聯、歐協、足總盃與聯賽盃；其他賽事未涵蓋。',
        '來源列出 11 位先發不代表替補名單完整；未列來源名單不等於未被正式報名。'] };
    await fs.writeFile(path.join(outDir, 'games', `${target.id}.json`), JSON.stringify(detail) + '\n');
    overview.games.find(g => g.id === target.id).dataStatus = 'ready';
    gameReports.push({ id: target.id, phase: target.phase, lineupStatus, lottery: lottery.status,
      teams: Object.values(teamData).map(t => ({ name: t.team.name, leagueFive: t.leagueFive.length,
        leagueScores: t.goals.games, recent14: t.recent14.length,
        pairsWithContinuation: t.pairs.filter(p => p.continuation !== null).length })) });
  }
  const status = { status: errors.length ? 'partial' : 'ok', generatedAt, expiresAt,
    gameCount: gameReports.length, gameIds: gameReports.map(g => g.id), sourceChecks: sourceChecks.length,
    sourceErrors: errors, updateMode: 'current_snapshot', oddsMode: 'official_one_time_snapshot' };
  await fs.writeFile(path.join(outDir, 'overview.json'), JSON.stringify(overview) + '\n');
  await fs.writeFile(path.join(outDir, 'status.json'), JSON.stringify(status) + '\n');
  const report = { ...status, explicitValidationEventId: requestedEvent || null, games: gameReports };
  await fs.writeFile(path.join(outDir, 'run-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

export { normalEvent, compactSummary, pairForTeam, oddsForTarget, deriveLineupStatus };
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(e => { console.error(`build-football failed: ${String(e?.stack || e)}`); process.exitCode = 1; });
}
