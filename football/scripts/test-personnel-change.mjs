import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { personnelChange } from './personnel-change.mjs';

const teamId = '367';
const previous = { id: 'p', key: 'eng.1:p', leagueLabel: '英超', kickoffUTC: '2026-10-24T16:30Z',
  finished: true, home: { id: '363' }, away: { id: teamId }, source: 'ESPN' };
const target = { id: 't', key: 'eng.1:t', kickoffUTC: '2026-10-31T17:30Z', home: { id: teamId }, away: { id: '384' } };
const starters = () => Array.from({ length: 11 }, (_, i) => ({ id: String(i + 1), name: `球員 ${i + 1}`, role: 'starter' }));
const oldRoster = [...starters(), { id: '12', name: '球員 12', role: 'bench_unused' }];
const newRoster = [...starters().slice(0, 10), { id: '12', name: '球員 12', role: 'starter' },
  { id: '11', name: '球員 11', role: 'bench_unused' }];
const details = {
  [previous.key]: { status: 'acquired', completeRosters: { [teamId]: true }, rosters: { [teamId]: oldRoster } },
  [target.key]: { status: 'acquired', completeRosters: { [teamId]: true }, rosters: { [teamId]: newRoster } },
};
const scheduleStatus = [{ league: 'eng.1', status: 'acquired' }];
const make = overrides => personnelChange({ target, teamId, recentGames: [previous], details,
  scheduleStatus, ...overrides });

test('依球員 ID 計算沿用與雙向角色變化，不推斷缺席原因', () => {
  const change = make();
  assert.equal(change.status, 'available');
  assert.equal(change.continued, 10);
  assert.deepEqual(change.fromStarterToBench.map(p => p.id), ['11']);
  assert.deepEqual(change.fromBenchToStarter.map(p => p.id), ['12']);
  assert.equal(JSON.stringify(change).includes('injur'), false);
});

test('缺本場名單或前場 11 人時，不輸出沿用與角色轉換', () => {
  const noTarget = structuredClone(details);
  noTarget[target.key].completeRosters[teamId] = false;
  assert.equal(make({ details: noTarget }).status, 'target_lineup_unavailable');
  assert.equal(make({ details: noTarget }).continued, null);
  const shortPrevious = structuredClone(details);
  shortPrevious[previous.key].rosters[teamId].pop();
  shortPrevious[previous.key].rosters[teamId].pop();
  shortPrevious[previous.key].completeRosters[teamId] = false;
  assert.equal(make({ details: shortPrevious }).status, 'previous_lineup_incomplete');
  assert.equal(make({ details: shortPrevious }).fromStarterToBench.length, 0);
});

test('賽程缺漏、前場不在範圍、來源失敗與重複 ID 均不形成比較', () => {
  assert.equal(make({ scheduleStatus: [{ status: 'not_acquired' }] }).status, 'schedule_incomplete');
  assert.equal(make({ recentGames: [] }).status, 'previous_game_unavailable');
  const failed = structuredClone(details);
  failed[target.key].status = 'not_acquired';
  assert.equal(make({ details: failed }).status, 'target_fetch_failed');
  const duplicate = structuredClone(details);
  duplicate[target.key].rosters[teamId].push(duplicate[target.key].rosters[teamId][0]);
  assert.equal(make({ details: duplicate }).status, 'lineup_inconsistent');
});

test('只比較真正最後一場；本場與未來場不混入歷史', () => {
  const older = { ...previous, id: 'older', key: 'eng.1:older', kickoffUTC: '2026-10-19T19:00Z' };
  const future = { ...previous, id: 'future', key: 'eng.1:future', kickoffUTC: '2026-11-02T20:00Z' };
  const change = make({ recentGames: [future, previous, older], details: { ...details,
    [older.key]: details[previous.key], [future.key]: details[previous.key] } });
  assert.equal(change.previous.id, previous.id);
});

test('熱刺歷史 ESPN 候選對上賽前核對結果；另一場可用同一規則', () => {
  const read = id => JSON.parse(fs.readFileSync(new URL(`../personnel-preview/data/${id}.json`, import.meta.url)));
  const palace = read('401878761');
  const spurs = palace.teams.find(team => team.id === teamId);
  assert.equal(spurs.change.previous.id, '401878767');
  assert.equal(spurs.change.continued, 10);
  assert.deepEqual(spurs.change.fromStarterToBench.map(player => player.name), ['James Maddison']);
  assert.deepEqual(spurs.change.fromBenchToStarter.map(player => player.name), ['Dominic Solanke']);
  const liverpool = read('401879246');
  assert.equal(liverpool.teams.length, 2);
  assert.ok(liverpool.teams.every(team => team.change.status === 'available'
    && team.change.previousStarterCount === 11 && team.change.targetStarterCount === 11));
  assert.ok(liverpool.teams.every(team => team.change.previous.leagueLabel === '聯賽盃'));
});
