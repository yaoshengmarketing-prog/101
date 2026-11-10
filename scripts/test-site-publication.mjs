import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { trustedProducer, selectArtifact, validateSnapshot, failedSnapshot, publicationRecord, composeSite, verifyPublic, assertNotOlder, prepareFootball, readPublishedState } from './site-publication.mjs';

const repository = 'yaoshengmarketing-prog/101';
const leagues = ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1'];
const at = '2026-11-10T08:00:00.000Z', expires = '2026-11-11T02:00:00.000Z';
const now = Date.parse(at) + 60000;
const run = (id = 10, values = {}) => ({ id, name: 'football push', path: '.github/workflows/football-data.yml',
  head_branch: 'main', head_sha: 'a'.repeat(40), repository: { full_name: repository },
  head_repository: { full_name: repository }, status: 'completed', conclusion: 'success', run_attempt: 1, ...values });
const artifact = (id = 100, runId = 10, values = {}) => ({ id, name: 'football-current', expired: false,
  created_at: at, workflow_run: { id: runId, head_branch: 'main', head_sha: 'a'.repeat(40) }, ...values });
const selection = (id = 100, runId = 10) => ({ artifact: artifact(id, runId), run: run(runId) });
const write = async (file, data) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(data) + '\n'); };
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));

async function fixture(t, selected = selection()) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'site-publication-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const football = path.join(root, '.football-publish');
  const manifest = { status: 'ok', runId: selected.run.id, generatedAt: at, expiresAt: expires, leagues: {}, gameCount: 5 };
  for (const [index, league] of leagues.entries()) {
    const id = String(1000 + index), dir = league === 'eng.1' ? football : path.join(football, 'leagues', league);
    manifest.leagues[league] = { status: 'ok', gameIds: [id], gameCount: 1, generatedAt: at };
    await write(path.join(dir, 'status.json'), { status: 'ok', league, generatedAt: at, expiresAt: expires, runId: selected.run.id });
    await write(path.join(dir, 'overview.json'), { generatedAt: at, games: [{ id }] });
    await write(path.join(dir, 'games', `${id}.json`), { generatedAt: at, target: { id, league } });
  }
  await write(path.join(football, 'manifest.json'), manifest);
  await write(path.join(football, 'snapshot-source.json'), { schemaVersion: 1, repository,
    workflow: '.github/workflows/football-data.yml', branch: 'main', sourceSha: selected.run.head_sha,
    runId: selected.run.id, runAttempt: selected.run.run_attempt });
  return { root, football, manifest, selected };
}

test('only the completed main-branch football producer in this repository is trusted', () => {
  assert.equal(trustedProducer(run(), repository), true);
  assert.equal(trustedProducer(run(10, { conclusion: 'failure' }), repository), true);
  for (const change of [{ head_branch: 'feature' }, { path: '.github/workflows/other.yml' },
    { head_repository: { full_name: 'someone/101' } }, { status: 'in_progress' }, { conclusion: 'cancelled' }]) {
    assert.equal(trustedProducer(run(10, change), repository), false);
  }
});

test('a queued old event selects the latest saved trusted batch, not its triggering run', async () => {
  const old = artifact(100, 10), latest = artifact(101, 11, { created_at: '2026-11-10T09:00:00Z' });
  const wrongWorkflow = artifact(102, 12, { created_at: '2026-11-10T10:00:00Z' });
  const runs = new Map([[10, run(10)], [11, run(11)], [12, run(12, { path: '.github/workflows/other.yml' })]]);
  assert.equal((await selectArtifact([old, wrongWorkflow, latest], id => runs.get(id), repository)).run.id, 11);
});

test('a due-window run without an artifact does not replace the existing batch', async () => {
  const result = await selectArtifact([artifact()], id => { assert.equal(id, 10); return run(id); }, repository);
  assert.equal(result.artifact.id, 100);
});

