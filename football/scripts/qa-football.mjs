// node football/scripts/qa-football.mjs [football/data]
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.resolve(process.argv[2] || 'football/data');
const read = async name => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
const [overview, status, report] = await Promise.all(['overview.json', 'status.json', 'run-report.json'].map(read));
assert.equal(overview.generatedAt, status.generatedAt);
assert.equal(status.generatedAt, report.generatedAt);
assert.equal(status.gameCount, overview.games.length);
assert.deepEqual(status.gameIds, overview.games.map(g => g.id));
assert.ok(Date.parse(status.expiresAt) > Date.parse(status.generatedAt));
assert.equal(new Set(status.gameIds).size, status.gameIds.length, '每場 ID 不可重複');

let resultRows = 0, usageRows = 0, pairRows = 0, subScores = 0, snapshots = 0;
const leagues = ['eng.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'eng.fa', 'eng.league_cup'];
for (const listed of overview.games) {
  assert.match(listed.id, /^\d+$/);
  assert.equal(listed.dataStatus, 'ready');
  const game = await read(`games/${listed.id}.json`);
  assert.equal(game.target.id, listed.id, '固定網址資料不得指向另一場');
  assert.equal(game.target.key, listed.key);
  assert.equal(game.target.league, 'eng.1');
  assert.equal(game.generatedAt, status.generatedAt);
  assert.ok(['pre', 'live', 'final', 'postponed'].includes(game.target.phase));
  assert.ok(['unannounced', 'partial', 'source_listed', 'fetch_failed'].includes(game.lineupStatus));
  assert.equal(game.lottery.source, 'https://www-talo-ssb-pr.sportslottery.com.tw/daily-coupons');
  if (game.lottery.status === 'snapshot') {
    assert.equal(game.lottery.eventId, listed.id);
    assert.match(game.lottery.lotteryEventId, /^\d+$/);
    assert.ok(Number.isFinite(Date.parse(game.lottery.capturedAt)));
    assert.ok(Array.isArray(game.lottery.markets) && game.lottery.markets.length);
    snapshots++;
  } else {
    assert.ok(['not_acquired', 'match_failed'].includes(game.lottery.status));
    assert.equal(game.lottery.markets, null, '不得沿用舊盤口');
  }
  const start14 = Date.parse(game.target.kickoffUTC) - 14 * 86400000;
  for (const id of [game.target.away.id, game.target.home.id]) {
    const team = game.teamData[id];
    assert.ok(team, `缺隊伍 ${id}`);
    assert.ok(team.leagueFive.length <= 5);
    const scoresComplete = team.leagueFive.every(g => g.goalsFor !== null && g.goalsAgainst !== null);
    if (!scoresComplete) {
      assert.equal(team.goals.for, null, '缺比分不可當零合計');
      assert.equal(team.goals.against, null, '缺比分不可當零合計');
    }
    for (const g of team.leagueFive) {
      assert.equal(g.league, 'eng.1');
      if (g.totalGoals !== null) assert.equal(g.goalsFor + g.goalsAgainst, g.totalGoals);
      assert.ok(Date.parse(g.kickoffUTC) < Date.parse(game.target.kickoffUTC));
      resultRows++;
    }
    for (const g of team.recent14) {
      assert.ok(Date.parse(g.kickoffUTC) >= start14);
      assert.ok(Date.parse(g.kickoffUTC) < Date.parse(game.target.kickoffUTC));
      assert.ok(leagues.includes(g.league));
      usageRows++;
    }
    assert.equal(team.pairs.length, team.recent14.length);
    for (const pair of team.pairs) {
      const from = game.games[pair.from], to = game.games[pair.to];
      assert.ok(from && to);
      assert.equal(pair.kickoffGapMinutes, Math.round((Date.parse(to.kickoffUTC) - Date.parse(from.kickoffUTC)) / 60000));
      if (pair.continuation !== null) assert.ok(Number.isInteger(pair.continuation) && pair.continuation >= 0 && pair.continuation <= 11);
      pairRows++;
    }
    for (const person of team.players) for (const rec of person.games) {
      assert.ok(['starter', 'sub_on', 'bench_unused', 'not_listed', 'not_acquired'].includes(rec.role));
      if (rec.role === 'not_listed') assert.ok(game.details[rec.key].rosterPresence[id]);
    }
  }
  for (const detail of Object.values(game.details)) for (const event of detail.events || []) {
    if (event.type === 'substitution' && event.scoreAt) subScores++;
  }
}
console.log(JSON.stringify({ qa: 'passed', games: overview.games.length, resultRows, usageRows,
  pairRows, subScores, snapshots, sourceChecks: status.sourceChecks, sourceErrors: status.sourceErrors.length }));
