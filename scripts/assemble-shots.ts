import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {link, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import {extname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {promisify} from 'node:util';
import {z} from 'zod';
import {loadAssetCatalog} from '../src/assets/store';
import {validateVideoProjectIdentity} from '../src/production/identity';
import {muxRenderedVisualAndNarration} from '../src/production/mux';
import {validateNarratedStoryboard, validateStoryboardAssets} from '../src/production/storyboard';

const run = promisify(execFile);
const json = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, 'utf8'));
const inputsSchema = z.object({
  shots: z.record(z.string(), z.object({
    file: z.string().min(1),
    renderer: z.string().trim().min(1),
  }).strict()),
  templates: z.array(z.string().min(1)).default([]),
}).strict();

const isWithin = (root: string, file: string) => {
  const path = relative(root, file);
  return path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
};

const localFile = async (root: string, path: string) => {
  if (!path || isAbsolute(path) || path.split(/[\\/]/).includes('..')) {
    throw new Error('Expected a project-relative file: ' + path);
  }
  const file = await realpath(resolve(root, path));
  if (!isWithin(root, file) || !(await stat(file)).isFile()) {
    throw new Error('Expected a regular file inside ' + root + ': ' + path);
  }
  return file;
};

const sha256 = async (file: string) => {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
};

const probe = async (file: string, fps: number, count: number) => {
  const {stdout} = await run('ffprobe', [
    '-v', 'error', '-f', 'mov', '-protocol_whitelist', 'file',
    '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames',
    '-of', 'json', file,
  ]);
  const {streams} = JSON.parse(stdout);
  const video = streams[0];
  if (streams.length !== 1 || video.codec_type !== 'video' || video.codec_name !== 'h264' ||
      video.width !== 1920 || video.height !== 1080 || video.r_frame_rate !== fps + '/1' ||
      Number(video.nb_frames) !== count) {
    throw new Error('Unexpected video format or frame count: ' + file + ' (expected ' + count + ' frames)');
  }
};

const buildShot = async (source: string, target: string, fps: number, count: number, still: boolean) => {
  const input = still
    ? ['-f', 'image2', '-pattern_type', 'none', '-loop', '1', '-framerate', String(fps)]
    : ['-f', 'mov', '-enable_drefs', '0'];
  await run('ffmpeg', [
    '-v', 'error', '-nostdin', '-xerror', '-protocol_whitelist', 'file', ...input, '-i', source,
    '-map', '0:v:0', '-an', '-sn', '-dn',
    '-vf', 'fps=' + fps + ',scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,' +
      'pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p',
    '-frames:v', String(count), '-c:v', 'libx264', '-bf', '0', '-preset', 'fast', '-crf', '18',
    '-video_track_timescale', '90000', target,
  ]);
  await probe(target, fps, count);
};

