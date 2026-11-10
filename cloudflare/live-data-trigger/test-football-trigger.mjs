import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { footballDue, checkFootball, resolveFootball } from './worker.js';

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
      json: async () => ({ events: url.includes('/eng.1/') && url.includes('20261031') ? [
        { id: '401878761', date: '2026-10-31T17:30:00Z' },
        { id: 'second', date: '2026-10-31T17:30:00Z' },
        { id: 'other', date: '2026-10-31T20:00:00Z' },
      ] : [] }) }));
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /football-data\.yml\/dispatches$/);
    const body = JSON.parse(calls[0].init.body);
    assert.deepEqual(JSON.parse(body.inputs.trigger_matches_json), [
      { league: 'eng.1', id: '401878761', windowMinutes: 90 },
      { league: 'eng.1', id: 'second', windowMinutes: 90 },
    ]);
    assert.match(body.inputs.trigger_id, /2026-10-31T16:00Z eng\.1\/401878761 90/);
    assert.equal(writes.length, 3);
    assert.match(writes[0].sql, /check_ok/);
    assert.deepEqual(JSON.parse(writes[1].values[3]), ['eng.1:401878761', 'eng.1:second']);
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

test('一個聯賽 ESPN 輕量檢查失敗，仍派送另一聯賽同窗場次', async () => {
  const writes = [], calls = [], originalFetch = globalThis.fetch;
  const env = { GH_TOKEN: 'test-token', DB: { prepare: sql => ({ bind: (...values) => ({
    run: async () => { writes.push({ sql, values }); return { meta: { changes: 1 } }; },
  }) }) } };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => JSON.stringify({ workflow_run_id: 54321 }) };
  };
  try {
    await checkFootball(env, Date.parse('2026-11-07T11:35:00Z'), async url => {
      if (url.includes('/eng.1/')) throw new Error('英超檢查失敗');
      return { ok: true, json: async () => ({ events: url.includes('/esp.1/') ? [
        { id: '401882812', date: '2026-11-07T13:00Z' },
      ] : [] }) };
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(JSON.parse(JSON.parse(calls[0].init.body).inputs.trigger_matches_json),
      [{ league: 'esp.1', id: '401882812', windowMinutes: 90 }]);
    assert.match(writes[0].sql, /check_failure/);
    assert.match(writes[1].values[0], /esp\.1\/401882812/);
  } finally { globalThis.fetch = originalFetch; }
});

function receiptStore() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const env = { GH_TOKEN: 'test-token', DB: { prepare: sql => ({ bind: (...values) => ({
    all: async () => ({ results: db.prepare(sql).all(...values) }),
    run: async () => ({ meta: { changes: db.prepare(sql).run(...values).changes } }),
  }) }) } };
  return { db, env };
}

function addReceipt(db, id, runId, at) {
  db.prepare("INSERT INTO football_triggers (id, kind, scheduled_at, checked_at, http, run_id, match_id, match_ids) VALUES (?, 'dispatch', ?, ?, 200, ?, 'game-current', ?)")
    .run(id, at, at, runId, JSON.stringify(['eng.1:game-current']));
}

function completedRun(id, at) {
  return { id, status: 'completed', conclusion: 'success', run_started_at: at, updated_at: at };
}

function publicResponse(url, runId, generatedAt) {
  if (url.includes('/manifest.json')) return { ok: true, json: async () => ({
    runId, generatedAt, leagues: { 'eng.1': { gameIds: ['game-current'] } },
  }) };
  if (url.includes('/status.json')) return { ok: true, json: async () => ({ runId, generatedAt }) };
  if (url.includes('/games/game-current.json')) return { ok: true, json: async () => ({
    generatedAt, target: { id: 'game-current', league: 'eng.1' }, lineupStatus: 'official', lineupCheckedAt: generatedAt,
  }) };
  throw new Error(`未預期的回查 URL：${url}`);
}

