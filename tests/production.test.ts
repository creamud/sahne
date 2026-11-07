import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {assetSchema} from '../src/assets/catalog';
import {normalizeAvenoxTranscript} from '../src/production/transcript';
import {storyboardSchema, validateNarratedStoryboard} from '../src/production/storyboard';

const rawTranscript = {
  text: 'The client sends a request. The server processes it. The server responds.',
  segments: [
    {start: 0.2, end: 1.8, text: 'The client sends a request.'},
    {start: 2.0, end: 3.7, text: 'The server processes it.'},
    {start: 4.0, end: 5.9, text: 'The server responds.'},
  ],
};

const reusableAsset = assetSchema.parse({
  schemaVersion: 1,
  id: 'client-server-request-v1',
  title: 'Client/server request animation',
  description: 'Animated HTTP request and response',
  tags: ['networking', 'request'],
  category: 'motion-graphic',
  reviewStatus: 'approved',
  rights: {
    origin: 'original',
    clearance: 'cleared',
    license: 'creator-owned',
  },
  location: {kind: 'local', relativePath: 'client-server-request-v1/clip.webm'},
});

const storyboard = {
  schemaVersion: 1,
  narration: {
    voicePath: 'audio/voice-original.wav',
    approvedScriptPath: 'script.md',
    transcriptPath: 'transcript.json',
  },
  fps: 30,
  durationMs: 6200,
  beats: [
    {
      id: 'client-request',
      startMs: 300,
      endMs: 1600,
      cueSegmentIndex: 0,
      cueText: 'The client sends a request',
      treatment: 'overlay',
      source: {kind: 'asset', assetId: 'client-server-request-v1'},
    },
    {
      id: 'server-work',
      startMs: 2300,
      endMs: 3500,
      cueSegmentIndex: 1,
      cueText: 'The server processes it',
      treatment: 'cutaway',
      source: {kind: 'generate', brief: 'Visualize a request traveling through a server queue.'},
    },
  ],
};

test('normalizes Avenox segment seconds without inventing word timestamps', () => {
  const normalized = normalizeAvenoxTranscript(rawTranscript);
  assert.equal(normalized.granularity, 'segment');
  assert.equal(normalized.segments[0].startMs, 200);
  assert.equal(normalized.segments[0].endMs, 1800);
  assert.equal(normalized.segments[1].startMs, 2000);
  assert.equal(normalized.text, rawTranscript.text);
});

test('rejects reversed, unordered and near-zero audio transcript segments', () => {
  for (const segments of [
    [{start: 1.3, end: 1.1, text: 'wrong'}],
    [{start: 2, end: 3, text: 'second'}, {start: 1, end: 2, text: 'first'}],
    [{start: 1.0001, end: 1.0002, text: 'too precise for milliseconds'}],
  ]) {
    assert.throws(() => normalizeAvenoxTranscript({text: 'Test', segments}));
  }
});

test('accepts a narration-aligned storyboard with a cleared reused asset', () => {
  const {storyboard: result, transcript} =
    validateNarratedStoryboard(storyboard, rawTranscript, [reusableAsset]);
  assert.equal(result.beats.length, 2);
  assert.equal(transcript.granularity, 'segment');
});

test('rejects missing and unapproved asset references', () => {
  assert.throws(() => validateNarratedStoryboard(storyboard, rawTranscript, []), /missing asset/);
  const draft = {...reusableAsset, reviewStatus: 'draft' as const};
  assert.throws(
    () => validateNarratedStoryboard(storyboard, rawTranscript, [draft]),
    /unapproved\/uncleared asset/,
  );
});

test('rejects beat timing outside its referenced narration segment', () => {
  const changed = {
    ...storyboard,
    beats: [{...storyboard.beats[0], cueSegmentIndex: 2}, storyboard.beats[1]],
  };
  assert.throws(
    () => validateNarratedStoryboard(changed, rawTranscript, [reusableAsset]),
    /does not overlap/,
  );
  const missing = {
    ...storyboard,
    beats: [{...storyboard.beats[0], cueSegmentIndex: 99}, storyboard.beats[1]],
  };
  assert.throws(
    () => validateNarratedStoryboard(missing, rawTranscript, [reusableAsset]),
    /invalid cueSegmentIndex/,
  );
});

test('rejects overlapping, reversed and out-of-duration visual beats', () => {
  const overlap = {
    ...storyboard, beats: [
      storyboard.beats[0],
      {...storyboard.beats[1], startMs: 1500},
    ],
  };
  assert.equal(storyboardSchema.safeParse(overlap).success, false);
  const reversed = {
    ...storyboard, beats: [{...storyboard.beats[0], endMs: 100}],
  };
  assert.equal(storyboardSchema.safeParse(reversed).success, false);
  const tooLong = {...storyboard, beats: [
    {...storyboard.beats[0], endMs: 6500},
  ]};
  assert.equal(storyboardSchema.safeParse(tooLong).success, false);
  assert.throws(
    () => validateNarratedStoryboard({...storyboard, durationMs: 5000}, rawTranscript, [reusableAsset]),
    /Spoken transcript ends/,
  );
});

test('requires declared local media/script/transcript paths and unique IDs', () => {
  assert.equal(storyboardSchema.safeParse({
    ...storyboard, narration: {...storyboard.narration, voicePath: ''},
  }).success, false);
  assert.equal(storyboardSchema.safeParse({
    ...storyboard, narration: {...storyboard.narration, voicePath: 'C:/private.wav'},
  }).success, false);
  assert.equal(storyboardSchema.safeParse({
    ...storyboard, beats: [storyboard.beats[0], {...storyboard.beats[1], id: 'client-request'}],
  }).success, false);
});

test('CLI validates standalone private project metadata and identifies reused assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-storyboard-'));
  try {
    const transcriptFile = join(root, 'transcript.json');
    const storyboardFile = join(root, 'storyboard.json');
    await writeFile(transcriptFile, JSON.stringify(rawTranscript));
    await writeFile(storyboardFile, JSON.stringify(storyboard));
    await writeFile(join(root, 'fixture.asset.json'), JSON.stringify(reusableAsset));
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/validate-storyboard.ts', transcriptFile, storyboardFile, root],
      {encoding: 'utf8'},
    );
    assert.equal(result.status, 0, result.stderr);
    const response = JSON.parse(result.stdout);
    assert.equal(response.valid, true);
    assert.equal(response.transcriptGranularity, 'segment');
    assert.deepEqual(response.reusedAssetIds, ['client-server-request-v1']);

    const invalid = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/validate-storyboard.ts', transcriptFile, storyboardFile],
      {encoding: 'utf8'},
    );
    assert.equal(invalid.status, 1);
    assert.ok(JSON.parse(invalid.stderr).error.includes('Usage:'));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
