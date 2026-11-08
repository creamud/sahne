import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile, lstat, mkdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {promisify} from 'node:util';
import {channelStyleSchema, videoProjectSchema} from '../src/production/identity';
import {storyboardSchema} from '../src/production/storyboard';

const run = promisify(execFile);
const inputArgs = ['-f', 'mov', '-enable_drefs', '0', '-protocol_whitelist', 'file'];

const localFile = async (root: string, name: string) => {
  const requested = resolve(root, name);
  const path = await realpath(requested);
  const location = relative(root, path);
  if (location === '..' || location.startsWith('..' + sep) || isAbsolute(location) ||
      path !== requested || !(await lstat(path)).isFile()) {
    throw new Error('Expected a regular project-local file: ' + name);
  }
  return path;
};
const json = async (root: string, name: string): Promise<unknown> =>
  JSON.parse(await readFile(await localFile(root, name), 'utf8'));

const time = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor(ms / 1000) % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') +
    '.' + String(ms % 1000).padStart(3, '0');
};
const plain = (value: string) => value.replace(/\s+/gu, ' ')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replace(/[\\`*_{}\[\]()#+!|]/g, '\\$&');

const digest = async (file: string) => {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
};

type Stream = {codec_type: string; width?: number; height?: number; avg_frame_rate?: string};

const main = async () => {
  const [projectDirectory, revision, previewName, ...extra] = process.argv.slice(2);
  if (!projectDirectory || !revision || !previewName || extra.length ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(revision)) {
    throw new Error('Usage: pnpm exec tsx scripts/review-packet.ts <local-project> <revision-slug> <preview.mp4>');
  }
  const root = await realpath(projectDirectory);
  const preview = await localFile(root, previewName);
  const project = videoProjectSchema.parse(await json(root, 'project.json'));
  const style = channelStyleSchema.parse(await json(root, 'channel.style.json'));
  if (project.style.channelId !== style.channelId || project.style.revision !== style.revision) {
    throw new Error('Project and channel style pin do not match');
  }
  const board = storyboardSchema.parse(await json(root, project.storyboardPath));
  const narrated = project.mode !== 'sfx-only';
  if (narrated !== Boolean(board.narration) ||
      (board.narration && project.voicePath !== board.narration.voicePath)) {
    throw new Error('Project and storyboard narration do not match');
  }
  const language = board.narration?.language ?? board.language ?? project.language;
  if (project.language && language && project.language !== language) {
    throw new Error('Project and storyboard language do not match');
  }
  const output = join(root, 'review-' + revision);
  await mkdir(output, {mode: 0o700});
  try {
    const copy = join(output, 'preview.mp4');
    await copyFile(preview, copy);
    const {stdout} = await run('ffprobe', [
      '-v', 'error', ...inputArgs, '-show_entries',
      'stream=codec_type,width,height,avg_frame_rate:format=duration', '-of', 'json', copy,
    ]);
    const {streams, format} = JSON.parse(stdout) as {streams: Stream[]; format: {duration: string}};
    const video = streams.filter((stream) => stream.codec_type === 'video');
    const fps = board.fps + '/1';
    const durationMs = Math.round(Number(format.duration) * 1000);
    if (video.length !== 1 || !video[0].width || !video[0].height || video[0].avg_frame_rate !== fps ||
        !Number.isFinite(durationMs) || Math.abs(durationMs - board.durationMs) > 1000 / board.fps) {
      throw new Error('Preview video frame rate or duration does not match the storyboard');
    }

    const hash = await digest(copy);
    const frameBudget = Math.min(12, board.beats.length);
    const selected = new Set(Array.from({length: frameBudget}, (_, index) =>
      Math.floor(index * board.beats.length / frameBudget),
    ));
    const rows = [];
    for (const [index, beat] of board.beats.entries()) {
      let still = '—';
      if (selected.has(index)) {
        const name = 'shot-' + String(index + 1).padStart(3, '0') + '.jpg';
        const at = Math.min(Math.floor((beat.startMs + beat.endMs) / 2),
          Math.max(0, durationMs - Math.ceil(1000 / board.fps)));
        await run('ffmpeg', [
          '-v', 'error', '-xerror', '-nostdin', ...inputArgs, '-ss', (at / 1000).toFixed(3), '-i', copy,
          '-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', join(output, name),
        ]);
        if (!(await lstat(join(output, name))).size) throw new Error('Could not extract frame for ' + beat.id);
        still = '[Still](' + name + ')';
      }
      const source = beat.source.kind === 'asset' ? plain(beat.source.assetId) : 'Generated visual';
      rows.push('| ' + time(beat.startMs) + '–' + time(beat.endMs) + ' | ' +
        plain(beat.id) + ' | ' + plain(beat.cueText) + ' | ' + source + ' | ' + still + ' |');
    }

    const note = [
      '# ' + plain(project.title) + ' · ' + revision,
      '',
      '[Play the private preview](preview.mp4)',
      '',
      '- Runtime ' + time(durationMs) + ' · ' + video[0].width + '×' + video[0].height + ' · ' + board.fps + ' fps',
      '- Language ' + (language ?? 'unspecified') + ' · channel ' + style.channelId + '@' + style.revision,
      '- Preview SHA-256 `' + hash + '`',
      '- Status **Needs human review**',
      '',
      '## Shot map',
      '',
      '| Time | Shot ID | What to watch | Source | Preview frame |',
      '| --- | --- | --- | --- | --- |',
      ...rows,
      '',
      '## Technical scope',
      '',
      'The preview stream, frame rate, duration and sampled stills were checked. Watch the full cut to assess pacing, legibility, captions, speech and sound effects. Confirm the source rights ledger before approving.',
      ...(board.narration ? ['Compare narration against the approved script and corrected transcript in the private project.'] : []),
      '',
      '## Copy this for each finding',
      '',
      '```text',
      'Revision: ' + revision,
      'Time range:',
      'Shot ID:',
      'Category:',
      'What happened:',
      'What should change:',
      'Priority: blocker / major / minor',
      'Status: open / addressed / verified / waived',
      'Verification revision and reviewer:',
      '```',
      '',
      'Record a new revision for a new cut. Mark a finding verified only after a human watches the updated result.',
      '',
      '## Human decision',
      '',
      '- Reviewer:',
      '- Watched the full video at normal speed:',
      '- Decision: approved / changes requested',
      '- Date:',
      '',
    ].join('\n');
    await writeFile(join(output, 'REVIEW.md'), note, {flag: 'wx'});
    console.log(JSON.stringify({output, revision, sha256: hash, sampledStills: selected.size}, null, 2));
  } catch (error) {
    await rm(output, {recursive: true, force: true});
    throw error;
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
