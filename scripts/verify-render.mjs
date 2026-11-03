#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {statSync} from 'node:fs';

const filename = process.argv[2] ?? 'out/smoke.mp4';
const stats = statSync(filename);
if (stats.size < 1024) {
  throw new Error(`Rendered file is unexpectedly small (${stats.size} bytes): ${filename}`);
}

const result = execFileSync(
  'ffprobe',
  [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration',
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
if (stream.nb_frames !== undefined && Number(stream.nb_frames) !== 30) {
  throw new Error(`Unexpected frame count: ${stream.nb_frames} (expected 30)`);
}
console.log(`Verified H.264 ${stream.width}×${stream.height} @ 30 fps, ${duration}s (${stats.size} bytes).`);
