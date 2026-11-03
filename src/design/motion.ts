/**
 * All timing is a pure function of frame index and declared scene duration.
 * These helpers never depend on wall-clock time, timers or random state.
 */
export const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    throw new RangeError('Progress must be finite');
  }
  return Math.min(1, Math.max(0, value));
};

export const normalizedFrameProgress = (
  frame: number,
  startFrame: number,
  durationInFrames: number,
): number => {
  if (!Number.isFinite(frame)) {
    throw new RangeError('Frame must be finite');
  }
  if (!Number.isInteger(startFrame) || startFrame < 0) {
    throw new RangeError('Start frame must be a nonnegative integer');
  }
  if (!Number.isInteger(durationInFrames) || durationInFrames < 1) {
    throw new RangeError('Duration must be a positive integer');
  }
  return clamp01((frame - startFrame) / durationInFrames);
};

export const easeOutCubic = (progress: number): number =>
  1 - (1 - clamp01(progress)) ** 3;

export const getEnterExitMotion = (
  frame: number,
  totalFrames: number,
): {opacity: number; translateY: number} => {
  if (!Number.isInteger(totalFrames) || totalFrames < 1) {
    throw new RangeError('Scene must have at least one frame');
  }
  // Ultra-short cuts should display their content instead of a blank intro frame.
  if (totalFrames < 4) {
    return {opacity: 1, translateY: 0};
  }
  const introFrames = Math.max(1, Math.floor(totalFrames * 0.16));
  const outroFrames = Math.max(1, Math.floor(totalFrames * 0.12));
  const enter = easeOutCubic(normalizedFrameProgress(frame, 0, introFrames));
  const outroStart = Math.max(introFrames, totalFrames - outroFrames);
  const exit = normalizedFrameProgress(frame, outroStart, Math.max(1, totalFrames - outroStart));

  return {
    opacity: enter * (1 - exit),
    translateY: (1 - enter) * 32 - exit * 12,
  };
};

export const getMetricBarProgress = (
  frame: number,
  totalFrames: number,
  index: number,
  metricCount: number,
): number => {
  if (!Number.isInteger(totalFrames) || totalFrames < 1) {
    throw new RangeError('Scene must have at least one frame');
  }
  if (!Number.isInteger(metricCount) || metricCount < 1 || !Number.isInteger(index) || index < 0 || index >= metricCount) {
    throw new RangeError('Metric index/count are invalid');
  }
  if (totalFrames < 4) {
    return 1;
  }
  const stagger = Math.max(1, Math.floor(totalFrames * 0.045));
  const start = Math.min(totalFrames - 1, Math.floor(totalFrames * 0.20) + stagger * index);
  const end = Math.max(start + 1, Math.floor(totalFrames * 0.78));
  return easeOutCubic(normalizedFrameProgress(frame, start, end - start));
};
