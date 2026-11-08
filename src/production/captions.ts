import {normalizeAvenoxTranscript} from './transcript';
import {storyboardSchema} from './storyboard';

export type CaptionCue = {
  startMs: number;
  endMs: number;
  text: string;
};

const formatTime = (ms: number, separator: '.' | ','): string => {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor(ms / 60_000) % 60;
  const seconds = Math.floor(ms / 1_000) % 60;
  const millis = ms % 1_000;
  return String(hours).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0') + separator +
    String(millis).padStart(3, '0');
};

const wrapText = (raw: string): string => {
  // Plain captions: do not accidentally interpret ASR output as SRT/VTT markup.
  const clean = raw.replace(/\s+/gu, ' ').trim()
    .replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
  const words = clean.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (word.length > 42) {
      throw new Error('Caption contains a word longer than 42 characters; review transcript text');
    }
    if (line && line.length + word.length + 1 > 42) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 2) {
    throw new Error(
      'Caption segment would exceed two 42-character lines; split and retime the corrected transcript',
    );
  }
  return lines.join('\n');
};

/**
 * Export *corrected segment-level* captions; don't invent word timing,
 * sentence split timing or SFX-only speech.
 */
export const createCaptionSidecars = (
  storyboardInput: unknown,
  rawTranscriptInput: unknown,
): {srt: string; vtt: string; cueCount: number; durationMs: number} => {
  const board = storyboardSchema.parse(storyboardInput);
  if (!board.narration) {
    throw new Error('Caption export requires actual recorded/imported narration and a corrected transcript');
  }
  const transcript = normalizeAvenoxTranscript(rawTranscriptInput);
  const cues: CaptionCue[] = [];
  let previousEnd = 0;

  for (const segment of transcript.segments) {
    if (segment.startMs < previousEnd) {
      throw new Error('Caption segments overlap at index ' + segment.index +
        '; review the actual recording and correct timestamps');
    }
    if (segment.endMs > board.durationMs) {
      throw new Error('Caption segment ' + segment.index + ' exceeds the video timeline');
    }
    const text = wrapText(segment.text);
    cues.push({startMs: segment.startMs, endMs: segment.endMs, text});
    previousEnd = segment.endMs;
  }

  const srt = cues.map((cue, i) =>
    String(i + 1) + '\n' +
    formatTime(cue.startMs, ',') + ' --> ' + formatTime(cue.endMs, ',') +
    '\n' + cue.text + '\n',
  ).join('\n') + '\n';
  const vtt = 'WEBVTT\n\n' + cues.map((cue) =>
    formatTime(cue.startMs, '.') + ' --> ' + formatTime(cue.endMs, '.') +
    '\n' + cue.text + '\n',
  ).join('\n') + '\n';

  return {srt, vtt, cueCount: cues.length, durationMs: board.durationMs};
};
