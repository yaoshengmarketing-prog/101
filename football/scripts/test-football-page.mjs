import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOverview, renderGame, venueResults, venueLine } from '../assets/football.js';
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
