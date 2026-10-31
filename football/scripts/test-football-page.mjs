import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOverview, renderGame, venueResults, venueLine, summarizeUsage } from '../assets/football.js';
import { dueWindow, decide } from './football-due.mjs';

test('失敗與逾期狀態先行，總覽及單場不讀已移除 JSON', async () => {
  const node = { innerHTML: '' };
  const calls = [];
  globalThis.document = { querySelector: selector => selector === '#overview' || selector === '#game' ? node : null };
  globalThis.location = { search: '?id=401878761' };
  globalThis.fetch = async url => {
    calls.push(url);
    if (!url.includes('status.json')) throw new Error('不應讀取已移除資料');
    return { ok: true, json: async () => globalThis.testStatus };
  };
  try {
    const now = Date.now();
    globalThis.testStatus = { status: 'failed', generatedAt: new Date(now).toISOString(), expiresAt: new Date(now + 3600000).toISOString() };
    await renderOverview();
    assert.match(node.innerHTML, /本次更新失敗/);
    assert.equal(calls.length, 1);
    calls.length = 0;
    await renderGame();
    assert.match(node.innerHTML, /本次更新失敗/);
    assert.equal(calls.length, 1);
    calls.length = 0;
    globalThis.testStatus = { status: 'ok', generatedAt: new Date(now - 7200000).toISOString(), expiresAt: new Date(now - 3600000).toISOString() };
    await renderOverview();
    assert.match(node.innerHTML, /已逾期/);
    assert.equal(calls.length, 1);
    calls.length = 0;
    await renderGame();
    assert.match(node.innerHTML, /已逾期/);
    assert.equal(calls.length, 1);
  } finally {
    delete globalThis.document;
    delete globalThis.location;
    delete globalThis.fetch;
    delete globalThis.testStatus;
  }
});

test('開球前 90／30 分鐘判斷，非時窗跳過', () => {
  const kickoff = '2026-10-31T17:30:00Z';
  assert.equal(dueWindow(kickoff, new Date('2026-10-31T16:05:00Z')), '90');
  assert.equal(dueWindow(kickoff, new Date('2026-10-31T16:35:00Z')), null);
  assert.equal(dueWindow(kickoff, new Date('2026-10-31T17:05:00Z')), '30');
});

test('輕量賽程檢查失敗只停止本次檢查，不觸發完整重建', async () => {
  const result = await decide({ schedule: '5,35 * * * *', now: new Date('2026-10-31T16:00:00Z'),
    fetcher: async () => { throw new Error('HTTP 503'); } });
  assert.equal(result.build, false);
  assert.equal(result.checkFailed, true);
  assert.match(result.reason, /HTTP 503/);
});

test('近五場依當場主客分組，缺比分不算和局並顯示完整分母', () => {
  const games = [
    { side: 'home', goalsFor: 3, goalsAgainst: 1 },
    { side: 'home', goalsFor: 2, goalsAgainst: 3 },
    { side: 'home', goalsFor: 0, goalsAgainst: 0 },
    { side: 'away', goalsFor: 2, goalsAgainst: 0 },
    { side: 'away', goalsFor: 1, goalsAgainst: 1 },
  ];
  const full = venueResults(games);
  assert.equal(venueLine('主場', full.home), '主場 3 場：1 勝、1 和、1 敗');
  assert.equal(venueLine('客場', full.away), '客場 2 場：1 勝、1 和、0 敗');

  const partial = venueResults([
    { side: 'home', goalsFor: null, goalsAgainst: null },
    { side: 'home', goalsFor: 1, goalsAgainst: 0 },
    { side: 'away', goalsFor: null, goalsAgainst: null },
    { side: 'unknown', goalsFor: 0, goalsAgainst: 0 },
  ]);
  assert.equal(partial.home.games, 2);
  assert.equal(partial.home.complete, 1);
  assert.equal(partial.home.draws, 0);
  assert.equal(venueLine('主場', partial.home), '主場 2 場（比分完整 1/2 場）：1 勝、0 和、0 敗');
  assert.equal(venueLine('客場', partial.away), '客場 1 場：比分本次未取得');
  assert.equal(partial.unknown, 1);
});

