import {execFile} from 'node:child_process';
import {lstat, mkdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {promisify} from 'node:util';
import {storyboardSchema} from '../src/production/storyboard';
import {normalizeAvenoxTranscript} from '../src/production/transcript';

const run = promisify(execFile);
const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
const inputArgs = ['-f', 'mov', '-enable_drefs', '0', '-protocol_whitelist', 'file'];
const localFile = async (root: string, path: string) => {
  const absolute = resolve(root, path);
  const target = await realpath(absolute);
  const rel = relative(root, target);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel) ||
      target !== absolute || !(await lstat(target)).isFile()) {
    throw new Error('Expected a regular project-local file: ' + path);
  }
  return target;
};

type Stream = {
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  sample_aspect_ratio?: string;
  field_order?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
};

const formatTime = (ms: number, fractionSeparator: string) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(Math.floor(ms / 3600000)) + ':' + pad(Math.floor(ms / 60000) % 60) + ':' +
    pad(Math.floor(ms / 1000) % 60) + fractionSeparator + String(ms % 1000).padStart(3, '0');
};

// Wrap copy at word boundaries without assigning timestamps to individual words.
const wrapText = (text: string) => {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/u)) {
    const last = lines.at(-1);
    if (last && Array.from(last + ' ' + word).length <= 42) lines[lines.length - 1] += ' ' + word;
    else lines.push(word);
  }
  return lines;
};

const main = async () => {
  const [directory, ...extra] = process.argv.slice(2);
  if (!directory || extra.length) {
    throw new Error('Usage: pnpm exec tsx scripts/release-qa.ts <local-project-directory>');
  }
  const root = await realpath(directory);
  const storyboard = storyboardSchema.parse(await readJson(await localFile(root, 'storyboard.json')));
  const master = await localFile(root, 'final.mp4');
  const {stdout} = await run('ffprobe', [
    '-v', 'error', ...inputArgs,
    '-show_entries', 'stream=codec_type,codec_name,profile,width,height,sample_aspect_ratio,field_order,' +
      'color_space,color_transfer,color_primaries,r_frame_rate,avg_frame_rate,sample_rate,channels,duration',
    '-of', 'json', master,
  ]);
  const {streams} = JSON.parse(stdout) as {streams: Stream[]};
  const videos = streams.filter((stream) => stream.codec_type === 'video');
  const audios = streams.filter((stream) => stream.codec_type === 'audio');
  const [video] = videos;
  const [audio] = audios;
  const fps = storyboard.fps + '/1';
  if (videos.length !== 1 || audios.length !== 1 || video.codec_name !== 'h264' || audio.codec_name !== 'aac' ||
      video.width !== 1920 || video.height !== 1080 || video.sample_aspect_ratio !== '1:1' ||
      video.r_frame_rate !== fps || video.avg_frame_rate !== fps ||
      audio.channels !== 2 || audio.sample_rate !== '48000') {
    throw new Error('Expected one H.264 1920×1080 square-pixel video at storyboard FPS and one stereo 48 kHz AAC stream');
  }
  if (video.field_order && !['progressive', 'unknown'].includes(video.field_order)) {
    throw new Error('Interlaced video is not supported');
  }
  const videoMs = Number(video.duration) * 1000;
  const audioMs = Number(audio.duration) * 1000;
  const oneFrameMs = 1000 / storyboard.fps;
  if (![videoMs, audioMs].every((value) =>
      Number.isFinite(value) && Math.abs(value - storyboard.durationMs) <= oneFrameMs)) {
    throw new Error('Audio and video duration must match the storyboard within one frame');
  }

  const flags: string[] = [];
  if (video.field_order !== 'progressive') flags.push('Progressive scan is not explicitly tagged.');
  if ([video.color_space, video.color_transfer, video.color_primaries].some((tag) => tag !== 'bt709')) {
    flags.push('Review SDR color tags. BT.709 is recommended for this export.');
  }
  if (video.profile !== 'High' || audio.profile !== 'LC') flags.push('Review H.264 High and AAC-LC profile recommendations.');

  let srt: string | undefined;
  let vtt: string | undefined;
  const language = storyboard.narration?.language ?? storyboard.language;
  if (storyboard.narration) {
    if (!language) throw new Error('Narrated export requires a declared TR or EN language');
    const {segments} = normalizeAvenoxTranscript(
      await readJson(await localFile(root, storyboard.narration.transcriptPath)),
    );
    let previousEnd = 0;
    const cues = segments.map(({index, startMs, endMs, text}) => {
      if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) ||
          startMs < previousEnd || endMs > Math.min(videoMs, audioMs, storyboard.durationMs)) {
        throw new Error('Caption ' + (index + 1) + ' overlaps or exceeds the final audio/video timeline');
      }
      previousEnd = endMs;
      const lines = wrapText(text);
      const count = Array.from(lines.join(' ')).length;
      if (lines.length > 2 || lines.some((line) => Array.from(line).length > 42) ||
          count * 1000 / (endMs - startMs) > 20) {
        flags.push('Caption ' + (index + 1) + ' at ' + formatTime(startMs, '.') + ': review reading speed and line breaks.');
      }
      return {index: index + 1, startMs, endMs, text: lines.join('\n')};
    });
    const serialize = (separator: string) => cues.map((cue) =>
      cue.index + '\n' + formatTime(cue.startMs, separator) + ' --> ' + formatTime(cue.endMs, separator) +
      '\n' + (separator === '.' ? cue.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') : cue.text) + '\n\n',
    ).join('');
    srt = serialize(',');
    vtt = 'WEBVTT\n\n' + serialize('.');
  }

  // Scan the actual decoded master. Thresholds are review flags, not release approval.
  const {stderr} = await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'info', '-nostats', '-nostdin', '-xerror', ...inputArgs, '-i', master,
    '-map', '0:v:0', '-map', '0:a:0', '-vf', 'blackdetect=d=0.35:pix_th=0.10',
    '-af', storyboard.narration ? 'silencedetect=n=-45dB:d=1.5,volumedetect' : 'volumedetect',
    '-f', 'null', '-',
  ], {maxBuffer: 4 * 1024 * 1024});
  for (const line of stderr.split('\n')) {
    const event = line.match(/(?:black_start:|silence_start:|silence_end:).*/)?.[0];
    if (event) flags.push(event.trim() + ' (seconds).');
  }
  const peak = Number(stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
  if (Number.isFinite(peak) && peak >= -1) flags.push('Audio sample peak near full scale: ' + peak + ' dBFS.');

  const output = join(root, 'release-qa');
  await mkdir(output);
  try {
    if (srt !== undefined && vtt !== undefined) {
      await writeFile(join(output, 'captions.' + language + '.srt'), srt, {flag: 'wx'});
      await writeFile(join(output, 'captions.' + language + '.vtt'), vtt, {flag: 'wx'});
    }
    const report = {
      state: 'needs-human-review', language: language ?? null, videoMs, audioMs, fps: storyboard.fps,
      captionSource: storyboard.narration ? 'corrected-transcript-segments' : null, flags,
    };
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({output, ...report}, null, 2));
  } catch (error) {
    await rm(output, {recursive: true, force: true});
    throw error;
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
