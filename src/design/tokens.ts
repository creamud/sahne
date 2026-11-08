/** Shared 16:9 design tokens. Colors are intentionally independent of scene content. */
export const tokens = {
  fontFamily: 'Montserrat, Arial, Helvetica, sans-serif',
  colors: {
    background: '#0b1220',
    foreground: '#f8fafc',
    muted: '#a8b5c8',
    track: '#1e293b',
  },
  safeArea: {horizontal: 150, vertical: 105},
  fontSizes: {eyebrow: 24, title: 78, titleMedium: 68, titleCompact: 58, subtitle: 28, subtitleCompact: 24, metric: 34},
  maxTextLength: {titleRegular: 38, titleMedium: 60, subtitleRegular: 110},
  spacing: {eyebrowToTitle: 18, headerToMetrics: 54, metricGap: 26, metricGapDense: 18},
  metricBarHeight: 26,
} as const;

export const canvasPresets = {
  landscape: {width: 1920, height: 1080, safeArea: tokens.safeArea, contentScale: 1},
  shorts: {width: 1080, height: 1920, safeArea: {horizontal: 100, vertical: 185}, contentScale: 0.9},
} as const;

export const getCanvasPreset = (width: number, height: number) => {
  const preset = Object.values(canvasPresets).find((candidate) =>
    candidate.width === width && candidate.height === height,
  );
  if (!preset) throw new RangeError('Unsupported canvas dimensions: ' + width + '×' + height);
  return preset;
};

export const relativeLuminance = (hex: string): number => {
  if (!/^#[\da-fA-F]{6}$/.test(hex)) {
    throw new RangeError('Expected a six-digit CSS hex color');
  }
  const channels = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const contrastRatio = (a: string, b: string): number => {
  const left = relativeLuminance(a);
  const right = relativeLuminance(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
};
