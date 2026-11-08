import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const run = (cmd: string, args: string[]): string => {
  const result = spawnSync(cmd, args, {encoding: 'utf8', timeout: 120_000});
  assert.equal(result.status, 0, cmd + ' failed:\n' + result.stderr);
  return result.stdout;
};
const makeTone = (path: string, durationSeconds: number, frequency: number) => {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=' + frequency +
      ':sample_rate=48000:duration=' + durationSeconds,
    '-af', 'volume=-14dB', '-c:a', 'pcm_s16le', path,
  ]);
};
const makeVisual = (path: string, durationSeconds: number, fps = 30) => {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-f', 'lavfi', '-i',
    'color=c=#15262a:s=640x360:r=' + fps + ':d=' + durationSeconds,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', path,
  ]);
};
const inspect = (file: string) =>
  JSON.parse(run('ffprobe', [
    '-v', 'error', '-of', 'json', '-show_entries',
    'format=duration:stream=codec_type,codec_name,r_frame_rate',
    file,
  ])) as {
    streams: Array<{codec_type: string; codec_name: string; r_frame_rate?: string}>;
    format: {duration: string};
  };

test('TR and EN: real FFmpeg audio mixing and MP4 assembly without touching visual encoding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-mux-'));
  try {
    const assets = join(root, 'assets');
    await mkdir(join(assets, 'sfx'), {recursive: true});
    makeTone(join(assets, 'sfx', 'click.wav'), 0.3, 880);
    await writeFile(join(assets, 'click.asset.json'), JSON.stringify({
      schemaVersion: 1, id: 'test-click', title: 'Synthetic click',
      description: 'Generated test tone used only for automated FFmpeg QA',
      category: 'audio', tags: ['sfx', 'click'], reviewStatus: 'approved',
      rights: {origin: 'original', clearance: 'cleared', license: 'test-generated'},
      location: {kind: 'local', relativePath: 'sfx/click.wav'},
    }));

    for (const item of [
      {language: 'tr', durationMs: 3000, fps: 30, cueAtMs: 500, pitch: 220},
      {language: 'en', durationMs: 4000, fps: 60, cueAtMs: 1500, pitch: 330},
    ]) {
      const dir = join(root, item.language);
      await mkdir(join(dir, 'audio'), {recursive: true});
      makeTone(join(dir, 'audio', 'voice.wav'), item.durationMs / 1000, item.pitch);
      const visual = join(dir, 'visual.mp4');
      makeVisual(visual, item.durationMs / 1000, item.fps);
      const storyboard = {
        schemaVersion: 1,
        narration: {
          language: item.language, voicePath: 'audio/voice.wav',
          approvedScriptPath: 'script.md', transcriptPath: 'transcript.json',
        },
        fps: item.fps, durationMs: item.durationMs,
        beats: [{
          id: 'opening', startMs: 0, endMs: item.durationMs, cueSegmentIndex: 0,
          treatment: 'overlay', cueText: 'Original test tone, not real speech',
          source: {kind: 'generate', brief: 'A clean large infographic without web chrome'},
        }],
        soundCues: [{
          id: 'sound-one', assetId: 'test-click', atMs: item.cueAtMs,
          durationMs: 200, gainDb: -24, visualBeatId: 'opening',
        }],
      };
      const manifest = join(dir, 'storyboard.json');
      await writeFile(manifest, JSON.stringify(storyboard));
      const mixed = join(dir, 'mixed.wav');
      const final = join(dir, item.language + '-demo.mp4');
      const mix = JSON.parse(run(process.execPath, [
        '--import', 'tsx', 'scripts/mix-audio.ts',
        dir, manifest, assets, mixed,
      ])) as {effectCount: number; language: string};
      assert.equal(mix.effectCount, 1);
      assert.equal(mix.language, item.language);

      const assembled = JSON.parse(run(process.execPath, [
        '--import', 'tsx', 'scripts/assemble-video.ts',
        manifest, visual, mixed, final,
      ])) as {videoCodec: string; audioCodec: string; sourceVideoCopied: boolean};
      assert.equal(assembled.videoCodec, 'h264');
      assert.equal(assembled.audioCodec, 'aac');
      assert.equal(assembled.sourceVideoCopied, true);

      const output = inspect(final);
      assert.deepEqual(
        output.streams.map((s) => s.codec_name).sort(),
        ['aac', 'h264'],
      );
      assert.ok(Math.abs(Number(output.format.duration) * 1000 - item.durationMs) <= 100);
      assert.equal(
        output.streams.find((s) => s.codec_type === 'video')?.r_frame_rate,
        item.fps + '/1',
      );

      // No silent replacement on repeated run.
      const again = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/assemble-video.ts',
        manifest, visual, mixed, final,
      ], {encoding: 'utf8'});
      assert.notEqual(again.status, 0);
      assert.match(again.stderr, /Refusing to overwrite/);
    }
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('assembly rejects pre-audible video and mismatched timing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-mux-negative-'));
  try {
    const video = join(root, 'visual.mp4');
    const audio = join(root, 'audio.wav');
    const audibleVideo = join(root, 'audible.mp4');
    makeVisual(video, 2);
    makeTone(audio, 2, 220);
    run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-i', video, '-i', audio,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac',
      audibleVideo,
    ]);
    const storyboard = {
      schemaVersion: 1,
      narration: {
        language: 'tr', voicePath: 'audio/voice.wav',
        approvedScriptPath: 'script.md', transcriptPath: 'transcript.json',
      },
      durationMs: 2000, fps: 30,
      beats: [{
        id: 'first-beat', startMs: 0, endMs: 2000, treatment: 'overlay',
        cueSegmentIndex: 0, cueText: 'Synthetic test video',
        source: {kind: 'generate', brief: 'Render a simple color animation for QA'},
      }],
    };
    const manifest = join(root, 'storyboard.json');
    await writeFile(manifest, JSON.stringify(storyboard));
    const withAudio = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/assemble-video.ts',
      manifest, audibleVideo, audio, join(root, 'should-not-exist.mp4'),
    ], {encoding: 'utf8'});
    assert.notEqual(withAudio.status, 0);
    assert.match(withAudio.stderr, /Visual MP4 already contains audio/);

    await writeFile(manifest, JSON.stringify({
      ...storyboard, durationMs: 2600,
    }));
    const wrongTime = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/assemble-video.ts',
      manifest, video, audio, join(root, 'bad-time.mp4'),
    ], {encoding: 'utf8'});
    assert.notEqual(wrongTime.status, 0);
    assert.match(wrongTime.stderr, /differs from storyboard/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('assembly rejects irregular presentation timestamps despite a nominal 30 fps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-mux-vfr-'));
  try {
    const video = join(root, 'visual.mp4');
    run('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=s=160x90:r=30:d=2',
      '-vf', "select='lt(t,1)+not(mod(n,2))'", '-fps_mode', 'vfr',
      '-c:v', 'libx264', video,
    ]);
    const {streams, format} = inspect(video);
    assert.equal(streams[0].r_frame_rate, '30/1');
    const durationMs = Math.round(Number(format.duration) * 1000);
    const audio = join(root, 'audio.wav');
    makeTone(audio, durationMs / 1000, 220);
    const storyboard = join(root, 'storyboard.json');
    await writeFile(storyboard, JSON.stringify({
      schemaVersion: 1,
      narration: {voicePath: 'audio.wav', approvedScriptPath: 'script.md', transcriptPath: 'transcript.json'},
      durationMs, fps: 30,
      beats: [{
        id: 'opening', startMs: 0, endMs: durationMs, treatment: 'overlay',
        cueText: 'Synthetic test video', cueSegmentIndex: 0,
        source: {kind: 'generate', brief: 'Render a simple color animation for QA'},
      }],
    }));
    const output = join(root, 'final.mp4');
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/assemble-video.ts', storyboard, video, audio, output,
    ], {encoding: 'utf8'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Visual must have constant frame timing/);
    await assert.rejects(stat(output), {code: 'ENOENT'});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});


