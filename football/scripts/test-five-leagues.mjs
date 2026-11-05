import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEAGUES, TOP_LEAGUE_IDS, LIVE_LEAGUE_IDS, competitionsFor } from './football-leagues.mjs';
import { decide, dueWindow } from './football-due.mjs';
import { footballDue } from '../../cloudflare/live-data-trigger/worker.js';
import { resultBlock } from '../assets/football.js';

const samples = [
  { league: 'esp.1', id: '401882812', kickoff: '2026-11-07T13:00Z' },
  { league: 'ita.1', id: '401874791', kickoff: '2026-11-07T14:00Z' },
  { league: 'ger.1', id: '401884745', kickoff: '2026-11-07T14:30Z' },
  { league: 'fra.1', id: '401876411', kickoff: '2026-11-07T18:00Z' },
];

test('五大聯賽各有本國盃賽與歐戰來源，正式啟用集合包含五聯賽', () => {
  assert.deepEqual(TOP_LEAGUE_IDS, ['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1']);
  assert.deepEqual(LIVE_LEAGUE_IDS, TOP_LEAGUE_IDS);
  for (const id of TOP_LEAGUE_IDS) {
    const sources = competitionsFor(id).map(source => source.id);
    assert.equal(sources[0], id);
    assert.ok(sources.some(source => source.startsWith(id.split('.')[0] + '.') && source !== id));
    assert.ok(sources.includes('uefa.champions'));
    assert.ok(sources.includes('uefa.europa'));
    assert.ok(sources.includes('uefa.europa.conf'));
    assert.ok(LEAGUES[id].label);
  }
});

test('四場真實候選各自使用所屬聯賽近五場，不混成英超', () => {
  for (const { league, id } of samples) {
    const root = path.resolve(`football/five-leagues-preview/${league}/data`);
    const status = JSON.parse(fs.readFileSync(path.join(root, 'status.json')));
    const game = JSON.parse(fs.readFileSync(path.join(root, 'games', `${id}.json`)));
    assert.equal(status.league, league);
    assert.equal(status.gameCount, 1);
    assert.equal(game.target.id, id);
    assert.equal(game.target.league, league);
    assert.equal(game.generatedAt, status.generatedAt);
    for (const team of Object.values(game.teamData)) {
      assert.equal(team.leagueFive.length, 5);
      assert.ok(team.leagueFive.every(row => row.league === league));
      assert.deepEqual(team.scheduleStatus.map(row => row.league), competitionsFor(league).map(row => row.id));
      const rows = resultBlock(team, game.details);
      assert.match(rows, new RegExp(`這 5 場${LEAGUES[league].label}中的主客成績`));
      assert.doesNotMatch(rows, /這 5 場英超中的主客成績/);
    }
  }
});

test('四個新增聯賽的 90／30 分鐘時窗同時被 GitHub 閘門與外部觸發規則辨識', async () => {
  for (const { league, id, kickoff } of samples) for (const [minutesBefore, expected] of [[85, '90'], [25, '30']]) {
    const at = new Date(Date.parse(kickoff) - minutesBefore * 60000);
    const calls = [];
    const result = await decide({ schedule: '5,35 * * * *', now: at, leagueIds: TOP_LEAGUE_IDS,
      fetcher: async url => {
        calls.push(url);
        const match = url.match(/soccer\/([^/]+)\/scoreboard\?dates=(\d+)/);
        return { ok: true, json: async () => ({ events: match[1] === league && match[2] === kickoff.slice(0, 10).replaceAll('-', '')
          ? [{ id, date: kickoff }] : [] }) };
      } });
    assert.equal(calls.length, 10);
    assert.equal(result.build, true);
    assert.deepEqual(result.matches, [{ league, id, windowMinutes: Number(expected) }]);
    assert.match(result.reason, new RegExp(`${league}/${id}:${expected}分`));
    assert.equal(dueWindow(kickoff, at), expected);
    assert.equal(footballDue(kickoff, at.getTime()), Number(expected));
  }
});

test('一個聯賽賽程失敗時，其他聯賽的賽前場次仍可觸發', async () => {
  const at = new Date('2026-11-07T11:35:00Z');
  const result = await decide({ schedule: '5,35 * * * *', now: at, leagueIds: ['eng.1', 'esp.1'],
    fetcher: async url => {
      if (url.includes('/eng.1/')) throw new Error('英超來源暫時失敗');
      return { ok: true, json: async () => ({ events: [{ id: '401882812', date: '2026-11-07T13:00Z' }] }) };
    } });
  assert.equal(result.build, true);
  assert.equal(result.checkFailed, true);
  assert.deepEqual(result.matches, [{ league: 'esp.1', id: '401882812', windowMinutes: 90 }]);
});
