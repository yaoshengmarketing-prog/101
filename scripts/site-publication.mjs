import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PRODUCER = '.github/workflows/football-data.yml';
const LEAGUES = ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const writeJson = async (file, value) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value) + '\n'); };
const leagueDir = (root, league) => league === 'eng.1' ? root : path.join(root, 'leagues', league);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function trustedProducer(run, repository) {
  return run?.path === PRODUCER
    && run.head_branch === 'main' && run.repository?.full_name === repository
    && run.head_repository?.full_name === repository && run.status === 'completed'
    && ['success', 'failure'].includes(run.conclusion);
}

// Completion events are wake-ups. Select the newest saved batch, not the old triggering run.
export async function selectArtifact(artifacts, getRun, repository) {
  const candidates = artifacts.filter(a => a.name === 'football-current' && !a.expired
    && a.workflow_run?.head_branch === 'main').sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  for (const artifact of candidates) {
    const run = await getRun(artifact.workflow_run.id);
    if (trustedProducer(run, repository) && String(run.id) === String(artifact.workflow_run.id)
      && artifact.workflow_run.head_sha === run.head_sha) return { artifact, run };
  }
  return null;
}

export async function validateSnapshot(root, selection, repository, now = Date.now()) {
  const manifest = await json(path.join(root, 'manifest.json'));
  assert(['ok', 'partial', 'failed'].includes(manifest.status), '足球 manifest 狀態無效');
  assert(String(manifest.runId) === String(selection.run.id), '足球快照與來源 run ID 不一致');
  assert(Number.isFinite(Date.parse(manifest.generatedAt)) && Number.isFinite(Date.parse(manifest.expiresAt)), '足球快照缺少有效時間');
  assert(Date.parse(manifest.expiresAt) > now, '足球快照已逾期，等待下次獨立更新');
  let provenance;
  try { provenance = await json(path.join(root, 'snapshot-source.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (provenance) {
    assert(provenance.repository === repository && provenance.workflow === PRODUCER
      && provenance.branch === 'main' && provenance.sourceSha === selection.run.head_sha
      && String(provenance.runId) === String(selection.run.id)
      && Number(provenance.runAttempt) === Number(selection.run.run_attempt), '足球快照來源版本不一致');
  }
  const rootStatus = await json(path.join(root, 'status.json'));
  assert(String(rootStatus.runId) === String(manifest.runId) && rootStatus.generatedAt === manifest.generatedAt, '足球根狀態與批次不一致');
  if (manifest.status === 'failed') return failedSnapshot(root,
    manifest.reason || rootStatus.reason || '本次足球取數或 QA 失敗', selection, manifest);
  if (manifest.status !== 'failed') assert(LEAGUES.every(id => manifest.leagues?.[id]), '足球快照缺少聯賽狀態');
  for (const [league, row] of Object.entries(manifest.leagues || {})) {
    assert(LEAGUES.includes(league), '足球快照含未知聯賽');
    const dir = leagueDir(root, league), status = await json(path.join(dir, 'status.json'));
    assert(status.status === row.status && status.generatedAt === manifest.generatedAt
      && String(status.runId) === String(manifest.runId), `${league} 批次狀態不一致`);
    if (row.status === 'failed') continue;
    assert(Array.isArray(row.gameIds) && row.gameIds.length === row.gameCount, `${league} 場次清單不一致`);
    const overview = await json(path.join(dir, 'overview.json'));
    assert(overview.generatedAt === manifest.generatedAt && overview.games.length === row.gameCount, `${league} 總覽批次不一致`);
    for (const id of row.gameIds) {
      assert(/^\d+$/.test(String(id)), '足球場次 ID 無效');
      const game = await json(path.join(dir, 'games', `${id}.json`));
      assert(String(game.target?.id) === String(id) && game.target.league === league
        && game.generatedAt === manifest.generatedAt, `${league}/${id} 身分或批次不一致`);
    }
  }
  return manifest;
}

export async function failedSnapshot(root, reason, selection, prior = {}) {
  await fs.rm(root, { recursive: true, force: true });
  const common = { status: 'failed', runId: selection?.run.id ?? null,
    generatedAt: prior.generatedAt ?? null, expiresAt: prior.expiresAt ?? null, reason };
  const leagues = {};
  for (const league of LEAGUES) {
    leagues[league] = { status: 'failed', gameIds: [], gameCount: 0, generatedAt: common.generatedAt };
    await writeJson(path.join(leagueDir(root, league), 'status.json'), { ...common, league, gameIds: [], gameCount: 0 });
  }
  const manifest = { ...common, leagues, gameCount: 0 };
  await writeJson(path.join(root, 'manifest.json'), manifest);
  return manifest;
}

export function publicationRecord(sourceSha, selection, manifest, unavailableReason = null, publishedAt = null) {
  const footballWatermark = [publishedAt, unavailableReason ? null : manifest.generatedAt]
    .filter(value => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const identity = { sourceSha, footballWatermark, football: { artifactId: selection?.artifact.id ?? null,
    artifactDigest: selection?.artifact.digest ?? null, runId: selection?.run.id ?? null,
    runAttempt: selection?.run.run_attempt ?? null, sourceSha: selection?.run.head_sha ?? null,
    status: manifest.status, generatedAt: manifest.generatedAt, expiresAt: manifest.expiresAt,
    unavailableReason } };
  return { schemaVersion: 1, ...identity, publicationKey: sha256(JSON.stringify(identity)) };
}

export function assertNotOlder(manifest, publishedAt) {
  if (Number.isFinite(Date.parse(publishedAt))) {
    assert(Date.parse(manifest.generatedAt) >= Date.parse(publishedAt), '拒絕以較舊足球快照覆蓋已公開批次');
  }
}

export async function prepareFootball({ root, published = {}, select, load, loadPublished }) {
  const record = published.record;
  const publishedAt = [record?.footballWatermark, record?.football?.generatedAt, published.manifest?.generatedAt]
    .filter(value => Number.isFinite(Date.parse(value))).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  let selection = null, manifest, unavailableReason = null;
  try {
    selection = await select();
    assert(selection, '足球短期快照本次未取得');
    manifest = await load(selection);
    if (Number.isFinite(Date.parse(publishedAt)) && Date.parse(manifest.generatedAt) < Date.parse(publishedAt)
      && record?.football?.artifactId && loadPublished) {
      // A later upload may contain older data. Reuse the already-published artifact when available.
      selection = await loadPublished(record.football.artifactId);
      assert(selection, '已公開的較新足球 artifact 本次未取得');
      manifest = await load(selection);
    }
    assertNotOlder(manifest, publishedAt);
  } catch (error) {
    unavailableReason = String(error.message).slice(0, 1000);
    let prior = published.manifest || {};
    try { prior = await json(path.join(root, 'manifest.json')); } catch {}
    manifest = await failedSnapshot(root, unavailableReason, selection, prior);
  }
  return { selection, manifest, unavailableReason, publishedAt };
}

export async function readPublishedState(base, getJson) {
  const optional = async url => {
    try { return await getJson(url); }
    catch (error) {
      if (error.status === 404) return undefined;
      throw new Error(`無法確認已公開版本，暫停本次發布：${error.message}`);
    }
  };
  const [record, manifest] = await Promise.all([
    optional(`${base}/site-publication.json`), optional(`${base}/football/data/manifest.json`)
  ]);
  return { record, manifest };
}

export async function composeSite(root, footballRoot, output, record) {
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  const excluded = new Set(['.git', '.github', '.site', '.backup-site', '.site-publication', '.football-publish', '_baseline', 'backup-upload.zip']);
  for (const entry of await fs.readdir(root)) {
    if (excluded.has(entry)) continue;
    await fs.cp(path.join(root, entry), path.join(output, entry), { recursive: true,
      filter: source => path.relative(root, source).split(path.sep).join('/') !== 'football/data' });
  }
  await fs.mkdir(path.join(output, 'football'), { recursive: true });
  await fs.cp(footballRoot, path.join(output, 'football', 'data'), { recursive: true });
  try { record.liveStatusSha256 = sha256(await fs.readFile(path.join(output, 'live/data/status.json'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeJson(path.join(output, 'site-publication.json'), record);
  await fs.writeFile(path.join(output, '.nojekyll'), '');
}

export async function verifyPublic(base, expected, manifest, getJson, getText) {
  const live = await getJson(`${base}/site-publication.json`);
  assert(live.publicationKey === expected.publicationKey, '公開全站來源版本尚未一致');
  if (expected.liveStatusSha256) assert(sha256(await getText(`${base}/live/data/status.json`)) === expected.liveStatusSha256, '公開 MLB 狀態版本不一致');
  const footballBase = `${base}/football/data`, actual = await getJson(`${footballBase}/manifest.json`);
  assert(actual.status === manifest.status && actual.generatedAt === manifest.generatedAt
    && actual.expiresAt === manifest.expiresAt && String(actual.runId) === String(manifest.runId), '公開足球批次不一致');
  for (const [league, row] of Object.entries(manifest.leagues || {})) {
    const dir = league === 'eng.1' ? footballBase : `${footballBase}/leagues/${league}`;
    const status = await getJson(`${dir}/status.json`);
    assert(status.status === row.status && status.generatedAt === manifest.generatedAt
      && String(status.runId) === String(manifest.runId), `${league} 公開狀態不一致`);
    if (row.status === 'failed') continue;
    const overview = await getJson(`${dir}/overview.json`);
    assert(overview.generatedAt === manifest.generatedAt && overview.games.length === row.gameCount, `${league} 公開總覽不一致`);
    for (const id of row.gameIds) {
      const game = await getJson(`${dir}/games/${id}.json`);
      assert(String(game.target?.id) === String(id) && game.target.league === league
        && game.generatedAt === manifest.generatedAt, `${league}/${id} 公開身分或批次不一致`);
    }
  }
}

async function githubJson(route, repository, token) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${route}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(30000) });
  assert(response.ok, `GitHub ${route.split('?')[0]} HTTP ${response.status}`);
  return response.json();
}

async function currentArtifact(repository, token) {
  const artifacts = [];
  for (let page = 1; ; page++) {
    const result = await githubJson(`actions/artifacts?name=football-current&per_page=100&page=${page}`, repository, token);
    artifacts.push(...result.artifacts);
    if (result.artifacts.length < 100 || artifacts.length >= result.total_count) break;
  }
  return selectArtifact(artifacts, id => githubJson(`actions/runs/${id}`, repository, token), repository);
}

async function downloadArtifact(selection, root, work, repository, token) {
  await fs.mkdir(work, { recursive: true });
  const zip = path.join(work, 'football.zip');
  const data = execFileSync('gh', ['api', `repos/${repository}/actions/artifacts/${selection.artifact.id}/zip`], {
    env: { ...process.env, GH_TOKEN: token }, maxBuffer: 100 * 1024 * 1024 });
  if (selection.artifact.digest) assert(selection.artifact.digest === `sha256:${sha256(data)}`, '足球 artifact digest 不一致');
  await fs.writeFile(zip, data);
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
  assert(entries.every(name => !path.posix.isAbsolute(name) && !name.split('/').includes('..')), '足球 artifact 路徑無效');
  await fs.rm(root, { recursive: true, force: true }); await fs.mkdir(root, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zip, '-d', root]);
}

const publicFetch = async (url, text = false) => {
  const nonce = `${process.env.GITHUB_RUN_ID || 'local'}-${process.env.GITHUB_RUN_ATTEMPT || 1}`;
  const response = await fetch(`${url}?publication=${nonce}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const error = new Error(`公開回查 HTTP ${response.status}: ${url}`);
    error.status = response.status;
    throw error;
  }
  return text ? response.text() : response.json();
};

async function main() {
  const root = process.cwd(), repository = process.env.GITHUB_REPOSITORY;
  assert(/^[\w.-]+\/[\w.-]+$/.test(repository || ''), '缺少有效 GITHUB_REPOSITORY');
  const base = process.env.SITE_PUBLICATION_BASE_URL || `https://${repository.split('/')[0]}.github.io/${repository.split('/')[1]}`;
  const output = path.join(root, '.site'), footballRoot = path.join(root, '.football-publish');
  if (process.argv[2] === 'prepare') {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    assert(token, '缺少 Actions 讀取權限');
    const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const published = await readPublishedState(base, publicFetch);
    const previous = published.record;
    const { selection, manifest, unavailableReason, publishedAt } = await prepareFootball({
      root: footballRoot, published,
      select: () => currentArtifact(repository, token),
      loadPublished: async id => selectArtifact([await githubJson(`actions/artifacts/${id}`, repository, token)],
        runId => githubJson(`actions/runs/${runId}`, repository, token), repository),
      load: async selected => {
        await downloadArtifact(selected, footballRoot, path.join(root, '.site-publication'), repository, token);
        return validateSnapshot(footballRoot, selected, repository);
      }
    });
    const record = publicationRecord(sourceSha, selection, manifest, unavailableReason, publishedAt);
    record.publisherRunId = process.env.GITHUB_RUN_ID;
    record.publisherRunAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
    await composeSite(root, footballRoot, output, record);
    const publish = previous?.publicationKey !== record.publicationKey;
    if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
    console.log(JSON.stringify({ publish, ...record }));
  } else if (process.argv[2] === 'verify') {
    const expected = await json(path.join(output, 'site-publication.json'));
    const manifest = await json(path.join(output, 'football/data/manifest.json'));
    for (let attempt = 0; attempt < 20; attempt++) {
      try { await verifyPublic(base, expected, manifest, publicFetch, url => publicFetch(url, true)); console.log(JSON.stringify({ verified: true, ...expected })); return; }
      catch (error) { if (attempt === 19) throw error; console.log(`公開回查重試 ${attempt + 1}: ${error.message}`); await new Promise(resolve => setTimeout(resolve, 15000)); }
    }
  } else throw new Error('使用 prepare 或 verify');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
