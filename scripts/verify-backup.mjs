import fs from 'node:fs/promises';

const expected = JSON.parse(await fs.readFile('.backup-site/backup-source.json', 'utf8'));
const base = process.env.SITE_PUBLICATION_BASE_URL || 'https://yuncai101-fallback.pages.dev';
const get = async file => {
  const response = await fetch(`${base}/${file}?verify=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${file} HTTP ${response.status}`);
  return response.json();
};
const [source, football, baseball, publication] = await Promise.all([
  get('backup-source.json'), get('football/data/manifest.json'),
  get('live/data/status.json'), get('site-publication.json')
]);
if (source.publicationKey !== expected.publicationKey || source.mainSha !== expected.mainSha
  || source.navigationCandidateSha !== expected.navigationCandidateSha
  || String(source.footballRunId) !== String(football.runId)
  || source.footballGeneratedAt !== football.generatedAt
  || source.footballExpiresAt !== football.expiresAt
  || String(source.baseballRunId) !== String(baseball.runId)
  || publication.publicationKey !== expected.publicationKey
  || Date.parse(football.expiresAt) <= Date.now()) throw new Error('公開備援來源、批次或有效期不一致');
console.log(JSON.stringify({ verified: true, mainSha: source.mainSha,
  footballRunId: football.runId, footballGeneratedAt: football.generatedAt,
  footballExpiresAt: football.expiresAt, baseballRunId: baseball.runId,
  publicationKey: publication.publicationKey }));
