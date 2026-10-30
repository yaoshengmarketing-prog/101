import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOverview, renderGame } from '../assets/football.js';
import { dueWindow } from './football-due.mjs';

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
