import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clamp01,
  easeOutCubic,
  getEnterExitMotion,
  getMetricBarProgress,
  normalizedFrameProgress,
} from '../src/design/motion';
import {contrastRatio, tokens} from '../src/design/tokens';

test('progress clamps before and after its frame interval', () => {
  assert.equal(normalizedFrameProgress(0, 30, 60), 0);
  assert.equal(normalizedFrameProgress(60, 30, 60), 0.5);
  assert.equal(normalizedFrameProgress(110, 30, 60), 1);
  assert.equal(clamp01(-100), 0);
  assert.equal(clamp01(10), 1);
});

test('progress and easing reject non-finite or invalid timing inputs', () => {
  assert.throws(() => clamp01(Number.NaN), RangeError);
  assert.throws(() => normalizedFrameProgress(Number.POSITIVE_INFINITY, 0, 60), RangeError);
  assert.throws(() => normalizedFrameProgress(12, -1, 60), RangeError);
  assert.throws(() => normalizedFrameProgress(12, 0, 0), RangeError);
  assert.throws(() => getEnterExitMotion(0, 0), RangeError);
  assert.throws(() => getMetricBarProgress(0, 60, 3, 3), RangeError);
});

test('ease-out remains within bounds and returns exact endpoints', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
});

test('entrance and exit are determined only by frame, including random access', () => {
  assert.equal(getEnterExitMotion(0, 180).opacity, 0);
  assert.equal(getEnterExitMotion(90, 180).opacity, 1);
  assert.ok(getEnterExitMotion(179, 180).opacity < 1);
  const atFrame = getEnterExitMotion(82, 180);
  getEnterExitMotion(147, 180);
  getEnterExitMotion(1, 180);
  assert.deepEqual(getEnterExitMotion(82, 180), atFrame);
});

test('metric bars finish before the scene ends, including short scenes', () => {
  for (const duration of [30, 75, 105, 180]) {
    for (let index = 0; index < 4; index += 1) {
      assert.equal(getMetricBarProgress(0, duration, index, 4), 0);
      assert.equal(getMetricBarProgress(duration - 1, duration, index, 4), 1);
    }
  }
});

test('default theme text and example accents have readable contrast', () => {
  const background = tokens.colors.background;
  assert.ok(contrastRatio(tokens.colors.foreground, background) >= 4.5);
  assert.ok(contrastRatio(tokens.colors.muted, background) >= 4.5);
  assert.ok(contrastRatio('#4cc9f0', background) >= 3);
  assert.ok(contrastRatio('#a78bfa', background) >= 3);
  assert.throws(() => contrastRatio('#zzz', background), RangeError);
});


test('single-frame scenes display meaningful content immediately', () => {
  assert.deepEqual(getEnterExitMotion(0, 1), {opacity: 1, translateY: 0});
  assert.equal(getMetricBarProgress(0, 1, 0, 1), 1);
});
