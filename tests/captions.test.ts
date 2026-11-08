import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCaptionSidecars} from '../src/production/captions';

const board = {
  schemaVersion: 1, fps: 30, durationMs: 7200, language: 'tr',
  narration: {
    voicePath: 'audio/voice.wav', language: 'tr',
    approvedScriptPath: 'approved-script.md', transcriptPath: 'transcript.json',
  },
  beats: [{
    id: 'intro', startMs: 0, endMs: 7200, treatment: 'cutaway',
    cueSegmentIndex: 0, cueText: 'A human-transcribed passage',
    source: {kind: 'generate', brief: 'Large clear text describing a network packet'},
  }],
};

const transcript = {
  text: 'İstemci bir istek gönderir. Sunucu yanıt verir.',
  segments: [
    {start: 0.250, end: 3.100, text: 'İstemci bir istek gönderir.'},
    {start: 3.350, end: 7.000, text: 'Sunucu yanıt verir.'},
  ],
};

test('exports exact, readable TR SRT/VTT with valid milliseconds and Unicode', () => {
  const result = createCaptionSidecars(board, transcript);
  assert.equal(result.cueCount, 2);
  assert.equal(result.durationMs, 7200);
  assert.match(result.srt, /1\n00:00:00,250 --> 00:00:03,100\nİstemci bir istek gönderir\./);
  assert.match(result.srt, /2\n00:00:03,350 --> 00:00:07,000\nSunucu yanıt verir\./);
  assert.match(result.vtt, /^WEBVTT\n\n00:00:00\.250 --> 00:00:03\.100\nİstemci/u);
  assert.doesNotMatch(result.srt, /\[\d+:\d+\]/);
});

test('rejects overlapping segments, out-of-timeline speech and invented captions', () => {
  assert.throws(() => createCaptionSidecars(board, {
    ...transcript,
    segments: [
      transcript.segments[0],
      {...transcript.segments[1], start: 3},
    ],
  }), /overlap/);
  assert.throws(() => createCaptionSidecars(board, {
    ...transcript,
    segments: [{start: 4, end: 8, text: 'Too late'}],
  }), /exceeds/);
  assert.throws(() => createCaptionSidecars({
    ...board, narration: undefined, soundCues: [{
      id: 'click', assetId: 'click-one', atMs: 100, durationMs: 100, gainDb: -20,
    }],
  }, transcript), /requires actual recorded/);
  assert.throws(() => createCaptionSidecars(board, {
    ...transcript,
    segments: [{
      start: 0, end: 7,
      text: Array.from({length: 30}, () => 'anlatım').join(' '),
    }],
  }), /two 42-character lines/);
});

test('wraps long natural text without inventing timestamps or injecting markup', () => {
  const result = createCaptionSidecars({...board, durationMs: 9000}, {
    text: 'Example',
    segments: [{
      start: 1, end: 8,
      text: 'This is a slightly longer piece of text that wraps into two readable lines.',
    }],
  });
  const lines = result.srt.split('\n');
  assert.ok(lines.includes('This is a slightly longer piece of text'));
  assert.equal(lines[2].length <= 42, true);
  assert.equal(lines[3].length <= 42, true);
  const escaped = createCaptionSidecars(board, {
    text: 'Markup',
    segments: [{start: 0, end: 1, text: '<b>Hi</b> & welcome'}],
  });
  assert.match(escaped.srt, /&lt;b&gt;Hi&lt;\/b&gt; &amp; welcome/);
});

test('CLI writes private SRT and VTT sidecars once and never overwrites', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-captions-'));
  try {
    const storyboardFile = join(root, 'storyboard.json');
    const transcriptFile = join(root, 'transcript.json');
    const prefix = join(root, 'output', 'episode-tr');
    await writeFile(storyboardFile, JSON.stringify(board));
    await writeFile(transcriptFile, JSON.stringify(transcript));
    const args = [
      '--import', 'tsx', 'scripts/export-captions.ts',
      root, storyboardFile, prefix,
    ];
    const first = spawnSync(process.execPath, args, {encoding: 'utf8'});
    assert.equal(first.status, 0, first.stderr);
    const summary = JSON.parse(first.stdout) as {cueCount: number; paths: {srt: string; vtt: string}};
    assert.equal(summary.cueCount, 2);
    assert.match(await readFile(summary.paths.srt, 'utf8'), /İstemci/);
    assert.match(await readFile(summary.paths.vtt, 'utf8'), /WEBVTT/);
    const permissions = (await stat(summary.paths.srt)).mode & 0o777;
    assert.equal(permissions & 0o077, 0);
    const second = spawnSync(process.execPath, args, {encoding: 'utf8'});
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /Refusing to overwrite/);
  } finally {
    await rm(root, {force: true, recursive: true});
  }
});
