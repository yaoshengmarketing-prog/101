// One-off research fixtures. Uses the same ESPN schedule/summary normalisation as the football builder.
// node football/scripts/make-personnel-preview.mjs 401878761
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalEvent, compactSummary } from './build-football.mjs';
import { personnelChange } from './personnel-change.mjs';

const API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const LEAGUES = ['eng.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'eng.fa', 'eng.league_cup'];
const targetId = process.argv[2];
if (!/^\d+$/.test(targetId || '')) throw new Error('請提供 ESPN 英超賽事 ID');
const sourceCheckedAt = new Date().toISOString();
const get = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
};
const schedules = new Map();
async function teamSchedule(teamId, league) {
  const key = `${league}:${teamId}`;
  if (!schedules.has(key)) schedules.set(key, await get(`${API}/${league}/teams/${teamId}/schedule?season=2026`));
  return schedules.get(key);
}
const boards = await Promise.all(['20261031', '20261101', '20261102'].map(date =>
  get(`${API}/eng.1/scoreboard?dates=${date}`)));
const rawTarget = boards.flatMap(board => board.events || []).find(event => String(event.id) === targetId);
if (!rawTarget) throw new Error(`賽程中沒有 ${targetId}`);
const target = normalEvent(rawTarget, 'eng.1');
const targetSummary = compactSummary(await get(`${API}/eng.1/summary?event=${targetId}`), target);
const details = { [target.key]: targetSummary };
const teams = [];
for (const team of [target.away, target.home]) {
  const games = [];
  const scheduleStatus = [];
  for (const league of LEAGUES) {
    const schedule = await teamSchedule(team.id, league);
    scheduleStatus.push({ league, status: 'acquired' });
    for (const raw of schedule.events || []) {
      const game = normalEvent(raw, league);
      if (game?.finished && Date.parse(game.kickoffUTC) < Date.parse(target.kickoffUTC)
        && Date.parse(game.kickoffUTC) >= Date.parse(target.kickoffUTC) - 14 * 86400000) games.push(game);
    }
  }
  const recentGames = [...new Map(games.map(game => [game.key, game])).values()]
    .sort((a, b) => a.kickoffUTC.localeCompare(b.kickoffUTC));
  const previous = recentGames.at(-1);
  if (previous) details[previous.key] = compactSummary(
    await get(`${API}/${previous.league}/summary?event=${previous.id}`), previous);
  const change = personnelChange({ target, teamId: team.id, recentGames, details, scheduleStatus });
  teams.push({ id: team.id, name: team.name, change, currentRoster: targetSummary.rosters?.[team.id] || [],
    previousGame: previous || null, previousRoster: previous ? details[previous.key].rosters?.[team.id] || [] : [],
    recentGames: recentGames.map(game => ({ id: game.id, key: game.key, league: game.league,
      leagueLabel: game.leagueLabel, kickoffUTC: game.kickoffUTC, home: game.home, away: game.away })) });
}
const output = { kind: 'historical_research_fixture', sourceCheckedAt, target: { ...target,
  source: `https://www.espn.com/soccer/match/_/gameId/${targetId}` },
  teams, source: `${API}/eng.1/summary?event=${targetId}` };
const outputPath = path.resolve('football/personnel-preview/data', `${targetId}.json`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ outputPath, targetId, teams: teams.map(team => ({ team: team.name,
  previous: team.change.previous?.id, status: team.change.status, continued: team.change.continued,
  fromStarterToBench: team.change.fromStarterToBench.map(p => p.name),
  fromBenchToStarter: team.change.fromBenchToStarter.map(p => p.name) })) }, null, 2));
