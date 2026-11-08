import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {lstat, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const cli = fileURLToPath(new URL('../scripts/review-packet.ts', import.meta.url));
const mediaTools = ['ffmpeg', 'ffprobe'].every((tool) => spawnSync(tool, ['-version']).status === 0);

test('builds a private revision-bound packet and preserves existing review notes', {
  skip: !mediaTools,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-review-'));
  const save = (name: string, value: unknown) => writeFile(join(root, name), JSON.stringify(value));
  const invoke = (revision: string, preview = 'cut.mp4') =>
    spawnSync(process.execPath, [...process.execArgv, cli, root, revision, preview], {encoding: 'utf8'});
  const project = {
    schemaVersion: 1, id: 'fixture-project', title: 'İlk bölüm',
    mode: 'sfx-only', language: 'tr', style: {channelId: 'fixture-channel', revision: 1},
    storyboardPath: 'storyboard.json',
  };
  try {
    await save('project.json', project);
    await save('channel.style.json', {
      schemaVersion: 1, channelId: 'fixture-channel', revision: 1, displayName: 'Fixture',
      visual: {
        palette: {background: '#000000', foreground: '#ffffff', accent: '#ff0000'},
        typography: {displayFont: 'Montserrat', bodyFont: 'Montserrat', minimumReadablePxAt1080p: 44},
        motion: 'restrained', chromePolicy: 'none',
      },
    });
    await save('storyboard.json', {
      schemaVersion: 1, language: 'tr', fps: 30, durationMs: 3000,
      beats: ['Açılış', 'Görsel | vurgu', '<Kapanış>'].map((cueText, index) => ({
        id: 'shot-' + (index + 1), startMs: index * 1000, endMs: (index + 1) * 1000,
        treatment: 'cutaway', cueText, source: {kind: 'generate', brief: 'Synthetic reviewer fixture'},
      })),
      soundCues: [{id: 'sample-sound', assetId: 'sample-audio', atMs: 0, durationMs: 100, gainDb: -18}],
    });
    const makeClip = (name: string, duration: number) => execFileSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=' + duration,
      '-c:v', 'libx264', join(root, name),
    ]);
    makeClip('cut.mp4', 3);
    makeClip('short.mp4', 1);

    const rejected = invoke('bad-cut', 'short.mp4');
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /does not match the storyboard/);
    assert.ok(!(await readdir(root)).includes('review-bad-cut'));
    assert.equal(invoke('../outside').status, 1);

    const result = invoke('episode-r01');
    assert.equal(result.status, 0, result.stderr);
    const output = join(root, 'review-episode-r01');
    const info = JSON.parse(result.stdout) as {sha256: string; sampledStills: number};
    const notes = join(output, 'REVIEW.md');
    const packet = await readFile(notes, 'utf8');
    assert.equal(info.sampledStills, 3);
    assert.ok(packet.includes(info.sha256));
    assert.ok(packet.includes('00:01.000–00:02.000'));
    assert.ok(packet.includes('Görsel \\| vurgu'));
    assert.ok(packet.includes('&lt;Kapanış&gt;'));
    assert.match(packet, /Needs human review/);
    assert.deepEqual(await readFile(join(output, 'preview.mp4')), await readFile(join(root, 'cut.mp4')));
    assert.ok((await lstat(join(output, 'shot-003.jpg'))).size > 0);

    await writeFile(notes, packet + '\nReviewer notes');
    assert.equal(invoke('episode-r01').status, 1);
    assert.match(await readFile(notes, 'utf8'), /Reviewer notes/);
    assert.equal(invoke('episode-r02').status, 0);
    assert.doesNotMatch(await readFile(join(root, 'review-episode-r02', 'REVIEW.md'), 'utf8'), /Reviewer notes/);

    await save('project.json', {...project, style: {...project.style, revision: 2}});
    assert.match(invoke('bad-style').stderr, /style pin do not match/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