test('a completed producer failure with an artifact remains eligible', async () => {
  const result = await selectArtifact([artifact()], id => run(id, { conclusion: 'failure' }), repository);
  assert.equal(result.run.conclusion, 'failure');
});

test('a new football batch publishes even when the main and MLB version are unchanged', () => {
  const manifest = { status: 'ok', generatedAt: at, expiresAt: expires };
  const first = publicationRecord('main-sha', selection(), manifest);
  const second = publicationRecord('main-sha', selection(101, 11), manifest);
  assert.notEqual(first.publicationKey, second.publicationKey);
  assert.equal(first.publicationKey, publicationRecord('main-sha', selection(), manifest).publicationKey);
  assert.notEqual(first.publicationKey, publicationRecord('new-main-sha', selection(), manifest).publicationKey);
  assert.notEqual(first.publicationKey, publicationRecord('main-sha', selection(), { ...manifest, status: 'failed' }, 'expired').publicationKey);
});

test('an older snapshot uploaded later cannot replace a newer public batch', () => {
  assert.throws(() => assertNotOlder({ generatedAt: at }, '2026-11-10T09:00:00Z'), /較舊足球快照/);
  assert.doesNotThrow(() => assertNotOlder({ generatedAt: at }, at));
  assert.doesNotThrow(() => assertNotOlder({ generatedAt: at }, '2026-11-10T07:00:00Z'));
});

test('prepare reuses the published newer artifact when an older batch uploads later', async t => {
  const f = await fixture(t, selection(101, 11)), loaded = [];
  const published = publicationRecord('main', f.selected, f.manifest);
  const prepared = await prepareFootball({ root: f.football, published: { record: published, manifest: f.manifest },
    select: async () => selection(102, 12),
    load: async chosen => { loaded.push(chosen.run.id); return chosen.run.id === 12
      ? { ...f.manifest, runId: 12, generatedAt: '2026-11-10T07:00:00Z' }
      : validateSnapshot(f.football, chosen, repository, now); },
    loadPublished: async id => { assert.equal(id, 101); return f.selected; } });
  assert.deepEqual(loaded, [12, 11]);
  assert.equal(prepared.selection.artifact.id, 101);
  assert.equal(prepared.unavailableReason, null);
  assert.equal(prepared.manifest.runId, 11);
});

test('prepare downgrades an artifact API outage without stopping MLB/site composition', async t => {
  const f = await fixture(t);
  const prepared = await prepareFootball({ root: f.football, published: { manifest: f.manifest },
    select: async () => { throw new Error('GitHub artifacts HTTP 503'); }, load: async () => { assert.fail('must not load'); } });
  assert.equal(prepared.manifest.status, 'failed');
  assert.match(prepared.unavailableReason, /HTTP 503/);
  await write(path.join(f.root, 'live/data/status.json'), { version: 'new-mlb' });
  const record = publicationRecord('new-main', prepared.selection, prepared.manifest, prepared.unavailableReason, prepared.publishedAt);
  await composeSite(f.root, f.football, path.join(f.root, '.site'), record);
  assert.equal((await read(path.join(f.root, '.site/live/data/status.json'))).version, 'new-mlb');
  assert.equal(record.footballWatermark, at);
});

test('prepare never resets the published time watermark when an older batch is rejected', async t => {
  const f = await fixture(t), published = { footballWatermark: at, football: { artifactId: null } };
  const prepared = await prepareFootball({ root: f.football, published: { record: published, manifest: f.manifest },
    select: async () => f.selected,
    load: async () => ({ ...f.manifest, generatedAt: '2026-11-10T07:00:00Z' }) });
  assert.match(prepared.unavailableReason, /較舊足球快照/);
  assert.equal(prepared.manifest.status, 'failed');
  const record = publicationRecord('main', prepared.selection, prepared.manifest, prepared.unavailableReason, prepared.publishedAt);
  assert.equal(record.footballWatermark, at);
});

