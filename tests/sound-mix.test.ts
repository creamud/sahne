import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, rm, symlink, writeFile, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const execute = (command: string, args: string[]) => {
  const result = spawnSync(command, args, {encoding: 'utf8', timeout: 120_000});
  assert.equal(result.status, 0, command + ' failed:\n' + result.stderr);
  return result.stdout;
};

const makeWav = (path: string, hz: number, duration: number) => {
  execute('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-f', 'lavfi',
    '-i', 'sine=frequency=' + hz + ':sample_rate=48000:duration=' + duration,
    '-af', 'volume=-10dB', '-ac', '1', '-c:a', 'pcm_s16le', path,
  ]);
};

test('FFmpeg mixes timed, rights-approved SFX with separate Turkish and English narration timelines', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-audio-'));
  try {
    const assetsDir = join(root, 'assets');
    await mkdir(join(assetsDir, 'soft-click'), {recursive: true});
    const asset = {
      schemaVersion: 1,
      id: 'soft-click',
      title: 'Synthetic click for integration QA',
      description: 'Locally synthesized sine beep for deterministic automated tests',
      category: 'audio',
      tags: ['click', 'ui'],
      reviewStatus: 'approved',
      rights: {origin: 'original', clearance: 'cleared', license: 'test-generated'},
      location: {kind: 'local', relativePath: 'soft-click/click.wav'},
      durationMs: 300,
    };
    makeWav(join(assetsDir, 'soft-click', 'click.wav'), 880, 0.3);
    await writeFile(join(assetsDir, 'click.asset.json'), JSON.stringify(asset));

    const rendered: Array<{language: string; duration: number; bytes: number}> = [];
    for (const entry of [
      {language: 'tr', durationMs: 7100, cueAtMs: 1550},
      {language: 'en', durationMs: 6200, cueAtMs: 650},
    ]) {
      const projectDir = join(root, entry.language);
      await mkdir(join(projectDir, 'audio'), {recursive: true});
      const inputWav = join(projectDir, 'audio', 'narration.wav');
      makeWav(inputWav, entry.language === 'tr' ? 220 : 330, entry.durationMs / 1000);
      // Matroska/FLAC commonly reports stream.duration as N/A while
      // format.duration remains valid. Verify that probeAudio falls back.
      const voiceFilename = entry.language === 'tr' ? 'narration.mka' : 'narration.wav';
      if (entry.language === 'tr') {
        const matroska = join(projectDir, 'audio', voiceFilename);
        execute('ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
          '-i', inputWav, '-c:a', 'flac', matroska,
        ]);
        const metadata = JSON.parse(execute('ffprobe', [
          '-v', 'error', '-show_entries', 'stream=duration:format=duration',
          '-of', 'json', matroska,
        ])) as {streams?: Array<{duration?: string}>; format?: {duration?: string}};
        assert.ok(!Number.isFinite(Number(metadata.streams?.[0]?.duration)));
        assert.ok(Number(metadata.format?.duration) > 0);
      }

      const storyboard = {
        schemaVersion: 1,
        narration: {
          language: entry.language,
          voicePath: 'audio/' + voiceFilename,
          approvedScriptPath: 'script.md',
          transcriptPath: 'transcript.json',
        },
        fps: 30,
        durationMs: entry.durationMs,
        beats: [{
          id: 'intro-beat', startMs: 0, endMs: entry.durationMs,
          cueSegmentIndex: 0, cueText: 'Synthetic spoken concept',
          treatment: 'overlay',
          source: {kind: 'generate', brief: 'Show large narrative text in channel colors.'},
        }],
        soundCues: [{
          id: 'intro-click', assetId: 'soft-click',
          atMs: entry.cueAtMs, durationMs: 220, gainDb: -18,
          visualBeatId: 'intro-beat',
        }],
      };
      const path = join(projectDir, 'storyboard.json');
      await writeFile(path, JSON.stringify(storyboard));
      const output = join(projectDir, 'outputs', 'narration-plus-sfx.wav');

      const summary = JSON.parse(execute(process.execPath, [
        '--import', 'tsx',
        'scripts/mix-audio.ts', projectDir, path, assetsDir, output,
      ])) as {language: string; effectCount: number; durationMs: number};
      assert.equal(summary.language, entry.language);
      assert.equal(summary.effectCount, 1);
      assert.ok(Math.abs(summary.durationMs - entry.durationMs) < 100);

      const probe = JSON.parse(execute('ffprobe', [
        '-v', 'error', '-of', 'json',
        '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels',
        output,
      ])) as {format: {duration: string}; streams: Array<{
        codec_name: string; sample_rate: string; channels: number;
      }>};
      assert.equal(probe.streams[0].codec_name, 'pcm_s24le');
      assert.equal(probe.streams[0].sample_rate, '48000');
      assert.equal(probe.streams[0].channels, 2);
      assert.ok(Math.abs(Number(probe.format.duration) * 1000 - entry.durationMs) < 100);
      assert.ok((await stat(output)).size > 300_000);
      rendered.push({
        language: entry.language,
        duration: Number(probe.format.duration),
        bytes: (await stat(output)).size,
      });

      // No surprise overwrites of rendered audio masters.
      const retry = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/mix-audio.ts', projectDir, path, assetsDir, output,
      ], {encoding: 'utf8'});
      assert.notEqual(retry.status, 0);
    }
    assert.notEqual(rendered[0].duration, rendered[1].duration);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('mix refuses symlinks and playlists that reference media outside the approved catalog', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-audio-escape-'));
  try {
    const projectDir = join(root, 'project');
    const assetsDir = join(root, 'catalog');
    const outside = join(root, 'outside.wav');
    await mkdir(join(projectDir, 'audio'), {recursive: true});
    await mkdir(join(assetsDir, 'fx'), {recursive: true});
    makeWav(join(projectDir, 'audio', 'voice.wav'), 220, 2);
    makeWav(outside, 880, 0.3);
    await symlink(outside, join(assetsDir, 'fx', 'linked.wav'));
    const asset = {
      schemaVersion: 1, id: 'linked-click', title: 'Linked test sound',
      description: 'Should never be allowed to escape local asset root',
      category: 'audio', tags: ['click'], reviewStatus: 'approved',
      rights: {origin: 'original', clearance: 'cleared', license: 'test-generated'},
      location: {kind: 'local', relativePath: 'fx/linked.wav'},
    };
    const sidecar = join(assetsDir, 'bad.asset.json');
    await writeFile(sidecar, JSON.stringify(asset));
    const storyboard = {
      schemaVersion: 1,
      narration: {language: 'tr', voicePath: 'audio/voice.wav',
        approvedScriptPath: 'script.md', transcriptPath: 'transcript.json'},
      fps: 30, durationMs: 2000,
      beats: [{id: 'example-beat', startMs: 0, endMs: 2000, treatment: 'overlay',
        cueText: 'Test', cueSegmentIndex: 0, source: {
          kind: 'generate', brief: 'Show a single large test visual.',
        }}],
      soundCues: [{id: 'bad-cue', assetId: 'linked-click',
        atMs: 500, durationMs: 150, gainDb: -20}],
    };
    const storyPath = join(projectDir, 'storyboard.json');
    await writeFile(storyPath, JSON.stringify(storyboard));
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/mix-audio.ts', projectDir, storyPath,
      assetsDir, join(projectDir, 'out.wav'),
    ], {encoding: 'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Media path escapes its catalog\/project root/);

    execute('ffmpeg', [
      '-v', 'error', '-i', outside, '-c:a', 'aac', '-f', 'mpegts', join(root, 'outside.ts'),
    ]);
    await writeFile(join(assetsDir, 'fx', 'playlist.m3u8'), [
      '#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:1',
      '#EXTINF:0.3,', '../../outside.ts', '#EXT-X-ENDLIST', '',
    ].join('\n'));
    await writeFile(sidecar, JSON.stringify({
      ...asset, location: {kind: 'local', relativePath: 'fx/playlist.m3u8'},
    }));
    const playlistResult = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/mix-audio.ts', projectDir, storyPath, assetsDir, join(projectDir, 'out.wav'),
    ], {encoding: 'utf8'});
    assert.equal(playlistResult.status, 1);
    assert.match(playlistResult.stderr, /not on whitelist/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('mix rejects narration with an audible tail inside the old duration tolerance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-audio-tail-'));
  try {
    const catalog = join(root, 'catalog');
    await mkdir(catalog);
    execute('ffmpeg', [
      '-v', 'error', '-f', 'lavfi',
      '-i', String.raw`aevalsrc=if(gte(t\,1)\,0.5*sin(2*PI*440*t)\,0):s=48000:d=1.09`,
      join(root, 'voice.wav'),
    ]);
    const storyPath = join(root, 'storyboard.json');
    await writeFile(storyPath, JSON.stringify({
      schemaVersion: 1,
      narration: {voicePath: 'voice.wav', approvedScriptPath: 'script.md', transcriptPath: 'transcript.json'},
      fps: 30, durationMs: 1000,
      beats: [{
        id: 'opening', startMs: 0, endMs: 1000, treatment: 'overlay',
        cueText: 'Synthetic narration tail', cueSegmentIndex: 0,
        source: {kind: 'generate', brief: 'Show a synthetic test visual.'},
      }],
    }));

    const output = join(root, 'mix.wav');
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/mix-audio.ts', root, storyPath, catalog, output,
    ], {encoding: 'utf8'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Recorded narration duration \(1090ms\) differs/);
    await assert.rejects(stat(output), {code: 'ENOENT'});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
