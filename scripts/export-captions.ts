import {lstat, mkdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {storyboardSchema} from '../src/production/storyboard';
import {createCaptionSidecars} from '../src/production/captions';

const usage =
  'Usage: pnpm captions:export <private-project-directory> <storyboard.json> <output-prefix>';

const projectFile = async (root: string, path: string): Promise<string> => {
  const actual = await realpath(resolve(root, path));
  const within = relative(root, actual);
  if (within === '..' || within.startsWith('..' + sep) || isAbsolute(within)) {
    throw new Error('Transcript and storyboard must stay in the private project directory');
  }
  return actual;
};

const main = async () => {
  const [projectDirectory, storyboardPath, prefix, ...extra] = process.argv.slice(2);
  if (!projectDirectory || !storyboardPath || !prefix || extra.length) {
    throw new Error(usage);
  }
  const root = await realpath(projectDirectory);
  const board = storyboardSchema.parse(JSON.parse(
    await readFile(await projectFile(root, storyboardPath), 'utf8'),
  ) as unknown);
  if (!board.narration) {
    throw new Error('SFX-only videos do not have a spoken transcript to export');
  }
  const transcriptPath = await projectFile(root, board.narration.transcriptPath);
  const transcript = JSON.parse(await readFile(transcriptPath, 'utf8')) as unknown;
  const result = createCaptionSidecars(board, transcript);
  const stem = resolve(prefix);
  if (stem === transcriptPath) {
    throw new Error('Output prefix cannot replace the transcript');
  }
  const paths = {srt: stem + '.srt', vtt: stem + '.vtt'};
  for (const path of Object.values(paths)) {
    try {
      await lstat(path);
      throw new Error('Refusing to overwrite existing captions: ' + path);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }
  await mkdir(dirname(stem), {recursive: true});
  let createdSrt = false;
  try {
    await writeFile(paths.srt, result.srt, {flag: 'wx', mode: 0o600});
    createdSrt = true;
    await writeFile(paths.vtt, result.vtt, {flag: 'wx', mode: 0o600});
  } catch (error) {
    if (createdSrt) await rm(paths.srt, {force: true});
    throw error;
  }
  console.log(JSON.stringify({
    cueCount: result.cueCount,
    durationMs: result.durationMs,
    granularity: 'segment',
    requiresHumanReview: true,
    paths,
  }, null, 2));
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
