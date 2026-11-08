#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {mkdirSync, renameSync, rmSync, statSync} from 'node:fs';
import {join} from 'node:path';

const [filename = 'out/smoke.mp4', option, outputDirectory, ...extra] = process.argv.slice(2);
if (option !== undefined && (option !== '--stills' || !outputDirectory || extra.length)) {
  throw new Error('Usage: node scripts/verify-render.mjs [video.mp4] [--stills new-output-directory]');
}
const stats = statSync(filename);
if (stats.size < 1024) {
  throw new Error(`Rendered file is unexpectedly small (${stats.size} bytes): ${filename}`);
}

const result = execFileSync(
  'ffprobe',
  [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-count_frames',
    '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_read_frames:format=duration',
    '-of', 'json',
    filename,
  ],
  {encoding: 'utf8'},
);
const metadata = JSON.parse(result);
const stream = metadata.streams?.[0];
const duration = Number(metadata.format?.duration);
const expected = {
  codec_name: 'h264',
  width: 1920,
  height: 1080,
  r_frame_rate: '30/1',
};

for (const [key, value] of Object.entries(expected)) {
  if (stream?.[key] !== value) {
    throw new Error(`Unexpected ${key}: ${JSON.stringify(stream?.[key])} (expected ${JSON.stringify(value)})`);
  }
}
if (!Number.isFinite(duration) || duration < 0.95 || duration > 1.05) {
  throw new Error(`Unexpected duration: ${duration}s (expected ~1s)`);
}
if (stream.nb_read_frames === undefined || Number(stream.nb_read_frames) !== 30) {
  throw new Error(`Unexpected decoded frame count: ${stream.nb_read_frames} (expected 30)`);
}
console.log(`Verified H.264 ${stream.width}×${stream.height} @ 30 fps, ${duration}s (${stats.size} bytes).`);

if (outputDirectory) {
  const frames = [
    {index: 0, filename: 'beginning.png'},
    {index: 15, filename: 'middle.png'},
    {index: 29, filename: 'end.png'},
  ];
  mkdirSync(outputDirectory);
  try {
    execFileSync('ffmpeg', [
      '-v', 'error', '-nostdin', '-xerror', '-i', filename, '-map', '0:v:0',
      '-vf', 'select=' + frames.map(({index}) => 'eq(n\\,' + index + ')').join('+'),
      '-frames:v', String(frames.length), '-fps_mode', 'passthrough',
      join(outputDirectory, 'frame-%d.png'),
    ], {stdio: 'inherit'});
    for (const [index, frame] of frames.entries()) {
      const extracted = join(outputDirectory, 'frame-' + (index + 1) + '.png');
      if (statSync(extracted).size === 0) throw new Error('Empty inspection frame: ' + frame.filename);
      renameSync(extracted, join(outputDirectory, frame.filename));
    }
  } catch (error) {
    rmSync(outputDirectory, {recursive: true, force: true});
    throw error;
  }
  console.log('Saved inspection frames 0, 15 and 29 in ' + outputDirectory + '.');
}
