import {spawn} from 'node:child_process';
import {lstat, mkdir, realpath, stat} from 'node:fs/promises';
import {dirname, extname, isAbsolute, relative, resolve} from 'node:path';
import type {AssetRecord} from '../assets/catalog';
import type {Storyboard} from './storyboard';

type RunResult = {stdout: string; stderr: string};

const run = async (program: string, args: string[]): Promise<RunResult> =>
  new Promise((done, fail) => {
    const child = spawn(program, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: AbortSignal.timeout(120_000),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (part: string) => {
      stdout = (stdout + part).slice(-32_768);
    });
    child.stderr.setEncoding('utf8').on('data', (part: string) => {
      stderr = (stderr + part).slice(-32_768);
    });
    child.once('error', fail);
    child.once('close', (code) => {
      if (code === 0) done({stdout, stderr});
      else fail(new Error(program + ' exited with ' + code + ': ' + stderr.trim()));
    });
  });

const resolveExistingMedia = async (root: string, unsafeRelativePath: string): Promise<string> => {
  const base = await realpath(root);
  const candidate = await realpath(resolve(base, unsafeRelativePath));
  const within = relative(base, candidate);
  if (within === '' || within === '..' || within.startsWith('../') ||
      within.startsWith('..\\') || isAbsolute(within)) {
    throw new Error('Media path escapes its catalog/project root: ' + unsafeRelativePath);
  }
  if (!(await stat(candidate)).isFile()) {
    throw new Error('Media path must point to a regular file: ' + unsafeRelativePath);
  }
  return candidate;
};

// Keep FFmpeg from following secondary inputs referenced by playlists or manifests.
const localAudioInputOptions = [
  '-format_whitelist', 'wav,aiff,caf,flac,mp3,aac,ogg,mov,m4a,mp4,webm,matroska',
  '-protocol_whitelist', 'file',
];

const probeAudio = async (file: string): Promise<number> => {
  const {stdout} = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,channels:format=duration',
    '-of', 'json', ...localAudioInputOptions, file,
  ]);
  let parsed: {streams?: Array<{codec_name?: string}>; format?: {duration?: string}};
  try {
    parsed = JSON.parse(stdout) as typeof parsed;
  } catch {
    throw new Error('ffprobe did not return audio metadata for ' + file);
  }
  const duration = Number(parsed.format?.duration);
  if (!parsed.streams?.length || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('Missing usable audio track or duration: ' + file);
  }
  return duration * 1000;
};

/**
 * Render an independent, WAV narration+SFX master with FFmpeg.
 * The caller supplies a schema-validated storyboard and rights-checked catalog.
 * No speech recognition, stock download, or custom audio engine is involved.
 */
export const mixNarrationWithEffects = async ({
  projectDirectory,
  assetDirectory,
  outputPath,
  storyboard,
  assets,
}: {
  projectDirectory: string;
  assetDirectory: string;
  outputPath: string;
  storyboard: Storyboard;
  assets: readonly AssetRecord[];
}) => {
  const voice = await resolveExistingMedia(projectDirectory, storyboard.narration.voicePath);
  const voiceDuration = await probeAudio(voice);
  if (Math.abs(voiceDuration - storyboard.durationMs) > 100) {
    throw new Error(
      'Recorded narration duration (' + Math.round(voiceDuration) +
      'ms) differs from storyboard duration (' + storyboard.durationMs +
      'ms). Re-check the post-edit narration timeline instead of silently truncating speech.',
    );
  }

  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const cues = storyboard.soundCues ?? [];
  const sources: string[] = [];
  const filters: string[] = [];
  const seconds = (milliseconds: number) => (milliseconds / 1000).toFixed(3);

  filters.push(
    '[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,' +
    'apad,atrim=duration=' + seconds(storyboard.durationMs) +
    ',asetpts=PTS-STARTPTS[voice]',
  );

  for (const [index, cue] of cues.entries()) {
    const asset = byId.get(cue.assetId);
    if (!asset || asset.category !== 'audio' ||
        asset.reviewStatus !== 'approved' || asset.rights.clearance !== 'cleared') {
      throw new Error('Sound effect must reference a rights-cleared approved audio asset: ' + cue.assetId);
    }
    if (asset.location.kind !== 'local') {
      throw new Error('Download approved audio assets to a local catalog before mixing: ' + cue.assetId);
    }
    const source = await resolveExistingMedia(assetDirectory, asset.location.relativePath);
    const sourceDuration = await probeAudio(source);
    if (sourceDuration + 10 < cue.durationMs) {
      throw new Error(
        'Sound effect ' + cue.assetId + ' is shorter than requested ' + cue.durationMs + 'ms',
      );
    }
    sources.push(source);
    filters.push(
      '[' + (index + 1) + ':a]aresample=48000,' +
      'aformat=sample_fmts=fltp:channel_layouts=stereo,' +
      'atrim=duration=' + seconds(cue.durationMs) + ',asetpts=PTS-STARTPTS,' +
      'volume=' + cue.gainDb + 'dB,adelay=' + cue.atMs + '|' + cue.atMs +
      '[effect' + index + ']',
    );
  }

  const inputs = ['[voice]', ...sources.map((_, index) => '[effect' + index + ']')].join('');
  const finalFilter = cues.length
    ? inputs + 'amix=inputs=' + (cues.length + 1) +
      ':duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.95[out]'
    : '[voice]alimiter=limit=0.95[out]';
  filters.push(finalFilter);

  const dest = resolve(outputPath);
  if (extname(dest).toLowerCase() !== '.wav') {
    throw new Error('Audio master output must have a .wav extension');
  }
  if ([voice, ...sources].includes(dest)) {
    throw new Error('Refusing to overwrite an input narration/SFX file');
  }

  // FFmpeg's -n is not a reliable failure signal when the output already exists.
  // Reject existing files/symlinks explicitly, before starting a new render.
  try {
    await lstat(dest);
    throw new Error('Refusing to overwrite existing audio master: ' + dest);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  await mkdir(dirname(dest), {recursive: true});
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
    ...localAudioInputOptions, '-i', voice,
    ...sources.flatMap((source) => [...localAudioInputOptions, '-i', source]),
    '-filter_complex', filters.join(';'),
    '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', dest,
  ]);

  const mixedDuration = await probeAudio(dest);
  if (Math.abs(mixedDuration - storyboard.durationMs) > 100) {
    throw new Error('Mixed audio duration differs from the storyboard timeline');
  }

  return {
    outputPath: dest,
    durationMs: Math.round(mixedDuration),
    language: storyboard.narration.language ?? 'unspecified',
    effectCount: cues.length,
    reusedAssetIds: [...new Set(cues.map(({assetId}) => assetId))],
    note: 'Synthetic/real media mixed; human listening, loudness and copyright QA still required.',
  };
};