test('prepare uses the newer public manifest when its publication record is stale', async t => {
  const f = await fixture(t);
  const prepared = await prepareFootball({ root: f.football,
    published: { record: { footballWatermark: '2026-11-10T09:00:00Z', football: { artifactId: null } },
      manifest: { ...f.manifest, generatedAt: '2026-11-10T10:00:00Z' } },
    select: async () => f.selected,
    load: async () => ({ ...f.manifest, generatedAt: '2026-11-10T09:30:00Z' }) });
  assert.equal(prepared.publishedAt, '2026-11-10T10:00:00Z');
  assert.match(prepared.unavailableReason, /較舊足球快照/);
  assert.equal(prepared.manifest.status, 'failed');
});

test('only explicit public 404 responses establish that a prior publication is absent', async () => {
  const missing = () => { const error = new Error('not found'); error.status = 404; throw error; };
  assert.deepEqual(await readPublishedState('https://example.test', missing), { record: undefined, manifest: undefined });
  const existing = { generatedAt: at };
  assert.deepEqual(await readPublishedState('https://example.test', async url =>
    url.endsWith('site-publication.json') ? missing() : existing), { record: undefined, manifest: existing });
  for (const failure of [Object.assign(new Error('HTTP 503'), { status: 503 }), new Error('request timed out')]) {
    await assert.rejects(readPublishedState('https://example.test', async () => { throw failure; }), /暫停本次發布/);
    await assert.rejects(readPublishedState('https://example.test', async url => {
      if (url.endsWith('/manifest.json')) throw failure;
      return { footballWatermark: at };
    }), /暫停本次發布/);
  }
});

test('all five leagues and their game IDs validate as one saved batch', async t => {
  const f = await fixture(t);
  assert.equal((await validateSnapshot(f.football, f.selected, repository, now)).gameCount, 5);
});

test('a saved failure batch with no game payload is valid and is not silently replaced', async t => {
  const f = await fixture(t);
  const failure = await failedSnapshot(f.football, '本次足球取數或 QA 失敗', f.selected, f.manifest);
  assert.equal((await validateSnapshot(f.football, f.selected, repository, now)).status, 'failed');
  assert.equal(failure.generatedAt, at);
  await assert.rejects(fs.stat(path.join(f.football, 'games', '1000.json')), { code: 'ENOENT' });
});

test('legacy root-only failure batches are normalized for all five leagues and clear partial games', async t => {
  const f = await fixture(t);
  await write(path.join(f.football, 'manifest.json'), { status: 'failed', runId: 10,
    generatedAt: at, expiresAt: expires, reason: '原始失敗原因' });
  const manifest = await validateSnapshot(f.football, f.selected, repository, now);
  assert.equal(manifest.reason, '原始失敗原因');
  assert.equal(Object.keys(manifest.leagues).length, 5);
  assert.equal((await read(path.join(f.football, 'leagues/esp.1/status.json'))).status, 'failed');
  await assert.rejects(fs.stat(path.join(f.football, 'leagues/esp.1/games/1001.json')), { code: 'ENOENT' });
});

test('the actual producer failure step uses one timestamp and clears every league payload', async t => {
  const f = await fixture(t), output = path.join(f.root, '.football-build/data');
  await fs.cp(f.football, output, { recursive: true });
  const workflow = await fs.readFile(new URL('../.github/workflows/football-data.yml', import.meta.url), 'utf8');
  const step = workflow.split('- name: 更新失敗時保存明確狀態')[1];
  const code = step.match(/node --input-type=module <<'NODE'\n([\s\S]+?)\n          NODE/)[1];
  execFileSync(process.execPath, ['--input-type=module', '--eval', code], { cwd: f.root,
    env: { ...process.env, GITHUB_RUN_ID: '10' } });
  const manifest = await read(path.join(output, 'manifest.json'));
  for (const league of leagues) {
    const dir = league === 'eng.1' ? output : path.join(output, 'leagues', league);
    const status = await read(path.join(dir, 'status.json'));
    assert.equal(status.status, 'failed');
    assert.equal(status.generatedAt, manifest.generatedAt);
    await assert.rejects(fs.stat(path.join(dir, 'games')), { code: 'ENOENT' });
  }
});

