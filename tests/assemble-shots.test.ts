import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const cli = fileURLToPath(new URL('../scripts/assemble-shots.ts', import.meta.url));
const ffmpeg = (...args: string[]) => execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', ...args]);
const hasMediaTools = ['ffmpeg', 'ffprobe'].every((cmd) => spawnSync(cmd, ['-version']).status === 0);

test('resumes three heterogeneous shots, invalidates only changed media, and keeps exact timing', {
  skip: !hasMediaTools,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-shots-'));
  const save = (name: string, value: unknown) => writeFile(join(root, name), JSON.stringify(value));
  const invoke = () => spawnSync(process.execPath, [...process.execArgv, cli, root], {encoding: 'utf8'});
  const rights = {origin: 'original', clearance: 'cleared', license: 'Synthetic test fixture'};
  try {
    await mkdir(join(root, 'catalog'));
    await save('project.json', {
      schemaVersion: 1, id: 'fixture-project', title: 'Three shot fixture',
      style: {channelId: 'fixture-channel', revision: 1},
      mode: 'sfx-only', storyboardPath: 'storyboard.json',
    });
    await save('channel.style.json', {
      schemaVersion: 1, channelId: 'fixture-channel', revision: 1, displayName: 'Fixture',
      visual: {
        palette: {background: '#000000', foreground: '#ffffff', accent: '#ff0000'},
        typography: {displayFont: 'Montserrat', bodyFont: 'Montserrat', minimumReadablePxAt1080p: 44},
        motion: 'restrained', chromePolicy: 'none',
      },
    });
    const storyboard = {
      schemaVersion: 1, fps: 30, durationMs: 3000,
      beats: [
        {id: 'motion', startMs: 0, endMs: 1033, treatment: 'cutaway', cueText: 'Motion',
          source: {kind: 'generate', brief: 'Synthetic motion graphic for the integration fixture'}},
        {id: 'still', startMs: 1033, endMs: 2100, treatment: 'cutaway', cueText: 'Still',
          source: {kind: 'asset', assetId: 'fixture-still'}},
        {id: 'b-roll', startMs: 2100, endMs: 3000, treatment: 'cutaway', cueText: 'B-roll',
          source: {kind: 'asset', assetId: 'fixture-b-roll'}},
      ],
      soundCues: [{id: 'fixture-cue', assetId: 'fixture-audio', atMs: 0, durationMs: 100, gainDb: -18}],
    };
    await save('storyboard.json', storyboard);
    await save('shots.json', {shots: {
      motion: {file: 'motion.mp4', renderer: 'synthetic-motion-v1'},
      still: {file: 'catalog/still.png', renderer: 'fixture-still-v1'},
      'b-roll': {file: 'catalog/b-roll.mp4', renderer: 'fixture-stock-v1'},
    }});
    for (const [id, category, relativePath] of [
      ['fixture-still', 'still-image', 'still.png'],
      ['fixture-b-roll', 'b-roll', 'b-roll.mp4'],
      ['fixture-audio', 'audio', 'cue.wav'],
    ]) {
      await save('catalog/' + id + '.asset.json', {
        schemaVersion: 1, id, title: id, description: 'Synthetic integration test asset',
        category, tags: ['test'], reviewStatus: 'approved', rights,
        location: {kind: 'local', relativePath},
      });
    }
    ffmpeg('-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=24:d=1.3', '-c:v', 'libx264', join(root, 'motion.mp4'));
    ffmpeg('-f', 'lavfi', '-i', 'color=green:s=320x180', '-frames:v', '1', join(root, 'catalog/still.png'));
    ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=430:duration=3:sample_rate=48000', join(root, 'master.wav'));
    ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=430:duration=0.1:sample_rate=48000', join(root, 'catalog/cue.wav'));

    const failed = invoke();
    assert.equal(failed.status, 1, failed.stderr);
    assert.match(failed.stdout, /motion: rendered\nstill: rendered/);
    assert.match(failed.stderr, /Shot b-roll/);
    ffmpeg('-f', 'lavfi', '-i', 'color=blue:s=640x360:r=25:d=1.2', '-c:v', 'libx264', join(root, 'catalog/b-roll.mp4'));

    const resumed = invoke();
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.match(resumed.stdout, /motion: reused\nstill: reused\nb-roll: rendered/);
    const report = JSON.parse(resumed.stdout.slice(resumed.stdout.indexOf('{')));
    const inspect = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration',
      '-of', 'json', report.output,
    ], {encoding: 'utf8'}));
    assert.equal(inspect.format.duration, '3.000000');
    assert.deepEqual(inspect.streams.map(({codec_name}: {codec_name: string}) => codec_name), ['h264', 'aac']);
    assert.equal(inspect.streams[0].nb_frames, '90');
    assert.equal(inspect.streams[0].r_frame_rate, '30/1');
    assert.equal(inspect.streams[0].width, 1920);
    assert.equal(inspect.streams[0].height, 1080);
    assert.ok((await readFile(report.output)).length > 0);
    const pixel = (at: string) => execFileSync('ffmpeg', [
      '-v', 'error', '-ss', at, '-i', report.output, '-frames:v', '1',
      '-vf', 'crop=2:2:960:540,format=rgb24', '-f', 'rawvideo', 'pipe:1',
    ]);
    const still = pixel('1.5');
    const bRoll = pixel('2.5');
    assert.ok(still[1] > 100 && still[0] < 30 && still[2] < 30);
    assert.ok(bRoll[2] > 200 && bRoll[0] < 30 && bRoll[1] < 30);
    const unchanged = invoke();
    assert.equal(unchanged.status, 0, unchanged.stderr);
    assert.match(unchanged.stdout, /motion: reused\nstill: reused\nb-roll: reused/);

    ffmpeg('-f', 'lavfi', '-i', 'color=red:s=320x180', '-frames:v', '1', join(root, 'catalog/still.png'));
    const updated = invoke();
    assert.equal(updated.status, 0, updated.stderr);
    assert.match(updated.stdout, /motion: reused\nstill: rendered\nb-roll: reused/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
