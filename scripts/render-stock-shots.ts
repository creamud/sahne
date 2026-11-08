import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants as fsConstants, createReadStream} from 'node:fs';
import {chmod, copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile} from 'node:fs/promises';
import {dirname, extname, join, resolve, sep} from 'node:path';
import {promisify} from 'node:util';
import {loadAssetCatalog} from '../src/assets/store';
import {storyboardSchema, validateStoryboardAssets} from '../src/production/storyboard';

const exec = promisify(execFile);
const run = (name: string, args: string[], cwd?: string) =>
  exec(name, args, {cwd, timeout: 120_000, maxBuffer: 1024 * 1024});

type VideoStream = {
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  nb_read_frames?: string;
};
const inspect = async (file: string) => {
  const {stdout} = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_read_frames:format=duration',
    '-of', 'json', file,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: VideoStream[];
    format?: {duration?: string};
  };
  const stream = parsed.streams?.[0];
  if (!stream || stream.codec_name !== 'h264') throw new Error('Expected one H.264 visual stream');
  return {stream, frames: Number(stream.nb_read_frames), durationMs: Number(parsed.format?.duration) * 1000};
};

const sha256 = async (file: string): Promise<string> => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};

const exists = async (file: string) => {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

/**
 * Narrow local preview bridge: one already approved catalog asset per contiguous beat.
 * It renders silent visuals only; editing, narration and publishing remain separate steps.
 */
const main = async () => {
  const [storyboardFile, catalogDirectory, outputFile, ...extra] = process.argv.slice(2);
  if (!storyboardFile || !catalogDirectory || !outputFile || extra.length) {
    throw new Error('Usage: render-stock-shots.ts <storyboard.json> <private-catalog> <output.mp4>');
  }
  const storyboard = storyboardSchema.parse(JSON.parse(await readFile(storyboardFile, 'utf8')) as unknown);
  const catalog = await realpath(catalogDirectory);
  const assets = await loadAssetCatalog(catalog);
  validateStoryboardAssets(storyboard, assets);

  const out = resolve(outputFile);
  if (extname(out).toLowerCase() !== '.mp4') throw new Error('Output must be an MP4 file');
  if (await exists(out)) throw new Error('Refusing to overwrite existing output: ' + out);
  const width = 1920;
  const height = 1080;
  const fps = storyboard.fps;
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const prepared: Array<{path: string; frames: number; still: boolean; id: string}> = [];
  let coveredUntil = 0;

  for (const beat of storyboard.beats) {
    if (beat.startMs !== coveredUntil) {
      throw new Error('Shot preview requires contiguous beats starting at 0ms; gap or overlap before ' + beat.id);
    }
    coveredUntil = beat.endMs;
    const frames = (beat.endMs - beat.startMs) * fps / 1000;
    if (!Number.isSafeInteger(frames) || frames < 1) {
      throw new Error('Shot duration must contain an exact number of frames: ' + beat.id);
    }
    if (beat.source.kind !== 'asset') {
      throw new Error('Pre-render generated beats and register them as reviewed motion-graphic assets: ' + beat.id);
    }
    const asset = byId.get(beat.source.assetId);
    if (!asset || asset.reviewStatus !== 'approved' || asset.rights.clearance !== 'cleared') {
      throw new Error('Shot references missing or unapproved asset: ' + beat.source.assetId);
    }
    if (asset.location.kind !== 'local') {
      throw new Error('Shot preview currently requires a locally staged asset: ' + asset.id);
    }
    const still = asset.category === 'still-image';
    if (!still && asset.category !== 'b-roll' && asset.category !== 'motion-graphic') {
      throw new Error('Unsupported visual asset category: ' + asset.category);
    }
    const source = resolve(catalog, asset.location.relativePath);
    if (!source.startsWith(catalog + sep)) throw new Error('Asset escapes private catalog: ' + asset.id);
    const path = await realpath(source);
    if (!path.startsWith(catalog + sep) || !(await stat(path)).isFile()) {
      throw new Error('Asset is not a regular file within the private catalog: ' + asset.id);
    }
    const extension = extname(path).toLowerCase();
    if (still ? !['.png', '.jpg', '.jpeg'].includes(extension) : extension !== '.mp4') {
      throw new Error('Shot source must be PNG/JPEG still or MP4 footage: ' + asset.id);
    }
    if (asset.sha256 && await sha256(path) !== asset.sha256) {
      throw new Error('Shot source checksum changed: ' + asset.id);
    }
    prepared.push({path, frames, still, id: asset.id});
  }
  if (coveredUntil !== storyboard.durationMs) {
    throw new Error('Shot preview must cover the entire storyboard duration');
  }

  await mkdir(dirname(out), {recursive: true, mode: 0o700});
  const staging = await mkdtemp(join(dirname(out), '.sahne-shots-'));
  try {
    const names: string[] = [];
    for (const [index, shot] of prepared.entries()) {
      const name = 'shot-' + String(index).padStart(3, '0') + '.mp4';
      names.push(name);
      const input = shot.still
        ? ['-loop', '1', '-framerate', String(fps), '-i', shot.path]
        : ['-f', 'mov', '-enable_drefs', '0', '-protocol_whitelist', 'file', '-i', shot.path];
      await run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
        ...input, '-map', '0:v:0', '-an',
        '-vf', 'fps=' + fps + ',scale=' + width + ':' + height +
          ':force_original_aspect_ratio=decrease,pad=' + width + ':' + height +
          ':(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p',
        '-frames:v', String(shot.frames), '-fps_mode', 'cfr', '-r', String(fps),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
        '-movflags', '+faststart', join(staging, name),
      ]);
      const rendered = await inspect(join(staging, name));
      if (rendered.frames !== shot.frames ||
          rendered.stream.width !== width || rendered.stream.height !== height ||
          rendered.stream.r_frame_rate !== fps + '/1') {
        throw new Error('Shot frame count/format mismatch; source may be too short: ' + shot.id);
      }
    }

    await writeFile(join(staging, 'concat.txt'), names.map((name) => 'file ' + name).join('\n') + '\n');
    const stagedOut = join(staging, 'preview.mp4');
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
      '-f', 'concat', '-safe', '1', '-i', 'concat.txt',
      '-map', '0:v:0', '-an', '-c:v', 'copy', '-movflags', '+faststart', stagedOut,
    ], staging);
    const output = await inspect(stagedOut);
    const totalFrames = prepared.reduce((sum, shot) => sum + shot.frames, 0);
    if (output.frames !== totalFrames ||
        output.stream.r_frame_rate !== fps + '/1' ||
        Math.abs(output.durationMs - storyboard.durationMs) > 1000 / fps + 5) {
      throw new Error('Concatenated preview differs from storyboard duration or frame count');
    }

    await copyFile(stagedOut, out, fsConstants.COPYFILE_EXCL);
    await chmod(out, 0o600);
    console.log(JSON.stringify({
      outputPath: out, fps, width, height, videoCodec: 'h264',
      durationMs: storyboard.durationMs, frames: totalFrames,
      assetIds: prepared.map(({id}) => id),
      note: 'Silent technical preview only; human editorial and media-rights QA are still required.',
    }, null, 2));
  } finally {
    await rm(staging, {recursive: true, force: true});
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