test('a snapshot that expired while Pages waited cannot be treated as current', async t => {
  const f = await fixture(t);
  await assert.rejects(validateSnapshot(f.football, f.selected, repository, Date.parse(expires)), /已逾期/);
});

test('run, source SHA and single-game identity mismatches are rejected', async t => {
  const f = await fixture(t);
  await assert.rejects(validateSnapshot(f.football, selection(100, 99), repository, now), /run ID/);
  const sourcePath = path.join(f.football, 'snapshot-source.json'), provenance = await read(sourcePath);
  await write(sourcePath, { ...provenance, sourceSha: 'wrong' });
  await assert.rejects(validateSnapshot(f.football, f.selected, repository, now), /來源版本/);
  await write(sourcePath, provenance);
  await write(path.join(f.football, 'games/1000.json'), { generatedAt: at, target: { id: '1000', league: 'esp.1' } });
  await assert.rejects(validateSnapshot(f.football, f.selected, repository, now), /身分或批次/);
});

test('the publisher combines its fixed main and selected football batch without old football files', async t => {
  const f = await fixture(t);
  await write(path.join(f.root, 'live/data/status.json'), { version: 'latest-mlb' });
  await write(path.join(f.root, 'football/data/games/old.json'), { old: true });
  await fs.writeFile(path.join(f.root, 'index.html'), 'current-main');
  const record = publicationRecord('fixed-main', f.selected, f.manifest), output = path.join(f.root, '.site');
  await composeSite(f.root, f.football, output, record);
  assert.equal(await fs.readFile(path.join(output, 'index.html'), 'utf8'), 'current-main');
  assert.equal((await read(path.join(output, 'live/data/status.json'))).version, 'latest-mlb');
  assert.equal((await read(path.join(output, 'football/data/manifest.json'))).runId, 10);
  assert.equal((await read(path.join(output, 'site-publication.json'))).sourceSha, 'fixed-main');
  await assert.rejects(fs.stat(path.join(output, 'football/data/games/old.json')), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.join(output, '.football-publish')), { code: 'ENOENT' });
});

test('public verification covers the MLB version and every league/game, and rejects a mismatched game', async t => {
  const f = await fixture(t);
  await write(path.join(f.root, 'live/data/status.json'), { version: 2 });
  const record = publicationRecord('fixed-main', f.selected, f.manifest), output = path.join(f.root, '.site');
  await composeSite(f.root, f.football, output, record);
  const base = 'https://example.test/101', file = url => path.join(output, url.slice(base.length + 1));
  const getJson = url => read(file(url)), getText = url => fs.readFile(file(url), 'utf8');
  await verifyPublic(base, record, f.manifest, getJson, getText);
  await assert.rejects(verifyPublic(base, record, f.manifest, async url => {
    const data = await getJson(url);
    return url.endsWith('/1003.json') ? { ...data, target: { ...data.target, id: '9999' } } : data;
  }, getText), /1003.*身分或批次/);
});

test('the data workflow has no Pages dependency and the one publisher retains the existing lock and environment', async () => {
  const football = await fs.readFile(new URL('../.github/workflows/football-data.yml', import.meta.url), 'utf8');
  const site = await fs.readFile(new URL('../.github/workflows/site-pages.yml', import.meta.url), 'utf8');
  assert.match(football, /group: football-data-producer-\$\{\{ github.ref \}\}/);
  assert.doesNotMatch(football, /site-pages-deploy|github-pages|deploy-pages|upload-pages-artifact|pages: write/);
  assert.match(football, /name: football-current/);
  assert.match(site, /workflows: \[live-data, football-data\]/);
  assert.match(site, /group: site-pages-deploy/);
  assert.match(site, /name: github-pages/);
  assert.equal((site.match(/uses: actions\/deploy-pages/g) || []).length, 1);
});
