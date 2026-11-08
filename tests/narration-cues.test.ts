import assert from 'node:assert/strict';
import {test} from 'node:test';
import {demoManifest} from '../src/examples/timeline';
import {getNarrationCue, getTotalFrames, manifestSchema} from '../src/manifest';

const cues = [
  {startMs: 0, endMs: 1033, text: 'Birinci vuruş'},
  {startMs: 1033, endMs: 2500, text: 'İkinci vuruş'},
  {startMs: 2500, endMs: 6000, text: 'Üçüncü vuruş'},
];
const input = { ...demoManifest, narration: {audioPath: 'voice/demo.wav', cues} };

test('optional narration preserves frame count and uses absolute half-open cue boundaries', () => {
  const manifest = manifestSchema.parse(input);
  assert.equal(getTotalFrames(manifest), getTotalFrames(demoManifest));
  assert.equal(getNarrationCue(manifest, 30)?.text, cues[0].text);
  assert.equal(getNarrationCue(manifest, 31)?.text, cues[1].text);
  assert.equal(getNarrationCue(manifest, 74)?.text, cues[1].text);
  assert.equal(getNarrationCue(manifest, 75)?.text, cues[2].text);
  assert.equal(getNarrationCue(manifest, 180), undefined);
  assert.equal(getNarrationCue(demoManifest, 31), undefined);
  assert.equal(manifestSchema.parse({
    ...input, narration: {...input.narration, showCaptions: false},
  }).narration?.showCaptions, false);
});

test('rejects overlapping, unordered, subframe and out-of-timeline cues', () => {
  for (const invalid of [
    [cues[0], {...cues[1], startMs: 1000}],
    [cues[1], cues[0]],
    [{startMs: 0, endMs: 1, text: 'Too short'}],
    [{startMs: 5950, endMs: 6001, text: 'Too late'}],
  ]) {
    const result = manifestSchema.safeParse({...input, narration: {...input.narration, cues: invalid}});
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.issues[0].path[0], 'narration');
  }
});

test('rejects remote or traversing voice paths', () => {
  for (const audioPath of ['https://example.com/a.wav', '../voice.wav', '/tmp/voice.wav', 'data:audio/wav,abc']) {
    assert.equal(manifestSchema.safeParse({...input, narration: {...input.narration, audioPath}}).success, false);
  }
});
