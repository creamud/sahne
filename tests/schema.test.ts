import assert from 'node:assert/strict';
import test from 'node:test';
import {sceneSchema} from '../src/schema';
import {demoScene} from '../src/examples/default';

test('accepts the example scene', () => {
  assert.equal(sceneSchema.parse(demoScene).schemaVersion, 1);
});

test('rejects out-of-range metrics', () => {
  assert.equal(
    sceneSchema.safeParse({...demoScene, metrics: [{label: 'A', value: 101}]}).success,
    false,
  );
});

test('rejects unknown schema versions', () => {
  assert.equal(sceneSchema.safeParse({...demoScene, schemaVersion: 2}).success, false);
});

test('rejects empty metric arrays', () => {
  assert.equal(sceneSchema.safeParse({...demoScene, metrics: []}).success, false);
});
