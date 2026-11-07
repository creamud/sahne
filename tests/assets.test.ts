import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assetSchema, searchAssets, type AssetRecord} from '../src/assets/catalog';
import {loadAssetCatalog} from '../src/assets/store';

const approved: AssetRecord = assetSchema.parse({
  schemaVersion: 1,
  id: 'client-request-flow-v1',
  title: 'Client-server request flow',
  description: 'Animated HTTP request and response for networking explainers',
  category: 'motion-graphic',
  tags: ['networking', 'http', 'request', 'response'],
  reviewStatus: 'approved',
  rights: {
    origin: 'original',
    clearance: 'cleared',
    license: 'creator-owned',
  },
  location: {
    kind: 'local',
    relativePath: 'client-request-flow-v1/renders/overlay.webm',
  },
  aspectRatio: '16:9',
  durationMs: 6000,
});

test('accepts a fully documented approved asset and normalizes tags', () => {
  const result = assetSchema.parse({...approved, tags: ['Networking', 'http']});
  assert.deepEqual(result.tags, ['networking', 'http']);
  assert.equal(result.id, approved.id);
});

test('rejects unapproved rights, invalid paths and missing provenance', () => {
  assert.equal(assetSchema.safeParse({
    ...approved, rights: {...approved.rights, clearance: 'review-needed'},
  }).success, false);
  assert.equal(assetSchema.safeParse({
    ...approved, location: {kind: 'local', relativePath: '../private'},
  }).success, false);
  assert.equal(assetSchema.safeParse({...approved, rights: undefined}).success, false);
  assert.equal(assetSchema.safeParse({...approved, unexpected: true}).success, false);
  for (const path of ['C:/outside/asset.webm', 'D:\\\\outside.asset', '/absolute/asset.webm']) {
    assert.equal(assetSchema.safeParse({
      ...approved, location: {kind: 'local', relativePath: path},
    }).success, false, path);
    assert.equal(assetSchema.safeParse({...approved, editableSource: path}).success, false, path);
  }
});

test('rejects duplicate tags after case normalization', () => {
  const result = assetSchema.safeParse({...approved, tags: ['networking', 'NETWORKING']});
  assert.equal(result.success, false);
});

test('searches multiple terms across tags, title and description without case sensitivity', () => {
  const others: AssetRecord = {
    ...approved,
    id: 'memory-cache-v1',
    title: 'CPU cache memory',
    tags: ['cpu', 'cache'],
    description: 'Memory hierarchy',
  };
  assert.deepEqual(
    searchAssets([others, approved], 'HTTP Client').map((asset) => asset.id),
    ['client-request-flow-v1'],
  );
  assert.deepEqual(searchAssets([approved, others], 'database'), []);
  assert.deepEqual(searchAssets([approved, others], '...'), []);
  assert.deepEqual(searchAssets([approved, others], ''), []);
});

test('search excludes drafts and uncleared assets unless explicitly requested', () => {
  const draft = {...approved, id: 'draft-b-roll', reviewStatus: 'draft' as const};
  const notCleared = {
    ...approved,
    id: 'licensed-preview',
    reviewStatus: 'draft' as const,
    rights: {...approved.rights, clearance: 'review-needed' as const},
  };
  assert.deepEqual(
    searchAssets([draft, notCleared, approved], 'request').map((asset) => asset.id),
    ['client-request-flow-v1'],
  );
  assert.equal(
    searchAssets([draft, notCleared, approved], 'request', {includeUnapproved: true}).length,
    3,
  );
});

test('loads nested .asset.json files and rejects duplicate stable IDs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sahne-assets-'));
  try {
    await mkdir(join(dir, 'nested'));
    await writeFile(join(dir, 'a.asset.json'), JSON.stringify(approved));
    assert.deepEqual(
      (await loadAssetCatalog(dir)).map((asset) => asset.id),
      [approved.id],
    );

    await writeFile(join(dir, 'nested', 'b.asset.json'), JSON.stringify(approved));
    await assert.rejects(loadAssetCatalog(dir), /Duplicate asset ID/);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('reports the source file of invalid metadata', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sahne-invalid-assets-'));
  try {
    await writeFile(join(dir, 'bad.asset.json'), JSON.stringify({...approved, id: 'Invalid'}));
    await assert.rejects(loadAssetCatalog(dir), /bad\.asset\.json.*Invalid asset|Invalid asset metadata in .*bad\.asset\.json/);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('ignores OS metadata and symlinked directories, but rejects linked sidecar files', async () => {
  const catalog = await mkdtemp(join(tmpdir(), 'sahne-symlink-test-'));
  const outside = await mkdtemp(join(tmpdir(), 'sahne-outside-'));
  try {
    await writeFile(join(catalog, 'good.asset.json'), JSON.stringify(approved));
    await writeFile(join(catalog, '._appledouble.asset.json'), 'not JSON');
    await writeFile(join(outside, 'unseen.asset.json'), JSON.stringify({
      ...approved, id: 'outside-record',
    }));
    await symlink(outside, join(catalog, 'linked-directory'), 'dir');
    assert.deepEqual((await loadAssetCatalog(catalog)).map((record) => record.id), [approved.id]);

    await symlink(join(outside, 'unseen.asset.json'), join(catalog, 'linked.asset.json'), 'file');
    await assert.rejects(loadAssetCatalog(catalog), /Symlinked asset sidecar is not supported/);
  } finally {
    await rm(catalog, {recursive: true, force: true});
    await rm(outside, {recursive: true, force: true});
  }
});

test('search tie-breakers are deterministic code-point order', () => {
  const first = {...approved, id: 'beta-clip', title: 'beta'};
  const second = {...approved, id: 'alpha-clip', title: 'Alpha'};
  assert.deepEqual(
    searchAssets([first, second], 'request').map(({id}) => id),
    ['alpha-clip', 'beta-clip'],
  );
});

test('ASCII search is stable when the runtime locale differs', () => {
  const interview = {
    ...approved, id: 'interview-clip', title: 'Interview',
    description: 'Voice interview', tags: ['spoken'],
  };
  assert.deepEqual(searchAssets([interview], 'interview').map(({id}) => id), ['interview-clip']);
});
