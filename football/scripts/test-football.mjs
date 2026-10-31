import test from 'node:test';
import assert from 'node:assert/strict';
import { normalEvent, compactSummary, pairForTeam, deriveLineupStatus, oddsForTarget, scoreboardDays } from './build-football.mjs';

const target = { id: '401878761', home: { id: '367', name: 'Tottenham Hotspur' },
  away: { id: '384', name: 'Crystal Palace' }, kickoffUTC: '2026-10-31T17:30Z' };

function event(homeScore, awayScore, status = { state: 'post', completed: true, name: 'STATUS_FINAL' }) {
  return { id: '999', date: '2026-10-25T14:00Z', competitions: [{ status: { type: status }, competitors: [
    { homeAway: 'home', team: { id: '367', displayName: 'Tottenham Hotspur' }, score: { value: homeScore } },
    { homeAway: 'away', team: { id: '384', displayName: 'Crystal Palace' }, score: { value: awayScore } },
  ] }] };
}

test('缺一隊比分時不把 null 當 0，也不合計總進球', () => {
  const g = normalEvent(event(null, 2), 'eng.1');
  assert.equal(g.score, null);
  assert.equal(pairForTeam(g, '367').totalGoals, null);
});

test('延期狀態不冒充賽前，已有比分也只在完整時顯示', () => {
  assert.equal(normalEvent(event(null, null, { state: 'pre', name: 'STATUS_POSTPONED' }), 'eng.1').phase, 'postponed');
  assert.equal(normalEvent(event(1, 0), 'eng.1').score.home, 1);
});

test('11 名先發只證明先發已列，不能推定替補完整', () => {
  const roster = Array.from({ length: 11 }, (_, i) => ({ starter: true, athlete: { id: String(i + 1), displayName: `球員 ${i + 1}` } }));
  const summary = compactSummary({ rosters: [
    { team: { id: '367' }, roster }, { team: { id: '384' }, roster },
  ] }, target);
  assert.equal(deriveLineupStatus(target, summary), 'source_listed');
  assert.equal(summary.completeRosters['367'], true);
  assert.equal(summary.rosters['367'].length, 11);
  assert.equal(summary.benchCompleteness, 'unverified');
  assert.equal(deriveLineupStatus(target, compactSummary({ rosters: [
    { team: { id: '367' } }, { team: { id: '384' } },
  ] }, target)), 'unannounced');
  assert.equal(deriveLineupStatus(target, compactSummary(null, target)), 'fetch_failed');
});

test('同場雙方射門依隊伍 ID 配對；缺值、矛盾或比分不合時整組留空', () => {
  const game = { id: '401878767', finished: true, score: { home: 0, away: 2 },
    home: { id: 'home', name: 'Chelsea' }, away: { id: 'away', name: 'Tottenham Hotspur' }, source: 'ESPN' };
  const source = { header: { id: game.id, competitions: [{ competitors: [
    { homeAway: 'home', team: { id: 'home' }, score: '0' },
    { homeAway: 'away', team: { id: 'away' }, score: '2' },
  ] }] }, boxscore: { teams: [
    { team: { id: 'away' }, statistics: [
      { name: 'totalShots', displayValue: '15' }, { name: 'shotsOnTarget', displayValue: '4' }] },
    { team: { id: 'home' }, statistics: [
      { name: 'totalShots', displayValue: '7' }, { name: 'shotsOnTarget', displayValue: '4' }] },
  ] } };
  assert.deepEqual(compactSummary(source, game).teamShots,
    { home: { total: 7, onTarget: 4 }, away: { total: 15, onTarget: 4 } });
  const missing = structuredClone(source);
  missing.boxscore.teams[0].statistics.pop();
  assert.equal(compactSummary(missing, game).teamShots, null);
  const impossible = structuredClone(source);
  impossible.boxscore.teams[0].statistics[1].displayValue = '16';
  assert.equal(compactSummary(impossible, game).teamShots, null);
  const otherScore = structuredClone(source);
  otherScore.header.competitions[0].competitors[1].score = '1';
  assert.equal(compactSummary(otherScore, game).teamShots, null);
  const wrongId = structuredClone(source);
  wrongId.header.id = 'other';
  assert.equal(compactSummary(wrongId, game).teamShots, null);
});

test('台彩快照配對不符時不呈現賠率', () => {
  const snapshot = { eventId: target.id, lotteryEventId: '1234', matchedHomeId: '367',
    matchedAwayId: '384', kickoffUTC: target.kickoffUTC, capturedAt: '2026-10-30T08:00:00Z',
    source: 'https://www-talo-ssb-pr.sportslottery.com.tw/daily-coupons',
    markets: [{ play: '大小', threshold: '2.5', odds: [{ choice: '大', price: 1.8 }] }] };
  assert.equal(oddsForTarget(target, { [target.id]: snapshot }).status, 'snapshot');
  assert.equal(oddsForTarget(target, { [target.id]: { ...snapshot, matchedHomeId: '384' } }).status, 'match_failed');
  assert.equal(oddsForTarget(target, {}).markets, null);
});

test('台灣 11/2 晚間查詢涵蓋 11/1 凌晨所屬的 UTC 10/31', () => {
  const days = scoreboardDays(new Date('2026-11-02T15:00:00Z'));
  assert.equal(days[0], '20261031');
  assert.ok(days.includes('20261101'));
});
