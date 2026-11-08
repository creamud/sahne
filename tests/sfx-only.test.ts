import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {channelStyleSchema, videoProjectSchema} from '../src/production/identity';
import {storyboardSchema, validateStoryboardAssets} from '../src/production/storyboard';

const run = (program: string, args: string[]) => {
  const result = spawnSync(program, args, {encoding: 'utf8', timeout: 120_000});
  assert.equal(result.status, 0, program + ': ' + result.stderr);
  return result.stdout;
};

const readJson = async (file: string): Promise<unknown> =>
  JSON.parse(await readFile(file, 'utf8')) as unknown;

test('SFX-only storyboard has independent language and needs no recorded voice or transcript', async () => {
  for (const language of ['tr', 'en']) {
    const manifest = await readJson(
      'examples/production/storyboard.sfx-only-' + language + '.sample.json',
    );
    const parsed = storyboardSchema.parse(manifest);
    assert.equal(parsed.narration, undefined);
    assert.equal(parsed.language, language);
    assert.equal(parsed.beats.length, 3);
    assert.equal(parsed.soundCues?.length, 4);
    const asset = await readJson(
      'examples/production/sound-catalog/synthetic-click.asset.json',
    );
    const accepted = validateStoryboardAssets(manifest, [asset as never]);
    assert.equal(accepted.durationMs, 14500);
  }
});

test('Montserrat is the current channel default but custom font profiles remain valid', async () => {
  const raw = await readJson('examples/identity/channel.style.json');
  const channel = channelStyleSchema.parse(raw);
  assert.equal(channel.visual.typography.displayFont, 'Montserrat');
  assert.equal(channel.visual.typography.bodyFont, 'Montserrat');
  assert.equal(channelStyleSchema.parse({
    ...channel, revision: channel.revision + 1,
    visual: {
      ...channel.visual,
      typography: {...channel.visual.typography, displayFont: 'Inter', bodyFont: 'Noto Sans'},
    },
  }).visual.typography.displayFont, 'Inter');

  const project = videoProjectSchema.parse(
    await readJson('examples/identity/video.sfx-only.project.json'),
  );
  assert.equal(project.mode, 'sfx-only');
  assert.equal(project.voicePath, undefined);
  assert.equal(project.language, 'tr');
  assert.equal(videoProjectSchema.safeParse({
    ...project, voicePath: 'audio/voice.wav',
  }).success, false);
  assert.equal(videoProjectSchema.safeParse({
    ...project, mode: 'narrated',
  }).success, false);
  assert.equal(videoProjectSchema.parse({
    ...project, mode: 'narrated', voicePath: 'audio/recording-from-other-source.wav',
  }).voicePath, 'audio/recording-from-other-source.wav');
});

test('voice provenance is optional: external narration is just a supplied local audio file', () => {
  const base = {
    schemaVersion: 1,
    language: 'en',
    narration: {
      language: 'en', voicePath: 'audio/external.wav', source: 'imported',
      approvedScriptPath: 'script.md', transcriptPath: 'transcript.json',
    },
    fps: 30, durationMs: 3000,
    beats: [{
      id: 'narrated-beat', startMs: 0, endMs: 3000, cueSegmentIndex: 0,
      treatment: 'overlay', cueText: 'Narrator audio from an imported WAV',
      source: {kind: 'generate', brief: 'One large simple title in Montserrat'},
    }],
  };
  assert.equal(storyboardSchema.parse(base).narration?.source, 'imported');
  assert.equal(storyboardSchema.safeParse({
    ...base,
    language: 'tr',
  }).success, false);
  assert.equal(storyboardSchema.safeParse({
    ...base,
    beats: [{...base.beats[0], cueSegmentIndex: undefined}],
  }).success, false);
  assert.equal(storyboardSchema.safeParse({
    ...base,
    narration: undefined,
  }).success, false);
});

test('real FFmpeg produces a full-duration TR SFX-only WAV and H264/AAC MP4 with no voice input', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-sfx-only-'));
  try {
    const project = join(root, 'project');
    const catalog = join(root, 'catalog');
    await mkdir(project, {recursive: true});
    await mkdir(join(catalog, 'synthetic-click-v1'), {recursive: true});
    const click = join(catalog, 'synthetic-click-v1', 'click.wav');
    run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
      '-i', 'sine=frequency=900:sample_rate=48000:duration=0.3',
      '-af', 'volume=-10dB', '-c:a', 'pcm_s16le', click,
    ]);
    const fixture = await readFile('examples/production/sound-catalog/synthetic-click.asset.json');
    await writeFile(join(catalog, 'synthetic-click.asset.json'), fixture);
    const manifest = join(project, 'storyboard.json');
    await writeFile(manifest, await readFile('examples/production/storyboard.sfx-only-tr.sample.json'));

    const validation = JSON.parse(run(process.execPath, [
      '--import', 'tsx', 'scripts/validate-storyboard.ts', '-', manifest, catalog,
    ])) as {mode: string; transcriptSegments: number; language: string};
    assert.equal(validation.mode, 'sfx-only');
    assert.equal(validation.transcriptSegments, 0);
    assert.equal(validation.language, 'tr');

    const mix = join(project, 'sound-only.wav');
    const rendered = JSON.parse(run(process.execPath, [
      '--import', 'tsx', 'scripts/mix-audio.ts', project, manifest, catalog, mix,
    ])) as {mode: string; effectCount: number; durationMs: number};
    assert.equal(rendered.mode, 'sfx-only');
    assert.equal(rendered.effectCount, 4);
    assert.equal(rendered.durationMs, 14500);

    const silentVideo = join(project, 'silent.mp4');
    run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
      '-i', 'color=c=#122026:s=640x360:r=30:d=14.5',
      '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', silentVideo,
    ]);
    const final = join(project, 'final.mp4');
    const result = JSON.parse(run(process.execPath, [
      '--import', 'tsx', 'scripts/assemble-video.ts', manifest, silentVideo, mix, final,
    ])) as {mode: string; language: string; audioCodec: string};
    assert.equal(result.mode, 'sfx-only');
    assert.equal(result.language, 'tr');
    assert.equal(result.audioCodec, 'aac');

    const ffprobe = JSON.parse(run('ffprobe', [
      '-v', 'error', '-of', 'json',
      '-show_entries', 'format=duration:stream=codec_name,codec_type',
      final,
    ])) as {
      format: {duration: string};
      streams: Array<{codec_name: string; codec_type: string}>;
    };
    assert.deepEqual(ffprobe.streams.map((s) => s.codec_name).sort(), ['aac', 'h264']);
    assert.ok(Math.abs(Number(ffprobe.format.duration) - 14.5) < 0.1);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
