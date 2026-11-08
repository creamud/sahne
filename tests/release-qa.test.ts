import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

const cli = fileURLToPath(new URL('../scripts/release-qa.ts', import.meta.url));
const mediaTools = ['ffmpeg', 'ffprobe'].every((tool) => spawnSync(tool, ['-version']).status === 0);

test('exports localized segment captions and flags real black and silent media', {
  skip: !mediaTools,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'sahne-release-'));
  const output = join(root, 'release-qa');
  const save = (name: string, data: unknown) => writeFile(join(root, name), JSON.stringify(data));
  const invoke = () => spawnSync(process.execPath, [...process.execArgv, cli, root], {encoding: 'utf8'});
  const board = (language: string, durationMs = 3000) => ({
    schemaVersion: 1, fps: 30, durationMs, language,
    narration: {voicePath: 'voice.wav', approvedScriptPath: 'script.md', transcriptPath: 'transcript.json', language},
    beats: [{
      id: 'sample-beat', startMs: 0, endMs: 3000, treatment: 'cutaway', cueText: 'Synthetic fixture',
      cueSegmentIndex: 0, source: {kind: 'generate', brief: 'Synthetic quality-assurance fixture'},
    }],
  });
  const transcript = (text: string, end = 1.125) => ({
    text, segments: [{start: 0.125, end, text}],
  });
  try {
    execFileSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=1920x1080:r=30:d=3',
      '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo:d=3',
      '-c:v', 'libx264', '-threads', '4', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-c:a', 'aac', join(root, 'final.mp4'),
    ]);
    for (const [lang, text] of [['tr', 'İş ışığı, görüntü ve ölçü.'], ['en', 'Motion & light.']]) {
      await save('storyboard.json', board(lang));
      await save('transcript.json', transcript(text));
      const result = invoke();
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout) as {state: string; flags: string[]};
      assert.equal(report.state, 'needs-human-review');
      assert.ok(report.flags.some((flag) => flag.includes('black_start:')));
      assert.ok(report.flags.some((flag) => flag.includes('silence_start:')));
      const srt = await readFile(join(output, 'captions.' + lang + '.srt'), 'utf8');
      const vtt = await readFile(join(output, 'captions.' + lang + '.vtt'), 'utf8');
      assert.ok(srt.includes('00:00:00,125 --> 00:00:01,125\n' + text));
      assert.ok(vtt.includes('00:00:00.125 --> 00:00:01.125\n' + text.replaceAll('&', '&amp;')));
      await rm(output, {recursive: true});
    }
    await save('transcript.json', transcript('Past the master timeline', 3.001));
    const outOfBounds = invoke();
    assert.equal(outOfBounds.status, 1);
    assert.match(outOfBounds.stderr, /exceeds the final audio\/video timeline/);

    await save('transcript.json', {
      text: 'Two overlapping captions',
      segments: [{start: 0, end: 1, text: 'First cue'}, {start: 0.9, end: 2, text: 'Second cue'}],
    });
    assert.match(invoke().stderr, /Caption 2 overlaps/);
    await save('storyboard.json', board('en', 3100));
    assert.match(invoke().stderr, /duration must match/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
