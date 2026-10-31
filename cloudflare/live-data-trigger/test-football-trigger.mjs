import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { footballDue, checkFootball } from './worker.js';

test('熱刺對水晶宮在開球前 90／30 分鐘各有一個觸發窗', () => {
  const kickoff = '2026-10-31T17:30:00Z';
  assert.equal(footballDue(kickoff, Date.parse('2026-10-31T16:00:37Z')), 90);
  assert.equal(footballDue(kickoff, Date.parse('2026-10-31T16:15:37Z')), null);
  assert.equal(footballDue(kickoff, Date.parse('2026-10-31T17:00:37Z')), 30);
});

test('輕量賽程來源失敗只寫檢查紀錄，不派送完整建置', async () => {
  const writes = [];
  const env = { DB: { prepare: sql => ({ bind: (...values) => ({ run: async () => { writes.push({ sql, values }); return { meta: { changes: 1 } }; } }) }) } };
  await checkFootball(env, Date.parse('2026-10-31T16:00:00Z'), async () => { throw new Error('ESPN timeout'); });
  assert.equal(writes.length, 1);
  assert.match(writes[0].sql, /check_failure/);
  assert.match(writes[0].values.at(-1), /ESPN timeout/);
});

test('到 90 分鐘時窗同時到期的賽事只派送一次，並留下各場 ID 與 run ID', async () => {
  const writes = [], calls = [], originalFetch = globalThis.fetch;
  const env = { GH_TOKEN: 'test-token', DB: { prepare: sql => ({ bind: (...values) => ({ run: async () => { writes.push({ sql, values }); return { meta: { changes: 1 } }; } }) }) } };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => JSON.stringify({ workflow_run_id: 12345 }) };
  };
  try {
    await checkFootball(env, Date.parse('2026-10-31T16:00:37Z'), async url => ({ ok: true,
      json: async () => ({ events: url.includes('20261031') ? [
        { id: '401878761', date: '2026-10-31T17:30:00Z' },
        { id: 'second', date: '2026-10-31T17:30:00Z' },
        { id: 'other', date: '2026-10-31T20:00:00Z' },
      ] : [] }) }));
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /football-data\.yml\/dispatches$/);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.inputs.event_id, '401878761');
    assert.match(body.inputs.trigger_id, /2026-10-31T16:00Z 401878761 90/);
    assert.equal(writes.length, 3);
    assert.match(writes[0].sql, /check_ok/);
    assert.deepEqual(JSON.parse(writes[1].values[3]), ['401878761', 'second']);
    assert.equal(writes[2].values[3], 12345);
  } finally { globalThis.fetch = originalFetch; }
});

test('新增足球 cron 不派送棒球；舊 cron 仍派送原棒球 workflow', async () => {
  const calls = [], originalFetch = globalThis.fetch;
  const env = { GH_TOKEN: 'test-token', DB: { prepare: sql => ({
    bind: () => ({ all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 1 } }) }),
  }) } };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ events: [] }), text: async () => JSON.stringify({ workflow_run_id: 123 }) };
  };
  const fire = async (cron, at) => {
    let pending;
    await worker.scheduled({ cron, scheduledTime: Date.parse(at) }, env, { waitUntil: promise => { pending = promise; } });
    await pending;
  };
  try {
    await fire('*/15 8-12 * * *', '2026-10-31T08:30:37Z');
    assert.equal(calls.filter(x => x.url.includes('/live-data.yml/dispatches')).length, 0);
    calls.length = 0;
    await fire('*/15 0-3,13-23 * * *', '2026-10-31T13:00:37Z');
    assert.equal(calls.filter(x => x.url.includes('/live-data.yml/dispatches')).length, 1);
  } finally { globalThis.fetch = originalFetch; }
});