test('資料成功後仍等待發布；只有公開批次符合 producer run ID 才完成回查', async () => {
  const { db, env } = receiptStore(), originalFetch = globalThis.fetch;
  const at = new Date(Date.now() - 3600000).toISOString(), runId = 777, generatedAt = new Date().toISOString();
  addReceipt(db, 'current', runId, at);
  let publicRunId = 776;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init?.method || 'GET' });
    if (url.includes('/actions/workflows/football-data.yml/runs')) return { ok: true, json: async () => ({ workflow_runs: [completedRun(runId, at)] }) };
    return publicResponse(url, publicRunId, generatedAt);
  };
  try {
    await resolveFootball(env);
    const waiting = db.prepare("SELECT * FROM football_triggers WHERE id='current'").get();
    assert.equal(waiting.run_status, 'completed');
    assert.equal(waiting.conclusion, 'success');
    assert.equal(waiting.public_generated_at, null);
    assert.equal(waiting.lineup_status, null);
    assert.notEqual(waiting.checked_at, at);
    assert.equal(calls.filter(row => row.url.includes('/games/')).length, 0);

    publicRunId = runId;
    await resolveFootball(env);
    const published = db.prepare("SELECT * FROM football_triggers WHERE id='current'").get();
    assert.equal(published.run_id, runId);
    assert.equal(published.public_generated_at, generatedAt);
    assert.equal(published.lineup_status, 'official');
    assert.equal(published.lineup_checked_at, generatedAt);
    const checkedCalls = calls.length;
    await resolveFootball(env);
    assert.equal(calls.length, checkedCalls, '已核實公開的列不再候查');
    assert.ok(calls.every(row => row.method === 'GET'), '等待公開不會重新派送、重跑或重抓來源');
  } finally { globalThis.fetch = originalFetch; db.close(); }
});

test('舊待確認列輪轉；查無 run 或單筆公開回查失敗不會餓死較新列', async () => {
  const { db, env } = receiptStore(), originalFetch = globalThis.fetch;
  const oldAt = new Date(Date.now() - 7200000).toISOString();
  const newAt = new Date(Date.now() - 300000).toISOString(), generatedAt = new Date().toISOString();
  for (let i = 0; i < 20; i++) addReceipt(db, `old-${String(i).padStart(2, '0')}`, 1000 + i, oldAt);
  addReceipt(db, 'new', 2000, newAt);
  globalThis.fetch = async (url, init) => {
    assert.equal(init?.method || 'GET', 'GET');
    if (url.includes('/actions/workflows/football-data.yml/runs')) return { ok: true, json: async () => ({
      workflow_runs: [completedRun(1000, oldAt), completedRun(2000, newAt)],
    }) };
    if (url.includes('cf=1000')) throw new Error('人工測試：舊批次公開回查失敗');
    return publicResponse(url, 2000, generatedAt);
  };
  try {
    await resolveFootball(env);
    assert.equal(db.prepare("SELECT count(*) AS n FROM football_triggers WHERE id LIKE 'old-%' AND checked_at <> ?").get(oldAt).n, 20);
    assert.equal(db.prepare("SELECT public_generated_at FROM football_triggers WHERE id='new'").get().public_generated_at, null);
    assert.equal(db.prepare("SELECT count(*) AS n FROM football_triggers WHERE id LIKE 'old-%' AND public_generated_at IS NOT NULL").get().n, 0);

    await resolveFootball(env);
    assert.equal(db.prepare("SELECT public_generated_at FROM football_triggers WHERE id='new'").get().public_generated_at, generatedAt);
    const old = db.prepare("SELECT conclusion, public_generated_at FROM football_triggers WHERE id='old-00'").get();
    assert.equal(old.conclusion, 'success');
    assert.equal(old.public_generated_at, null, '未觀測到舊批次公開，不補造公開時間');
  } finally { globalThis.fetch = originalFetch; db.close(); }
});
