import assert from 'node:assert/strict';
import test from 'node:test';
import {demoManifest} from '../src/examples/timeline';
import {getSceneWindows, getTotalFrames, manifestSchema} from '../src/manifest';

test('parses the versioned demo manifest', () => {
  const parsed = manifestSchema.parse(demoManifest);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.scenes.length, 2);
});

test('computes exact half-open frame boundaries in declared order', () => {
  assert.deepEqual(getSceneWindows(demoManifest), [
    {id: 'incoming', startFrame: 0, endFrameExclusive: 75},
    {id: 'processed', startFrame: 75, endFrameExclusive: 180},
  ]);
  assert.equal(getTotalFrames(demoManifest), 180);
});

test('scene order is determined only by array order', () => {
  const reversed = {...demoManifest, scenes: [...demoManifest.scenes].reverse()};
  assert.deepEqual(getSceneWindows(reversed).map(({id}) => id), ['processed', 'incoming']);
});

test('rejects zero, negative and fractional frame durations with precise paths', () => {
  for (const value of [0, -1, 1.5]) {
    const malformed = {
      ...demoManifest,
      scenes: [{...demoManifest.scenes[0], durationInFrames: value}],
    };
    const result = manifestSchema.safeParse(malformed);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.issues[0].path.join('.'), 'scenes.0.durationInFrames');
    }
  }
});

test('rejects duplicate scene identifiers and points to the repeated scene', () => {
  const malformed = {
    ...demoManifest,
    scenes: [demoManifest.scenes[0], {...demoManifest.scenes[1], id: 'incoming'}],
  };
  const result = manifestSchema.safeParse(malformed);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0].path.join('.'), 'scenes.1.id');
  }
});

test('rejects unknown types and malformed nested scene props', () => {
  const original = demoManifest.scenes[0];
  for (const block of [
    {...original, type: 'diffusion-video'},
    {...original, props: {...original.props, metrics: []}},
  ]) {
    assert.equal(
      manifestSchema.safeParse({...demoManifest, scenes: [block]}).success,
      false,
    );
  }
});

test('rejects unsupported manifest version and empty scenes', () => {
  assert.equal(manifestSchema.safeParse({...demoManifest, schemaVersion: 2}).success, false);
  assert.equal(manifestSchema.safeParse({...demoManifest, scenes: []}).success, false);
});

test('rejects total durations longer than 10 minutes', () => {
  const long = {
    ...demoManifest,
    scenes: Array.from({length: 11}, (_, index) => ({
      ...demoManifest.scenes[0],
      id: `scene-${index}`,
      durationInFrames: 1800,
    })),
  };
  const result = manifestSchema.safeParse(long);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0].path.join('.'), 'scenes');
  }
});


test('duplicate scene IDs always point to the original occurrence', () => {
  const malformed = {
    ...demoManifest,
    scenes: [
      demoManifest.scenes[0],
      {...demoManifest.scenes[1], id: 'incoming'},
      {...demoManifest.scenes[1], id: 'incoming'},
    ],
  };
  const result = manifestSchema.safeParse(malformed);
  assert.equal(result.success, false);
  if (!result.success) {
    const duplicates = result.error.issues.filter((issue) => issue.message.includes('Duplicate scene id'));
    assert.equal(duplicates.length, 2);
    assert.deepEqual(duplicates.map((issue) => issue.path.join('.')), ['scenes.1.id', 'scenes.2.id']);
    assert.ok(duplicates.every((issue) => issue.message.includes('first used by scene 1')));
  }
});