test('assembly rejects a single time-base tick offset on a 30fps frame grid', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-mux-pts-jitter-'));
  try {
    const video = join(root, 'visual.mp4');
    run('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=s=160x90:r=30:d=1',
      '-vf', "settb=expr=1/90000,setpts=N*3000+gte(N\\,1)",
      '-fps_mode', 'passthrough', '-enc_time_base', '1:90000',
      '-video_track_timescale', '90000', '-c:v', 'libx264', video,
    ]);
    const {streams, format} = inspect(video);
    assert.equal(streams[0].r_frame_rate, '30/1');
    const durationMs = Math.round(Number(format.duration) * 1000);
    const audio = join(root, 'audio.wav');
    makeTone(audio, durationMs / 1000, 220);
    const storyboard = join(root, 'storyboard.json');
    await writeFile(storyboard, JSON.stringify({
      schemaVersion: 1,
      narration: {voicePath: 'audio.wav', approvedScriptPath: 'script.md', transcriptPath: 'transcript.json'},
      durationMs, fps: 30,
      beats: [{
        id: 'opening', startMs: 0, endMs: durationMs, treatment: 'overlay',
        cueText: 'Synthetic video with a one-tick PTS shift', cueSegmentIndex: 0,
        source: {kind: 'generate', brief: 'Render a simple color animation for QA'},
      }],
    }));
    const output = join(root, 'final.mp4');
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', 'scripts/assemble-video.ts', storyboard, video, audio, output,
    ], {encoding: 'utf8'});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Visual must have constant frame timing/);
    await assert.rejects(stat(output), {code: 'ENOENT'});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