test('近期用人從相鄰歷史場次產生白話句，通用選人規則涵蓋角色變化', () => {
  const target = { key: 'eng.1:target', kickoffUTC: '2026-10-31T17:30:00Z' };
  const europa = { key: 'europa:a', kickoffUTC: '2026-10-22T19:00:00Z', league: 'uefa.europa', leagueLabel: '歐聯', finished: true };
  const league = { key: 'eng.1:b', kickoffUTC: '2026-10-25T14:00:00Z', league: 'eng.1', leagueLabel: '英超', finished: true };
  const cup = { key: 'cup:c', kickoffUTC: '2026-10-28T19:45:00Z', league: 'eng.league_cup', leagueLabel: '聯賽盃', finished: true };
  const earlier = { key: 'eng.1:earlier', kickoffUTC: '2026-10-18T13:00:00Z', league: 'eng.1', leagueLabel: '英超', finished: true };
  const palace = { recent14: [earlier, europa, league, cup], scheduleStatus: [{ status: 'acquired' }],
    pairs: [{ from: europa.key, to: league.key, kickoffGapMinutes: 4020, continuation: 11 },
      { from: league.key, to: cup.key, kickoffGapMinutes: 4665, continuation: 1 }],
    players: [
      { name: 'Eddie Nketiah', games: [{ key: europa.key, role: 'sub_on' }, { key: league.key, role: 'sub_on' }, { key: cup.key, role: 'starter', goals: 1 }] },
      { name: 'Darío Osorio', games: [{ key: earlier.key, role: 'bench_unused' }, { key: europa.key, role: 'sub_on' }, { key: league.key, role: 'sub_on' }, { key: cup.key, role: 'starter' }] },
    ] };
  // 規則先看已確認的角色種類，再看最後一場記錄的貢獻；不按球隊或球員 ID 指定。
  const palaceText = summarizeUsage(palace, target);
  assert.match(palaceText, /歐聯接英超，兩場開球相隔不到 3 天，仍由同一批 11 人先發；隨後聯賽盃更換 10 名先發/);
  assert.match(palaceText, /Darío Osorio 前兩場替補上場，聯賽盃改先發/);
  assert.equal((palaceText.match(/。/g) || []).length, 2);
  palace.recent14.reverse();
  assert.equal(summarizeUsage(palace, target), palaceText);

  const spurs = { recent14: [{ ...europa, key: 'eng.1:first', league: 'eng.1', leagueLabel: '英超' },
    { ...league, key: 'eng.1:second', kickoffUTC: '2026-10-24T16:30:00Z' }],
  scheduleStatus: [{ status: 'acquired' }],
  pairs: [{ from: 'eng.1:first', to: 'eng.1:second', kickoffGapMinutes: 7050, continuation: 9 }],
  players: [
    { name: 'Mateus Fernandes', games: [{ key: 'eng.1:first', role: 'sub_on' }, { key: 'eng.1:second', role: 'starter' }] },
    { name: 'Mathys Tel', games: [{ key: 'eng.1:first', role: 'sub_on' }, { key: 'eng.1:second', role: 'starter', goals: 1 }] },
  ] };
  assert.equal(summarizeUsage(spurs, target), '兩場英超開球約隔 5 天，第二場更換 2 名先發。Mathys Tel 從替補上場轉為先發。');
});

test('中間名單缺漏不拼成連續三場，本場正式名單不混入歷史用人摘要', () => {
  const target = { key: 'eng.1:target', kickoffUTC: '2026-10-31T17:30:00Z', lineupStatus: 'source_listed' };
  const games = [
    { key: 'a', kickoffUTC: '2026-10-22T19:00:00Z', league: 'uefa.europa', leagueLabel: '歐聯', finished: true },
    { key: 'b', kickoffUTC: '2026-10-25T14:00:00Z', league: 'eng.1', leagueLabel: '英超', finished: true },
    { key: 'c', kickoffUTC: '2026-10-28T19:45:00Z', league: 'eng.league_cup', leagueLabel: '聯賽盃', finished: true },
  ];
  const team = { recent14: games, scheduleStatus: [{ status: 'acquired' }], players: [],
    pairs: [{ from: 'a', to: 'b', kickoffGapMinutes: 4020, continuation: null },
      { from: 'b', to: 'c', kickoffGapMinutes: 4665, continuation: 1 }] };
  const partial = summarizeUsage(team, target);
  assert.match(partial, /英超接聯賽盃/);
  assert.match(partial, /先發資料未齊，展開可看已取得紀錄/);
  assert.doesNotMatch(partial, /隨後|連續|歐聯接英超/);

  team.pairs[0].continuation = 11;
  team.scheduleStatus[0].status = 'not_acquired';
  const uncertain = summarizeUsage(team, target);
  assert.match(uncertain, /部分賽事賽程未取得/);
  assert.doesNotMatch(uncertain, /隨後|連續/);

  team.scheduleStatus[0].status = 'acquired';
  const before = summarizeUsage(team, target);
  team.recent14.push({ ...target, league: 'eng.1', leagueLabel: '英超', finished: true });
  team.pairs.push({ from: 'c', to: target.key, kickoffGapMinutes: 4185, continuation: 11 });
  team.players.push({ name: '本場新先發', games: [{ key: 'c', role: 'sub_on' }, { key: target.key, role: 'starter' }] });
  assert.equal(summarizeUsage(team, target), before);
});
