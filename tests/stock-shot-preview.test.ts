import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const renderCli = fileURLToPath(new URL('../scripts/render-stock-shots.ts', import.meta.url));
const intakeCli = fileURLToPath(new URL('../scripts/stock-intake.ts', import.meta.url));
const toolsAvailable = ['ffmpeg', 'ffprobe'].every((command) => spawnSync(command, ['-version']).status === 0);
const command = (binary: string, args: string[]) =>
  spawnSync(binary, args, {encoding: 'utf8', timeout: 180_000});
const check = (binary: string, args: string[]) => {
  const result = command(binary, args);
  assert.equal(result.status, 0, binary + ' failed:\n' + result.stderr);
  return result.stdout;
};

test('reviewed still, stock clip and motion asset become a contiguous silent H.264 preview', {
  skip: !toolsAvailable,
  timeout: 180_000,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-stock-preview-'));
  const catalog = join(root, 'catalog');
  const sourceFile = join(root, 'source.json');
  const storyboardFile = join(root, 'storyboard.json');
  const output = join(root, 'preview.mp4');
  const source = {
    title: 'Synthetic media for technical QA', provider: 'Local test', creator: 'CI',
    sourceUrl: 'https://example.com/fixtures', license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  };
  const node = (script: string, args: string[]) =>
    command(process.execPath, [...process.execArgv, script, ...args]);
  const importMedia = (file: string) => {
    const result = node(intakeCli, ['import', catalog, file, sourceFile]);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout) as {id: string};
  };
  const review = (id: string) => {
    const result = node(intakeCli, ['review', catalog, id, 'approve', 'Synthetic CI reviewer']);
    assert.equal(result.status, 0, result.stderr);
  };
  const preview = (file = storyboardFile, outputPath = output) =>
    node(renderCli, [file, catalog, outputPath]);

  try {
    await writeFile(sourceFile, JSON.stringify(source));
    const image = join(root, 'still.png');
    const clip = join(root, 'stock.mp4');
    const motion = join(root, 'motion.mp4');
    check('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i',
      'color=c=red:s=320x180', '-frames:v', '1', image]);
    for (const [file, color] of [[clip, 'blue'], [motion, 'green']]) {
      check('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i',
        'color=c=' + color + ':s=320x180:r=30:d=1', '-an',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
    }
    const still = importMedia(image);
    const video = importMedia(clip);
    await mkdir(join(catalog, 'media'));
    const originalMotion = join(catalog, 'media', 'motion.mp4');
    const {copyFile} = await import('node:fs/promises');
    await copyFile(motion, originalMotion);
    await writeFile(join(catalog, 'motion.asset.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'original-motion-v1', title: 'Synthetic original motion',
      description: 'Generated solely for a technical validation test',
      category: 'motion-graphic', tags: ['motion', 'test'],
      reviewStatus: 'approved',
      rights: {origin: 'original', clearance: 'cleared', license: 'creator-owned'},
      location: {kind: 'local', relativePath: 'media/motion.mp4'},
    }));
    const storyboard = {
      schemaVersion: 1, fps: 30, durationMs: 3000, language: 'en',
      narration: {
        voicePath: 'audio/voice.wav', approvedScriptPath: 'script.md',
        transcriptPath: 'transcript.json',
      },
      beats: [
        {id: 'photo', startMs: 0, endMs: 1000, treatment: 'cutaway',
          cueText: 'Synthetic still', cueSegmentIndex: 0,
          source: {kind: 'asset', assetId: still.id}},
        {id: 'stock-video', startMs: 1000, endMs: 2000, treatment: 'cutaway',
          cueText: 'Synthetic B-roll', cueSegmentIndex: 1,
          source: {kind: 'asset', assetId: video.id}},
        {id: 'motion', startMs: 2000, endMs: 3000, treatment: 'overlay',
          cueText: 'Synthetic motion', cueSegmentIndex: 2,
          source: {kind: 'asset', assetId: 'original-motion-v1'}},
      ],
    };
    await writeFile(storyboardFile, JSON.stringify(storyboard));

    // An unattended agent cannot export preview footage from a draft candidate.
    const blocked = preview();
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /unapproved\/uncleared/);
    review(still.id);
    review(video.id);

    const rendered = preview();
    assert.equal(rendered.status, 0, rendered.stderr);
    const metadata = JSON.parse(rendered.stdout) as {
      frames: number; fps: number; assetIds: string[]; width: number; height: number;
    };
    assert.equal(metadata.frames, 90);
    assert.equal(metadata.fps, 30);
    assert.equal(metadata.width, 1920);
    assert.equal(metadata.height, 1080);
    assert.deepEqual(metadata.assetIds, [still.id, video.id, 'original-motion-v1']);
    assert.ok((await stat(output)).size > 1000);

    const probe = JSON.parse(check('ffprobe', [
      '-v', 'error', '-count_frames', '-show_entries',
      'stream=codec_name,codec_type,nb_read_frames,r_frame_rate,width,height:format=duration',
      '-of', 'json', output,
    ])) as {
      streams: Array<{codec_type: string; codec_name: string; nb_read_frames: string}>;
      format: {duration: string};
    };
    assert.equal(probe.streams.length, 1);
    assert.equal(probe.streams[0].codec_name, 'h264');
    assert.equal(Number(probe.streams[0].nb_read_frames), 90);
    assert.ok(Math.abs(Number(probe.format.duration) - 3) < 0.05);
    assert.match(preview().stderr, /Refusing to overwrite existing output/);

    await writeFile(storyboardFile, JSON.stringify({
      ...storyboard, beats: storyboard.beats.map((beat, index) =>
        index === 1 ? {...beat, startMs: 1100} : beat),
    }));
    assert.match(preview(storyboardFile, join(root, 'gap.mp4')).stderr,
      /gap or overlap|non-overlapping/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
