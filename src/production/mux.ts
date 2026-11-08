import {spawn} from 'node:child_process';
import {lstat, realpath, stat} from 'node:fs/promises';
import {dirname, extname, resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import type {Storyboard} from './storyboard';

type Stream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  sample_rate?: string;
};
type ProbeResult = {
  streams?: Stream[];
  format?: {duration?: string};
};

const command = async (name: string, args: string[]): Promise<string> =>
  new Promise((done, fail) => {
    const child = spawn(name, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: AbortSignal.timeout(120_000),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (data: string) => {
      stdout = (stdout + data).slice(-32_768);
    });
    child.stderr.setEncoding('utf8').on('data', (data: string) => {
      stderr = (stderr + data).slice(-32_768);
    });
    child.once('error', fail);
    child.once('close', (code) => {
      if (code === 0) done(stdout);
      else fail(new Error(name + ' returned ' + code + ': ' + stderr.trim()));
    });
  });

const inspect = async (file: string): Promise<{streams: Stream[]; durationMs: number}> => {
  const json = await command('ffprobe', [
    '-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate',
    '-of', 'json', file,
  ]);
  let info: ProbeResult;
  try {
    info = JSON.parse(json) as ProbeResult;
  } catch {
    throw new Error('Invalid ffprobe response: ' + file);
  }
  const durationMs = Number(info.format?.duration) * 1000;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('Cannot determine media duration: ' + file);
  }
  return {streams: info.streams ?? [], durationMs};
};

const frameRate = (rational: string | undefined): number => {
  const [numerator, denominator = '1'] = (rational ?? '').split('/');
  const a = Number(numerator);
  const b = Number(denominator);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return NaN;
  return a / b;
};

const assertDuration = (label: string, actualMs: number, expectedMs: number, toleranceMs: number) => {
  if (Math.abs(actualMs - expectedMs) > toleranceMs) {
    throw new Error(
      label + ' duration ' + Math.round(actualMs) + 'ms differs from storyboard ' +
      expectedMs + 'ms by more than ' + Math.round(toleranceMs) + 'ms; ' +
      'do not silently trim or stretch the recorded narration',
    );
  }
};

/**
 * The final, lossless-video handoff to an already rendered visual clip.
 * Use the existing Avenox/MLT edit-list for *editing*, not this mux stage.
 */
export const muxRenderedVisualAndNarration = async ({
  videoPath,
  narrationMixPath,
  outputPath,
  storyboard,
}: {
  videoPath: string;
  narrationMixPath: string;
  outputPath: string;
  storyboard: Storyboard;
}) => {
  const video = await realpath(videoPath);
  const audio = await realpath(narrationMixPath);
  if (!(await stat(video)).isFile() || !(await stat(audio)).isFile()) {
    throw new Error('Video and audio inputs must be regular files');
  }

  const output = resolve(outputPath);
  if (extname(output).toLowerCase() !== '.mp4') {
    throw new Error('Final video must have a .mp4 extension');
  }
  if (output === video || output === audio) {
    throw new Error('Output cannot replace a source video or audio master');
  }
  try {
    await lstat(output);
    throw new Error('Refusing to overwrite existing output: ' + output);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  const [visual, sound] = await Promise.all([inspect(video), inspect(audio)]);
  const videoStreams = visual.streams.filter(({codec_type}) => codec_type === 'video');
  const visualAudio = visual.streams.filter(({codec_type}) => codec_type === 'audio');
  const soundStreams = sound.streams.filter(({codec_type}) => codec_type === 'audio');

  if (videoStreams.length !== 1 || videoStreams[0].codec_name !== 'h264') {
    throw new Error('Visual input must contain exactly one H.264 video stream');
  }
  if (visualAudio.length !== 0) {
    throw new Error(
      'Visual MP4 already contains audio. Supply a silent visual render to avoid ' +
      'overwriting existing sound without editorial review.',
    );
  }
  if (soundStreams.length !== 1 || !soundStreams[0].codec_name?.startsWith('pcm_')) {
    throw new Error('Narration+SFX master must contain exactly one PCM WAV audio stream');
  }

  const fps = frameRate(videoStreams[0].r_frame_rate);
  if (!Number.isFinite(fps) || Math.abs(fps - storyboard.fps) > 0.01) {
    throw new Error(
      'Visual FPS ' + videoStreams[0].r_frame_rate +
      ' does not match storyboard FPS ' + storyboard.fps,
    );
  }
  // Real-world compressed sources may differ by a frame due to codec timing.
  const tolerance = Math.max(50, 2000 / storyboard.fps);
  assertDuration('Visual', visual.durationMs, storyboard.durationMs, tolerance);
  assertDuration('Narration mix', sound.durationMs, storyboard.durationMs, tolerance);

  await mkdir(dirname(output), {recursive: true});
  await command('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
    '-i', video, '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', output,
  ]);

  const result = await inspect(output);
  if (result.streams.filter(({codec_type}) => codec_type === 'video').length !== 1 ||
      result.streams.filter(({codec_type}) => codec_type === 'audio').length !== 1 ||
      !result.streams.some(({codec_name}) => codec_name === 'aac')) {
    throw new Error('Output MP4 does not contain one video and one AAC audio stream');
  }
  assertDuration('Output', result.durationMs, storyboard.durationMs, tolerance + 30);
  return {
    outputPath: output,
    durationMs: Math.round(result.durationMs),
    mode: storyboard.narration ? 'narrated' : 'sfx-only',
    language: storyboard.language ?? storyboard.narration?.language ?? 'unspecified',
    fps: storyboard.fps,
    videoCodec: 'h264',
    audioCodec: 'aac',
    sourceVideoCopied: true,
    note: 'Technical mux verified. Narration, intelligibility, editorial sync and media rights require human QA.',
  };
};
