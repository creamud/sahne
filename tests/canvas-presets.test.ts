import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canvasPresets, getCanvasPreset, tokens} from '../src/design/tokens';

test('selects landscape and Shorts by exact dimensions', () => {
  assert.equal(getCanvasPreset(1920, 1080), canvasPresets.landscape);
  assert.equal(getCanvasPreset(1080, 1920), canvasPresets.shorts);
  assert.deepEqual(canvasPresets.landscape.safeArea, tokens.safeArea);
  assert.equal(canvasPresets.landscape.contentScale, 1);
  assert.ok(canvasPresets.shorts.safeArea.vertical > tokens.safeArea.vertical);
  assert.ok(canvasPresets.shorts.contentScale < 1);
});

test('rejects unregistered sizes even when their aspect ratio matches', () => {
  for (const [width, height] of [[1080, 1080], [1280, 720], [720, 1280]]) {
    assert.throws(() => getCanvasPreset(width, height), /Unsupported canvas dimensions/);
  }
});
