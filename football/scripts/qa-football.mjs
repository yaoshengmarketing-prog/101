// node football/scripts/qa-football.mjs [football/data]
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const dir = path.resolve(process.argv[2] || 'football/data');
const [overview, game, report] = await Promise.all(['overview.json', 'game.json', 'run-report.json'].map(async name => JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'))));
assert.equal(game.target.key, overview.target);
assert.equal(game.target.id, report.targetId);
assert.equal(game.target.league, 'eng.1');
assert.ok(Date.parse(game.target.kickoffUTC) > Date.parse(game.generatedAt), '目標場必須尚未開球');
assert.equal(game.target.score, null, '賽前目標場不得有比分');
assert.equal(game.lottery.status === 'not_acquired' && game.lottery.markets === null, true, '受阻盤口不得帶舊賠率');
assert.ok(game.lottery.checkedAt, '盤口失敗也要有查詢時間');
const start14 = Date.parse(game.target.kickoffUTC) - 14 * 86400000;
let resultRows = 0, usageRows = 0, pairRows = 0, subScores = 0;
for (const id of [game.target.away.id, game.target.home.id]) {
  const team = game.teamData[id];
  assert.ok(team, `缺隊伍 ${id}`);
  assert.ok(team.leagueFive.length <= 5);
  for (const g of team.leagueFive) {
    assert.equal(g.league, 'eng.1');
    assert.equal(g.goalsFor + g.goalsAgainst, g.totalGoals);
    assert.ok(Date.parse(g.kickoffUTC) < Date.parse(game.target.kickoffUTC));
    resultRows++;
  }
  for (const g of team.recent14) {
    assert.ok(Date.parse(g.kickoffUTC) >= start14);
    assert.ok(Date.parse(g.kickoffUTC) < Date.parse(game.target.kickoffUTC));
    assert.ok(['eng.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'eng.fa', 'eng.league_cup'].includes(g.league));
    usageRows++;
  }
  assert.equal(team.pairs.length, team.recent14.length);
  for (const p of team.pairs) {
    const from = game.games[p.from], to = game.games[p.to];
    assert.ok(from && to);
    assert.equal(p.kickoffGapMinutes, Math.round((Date.parse(to.kickoffUTC) - Date.parse(from.kickoffUTC)) / 60000));
    if (p.continuation !== null) assert.ok(Number.isInteger(p.continuation) && p.continuation >= 0 && p.continuation <= 11);
    pairRows++;
  }
  for (const person of team.players) for (const rec of person.games) {
    assert.ok(['starter', 'sub_on', 'bench_unused', 'not_listed', 'not_acquired'].includes(rec.role));
    if (rec.role === 'not_listed') assert.ok(game.details[rec.key].completeRosters[id]);
  }
}
for (const detail of Object.values(game.details)) for (const e of detail.events || []) if (e.type === 'substitution' && e.scoreAt) subScores++;
const result = { qa: 'passed', generatedAt: game.generatedAt, resultRows, usageRows, pairRows, subScores, odds: game.lottery.status, sourceErrors: game.errors.length };
console.log(JSON.stringify(result));