const main = async () => {
  const [projectDir, ...extra] = process.argv.slice(2);
  if (!projectDir || extra.length) {
    throw new Error('Usage: pnpm exec tsx scripts/assemble-shots.ts <project-directory>');
  }
  const root = await realpath(projectDir);
  const read = async (name: string) => json(await localFile(root, name));
  const inputs = inputsSchema.parse(await read('shots.json'));
  const {project, style, templates} = validateVideoProjectIdentity(
    await read('project.json'), await read('channel.style.json'),
    await Promise.all(inputs.templates.map(read)),
  );
  const catalog = await realpath(join(root, 'catalog'));
  if (!isWithin(root, catalog)) throw new Error('Catalog must be inside the project');
  const assets = await loadAssetCatalog(catalog);
  const storyboard = validateStoryboardAssets(await read(project.storyboardPath), assets);
  if (storyboard.narration) {
    if (project.voicePath !== storyboard.narration.voicePath || project.mode === 'sfx-only') {
      throw new Error('Project and storyboard must reference the same narration');
    }
    validateNarratedStoryboard(storyboard, await read(storyboard.narration.transcriptPath), assets);
  } else if (project.mode !== 'sfx-only') {
    throw new Error('Storyboard has no narration but the project is not SFX-only');
  }
  if (storyboard.fps !== 30) throw new Error('Shot assembly currently requires 30 FPS');
  const fps = storyboard.fps;
  const frame = (ms: number) => Math.round(ms * fps / 1000);
  const total = frame(storyboard.durationMs);
  const plan = storyboard.beats.map((beat, index) => {
    const start = frame(beat.startMs);
    const end = frame(beat.endMs);
    const previous = storyboard.beats[index - 1];
    if (start !== (previous ? frame(previous.endMs) : 0) || end <= start ||
        (index === storyboard.beats.length - 1 && end !== total)) {
      throw new Error('Shots must cover the full timeline without gaps: ' + beat.id);
    }
    if (!Object.hasOwn(inputs.shots, beat.id)) throw new Error('Missing shot input: ' + beat.id);
    return {id: beat.id, start, end, source: beat.source, ...inputs.shots[beat.id]};
  });
  if (plan.length !== Object.keys(inputs.shots).length) throw new Error('Unknown shot input ID');

  const master = await localFile(root, 'master.wav');
  const {stdout: audioDuration} = await run('ffprobe', [
    '-v', 'error', '-f', 'wav', '-protocol_whitelist', 'file',
    '-show_entries', 'format=duration', '-of', 'csv=p=0', master,
  ]);
  const seconds = Number(audioDuration.trim());
  if (!Number.isFinite(seconds) || Math.abs(seconds * fps - total) > 0.5) {
    throw new Error('PCM WAV master must match the frame-rounded storyboard duration within half a frame');
  }
  const cachePath = join(root, '.sahne-shot-cache');
  await mkdir(cachePath, {recursive: true});
  const cache = await realpath(cachePath);
  if (cache !== cachePath) throw new Error('Shot cache must be a project-local directory');
  const scratch = await mkdtemp(join(cache, 'run-'));
  const encoderVersion = (await run('ffmpeg', ['-version'])).stdout;
  const report = [];
  try {
    for (const shot of plan) {
      try {
        const source = await localFile(root, shot.file);
        const extension = extname(source).toLowerCase();
        const still = ['.jpg', '.jpeg', '.png'].includes(extension);
        if (!still && extension !== '.mp4') throw new Error('Expected MP4, PNG, or JPEG');
        const assetId = shot.source.kind === 'asset' ? shot.source.assetId : undefined;
        const asset = assets.find(({id}) => id === assetId);
        if (asset && (asset.location.kind !== 'local' ||
            source !== await localFile(catalog, asset.location.relativePath))) {
          throw new Error('Shot input must match the approved catalog asset: ' + asset.id);
        }
        const digest = await sha256(source);
        if (asset?.sha256 && asset.sha256 !== digest) throw new Error('Catalog asset checksum mismatch');
        const count = shot.end - shot.start;
        const key = createHash('sha256').update(JSON.stringify({
          version: 2, digest, extension, count, fps, renderer: shot.renderer, encoderVersion, style, templates,
        })).digest('hex');
        const name = key + '.mp4';
        const cached = join(cache, name);
        let reused = true;
        try {
          if (await realpath(cached) !== cached) throw new Error('Unexpected cache path');
          await probe(cached, fps, count);
        } catch {
          reused = false;
          const candidate = join(scratch, name);
          await buildShot(source, candidate, fps, count, still);
          if (await sha256(source) !== digest) throw new Error('Shot input changed during render');
          await rename(candidate, cached);
        }
        await link(cached, join(scratch, 'shot-' + report.length + '.mp4'));
        report.push({...shot, fps, key, reused, rights: asset?.rights});
        console.log(shot.id + ': ' + (reused ? 'reused' : 'rendered'));
      } catch (error) {
        throw new Error('Shot ' + shot.id + ': ' + (error instanceof Error ? error.message : String(error)));
      }
    }
    const list = join(scratch, 'shots.txt');
    await writeFile(list, report.map((_, index) => 'file shot-' + index + '.mp4').join('\n') + '\n');
    const visual = join(scratch, 'visual.mp4');
    await run('ffmpeg', [
      '-v', 'error', '-nostdin', '-xerror', '-f', 'concat', '-safe', '1', '-i', list,
      '-map', '0:v:0', '-c:v', 'copy',
      // The concat demuxer rounds file durations. Rebuild timestamps from frame order.
      '-bsf:v', 'setts=pts=N*3000:dts=N*3000:duration=3000:time_base=1/90000',
      '-video_track_timescale', '90000', visual,
    ]);
    await probe(visual, fps, total);
    const candidate = join(scratch, 'preview.mp4');
    await muxRenderedVisualAndNarration({videoPath: visual, narrationMixPath: master, outputPath: candidate, storyboard});
    const previewId = createHash('sha256').update(JSON.stringify({
      shots: report.map(({key}) => key), master: await sha256(master), storyboard,
    })).digest('hex').slice(0, 16);
    const output = join(root, 'shot-preview-' + previewId + '.mp4');
    // Exclusive publication avoids replacing an existing preview or source.
    try {
      await link(candidate, output);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST') ||
          await sha256(await localFile(root, 'shot-preview-' + previewId + '.mp4')) !== await sha256(candidate)) throw error;
    }
    console.log(JSON.stringify({output, mode: 'draft-preview', narration: Boolean(storyboard.narration), shots: report}, null, 2));
  } finally {
    await rm(scratch, {recursive: true, force: true});
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
