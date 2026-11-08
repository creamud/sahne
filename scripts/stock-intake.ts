import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import {extname, join, resolve} from 'node:path';
import {promisify} from 'node:util';
import {z} from 'zod';
import {assetSchema} from '../src/assets/catalog';
import {loadAssetCatalog} from '../src/assets/store';

const run = promisify(execFile);
const json = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, 'utf8'));
const writeJson = (file: string, value: unknown) =>
  writeFile(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const webUrl = z.url().refine((value) => {
  const url = new URL(value);
  return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
}, 'Expected an HTTP(S) source URL without credentials');
const sourceSchema = z.object({
  title: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(120),
  creator: z.string().trim().min(1).max(120),
  sourceUrl: webUrl,
  license: z.string().trim().min(2).max(120),
  licenseUrl: webUrl.optional(),
  attribution: z.string().trim().min(1).max(500).optional(),
}).strict();
const receiptSchema = z.object({
  schemaVersion: z.literal(1),
  selectedAt: z.iso.datetime(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source: sourceSchema,
}).strict();

const hashFile = async (file: string) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};

const regularFile = async (file: string) => {
  if (!(await lstat(file)).isFile()) throw new Error('Expected a regular, non-symlink file: ' + file);
  return file;
};

const inspectMedia = async (file: string, still: boolean) => {
  const input = still ? ['-f', 'image2', '-pattern_type', 'none'] : ['-f', 'mov', '-enable_drefs', '0'];
  const {stdout} = await run('ffprobe', [
    '-v', 'error', '-protocol_whitelist', 'file', ...input,
    '-show_entries', 'stream=codec_type,width,height,duration:stream_disposition=attached_pic',
    '-of', 'json', file,
  ]);
  const {streams} = JSON.parse(stdout);
  const video = streams.filter((stream: {codec_type: string}) => stream.codec_type === 'video');
  if (video.length !== 1 || video[0].disposition?.attached_pic || !(video[0].width > 0 && video[0].height > 0)) {
    throw new Error('Expected exactly one usable visual stream');
  }
  await run('ffmpeg', [
    '-v', 'error', '-xerror', '-nostdin', '-protocol_whitelist', 'file',
    ...input, '-i', file, '-map', '0:v:0', '-an', '-f', 'null', '-',
  ]);
  const durationMs = Math.round(Number(video[0].duration) * 1000);
  if (!still && !(durationMs > 0 && Number.isSafeInteger(durationMs))) {
    throw new Error('Video requires a positive, finite stream duration');
  }
  return still ? undefined : durationMs;
};

const importCandidate = async (catalog: string, input: string, sourceFile: string) => {
  const source = sourceSchema.parse(await json(sourceFile));
  const file = await regularFile(resolve(input));
  const extension = extname(file).toLowerCase();
  const still = ['.png', '.jpg', '.jpeg'].includes(extension);
  if (!still && extension !== '.mp4') throw new Error('Import a PNG, JPEG or MP4');
  const staging = await mkdtemp(join(catalog, '.stock-import-'));
  try {
    const mediaName = 'media' + extension;
    const staged = join(staging, mediaName);
    await copyFile(file, staged);
    const sha256 = await hashFile(staged);
    const id = 'stock-' + sha256;
    const existing = (await loadAssetCatalog(catalog)).find((asset) => asset.sha256 === sha256);
    if (existing) throw new Error('Media already exists in the catalog as ' + existing.id);
    const durationMs = await inspectMedia(staged, still);
    const receipt = receiptSchema.parse({schemaVersion: 1, selectedAt: new Date().toISOString(), sha256, source});
    const relativePath = id + '/' + mediaName;
    const asset = assetSchema.parse({
      schemaVersion: 1, id, title: source.title, description: 'Imported stock candidate from ' + source.provider,
      category: still ? 'still-image' : 'b-roll', tags: ['stock'], reviewStatus: 'draft',
      rights: {
        origin: 'third-party', clearance: 'review-needed', license: source.license,
        attribution: source.attribution, sourceUrl: source.sourceUrl,
      },
      location: {kind: 'local', relativePath},
      sha256, durationMs,
    });
    await writeJson(join(staging, 'source-receipt.json'), receipt);
    await writeJson(join(staging, 'candidate.asset.json'), asset);
    // The content ID and non-empty directory prevent concurrent duplicate publication.
    await rename(staging, join(catalog, id));
    console.log(JSON.stringify({id, status: 'draft', preview: join(catalog, relativePath)}, null, 2));
  } finally {
    await rm(staging, {recursive: true, force: true});
  }
};

const reviewCandidate = async (catalog: string, id: string, decision: string, reviewer: string) => {
  if (!/^stock-[a-f0-9]{64}$/.test(id)) throw new Error('Expected a stock candidate ID');
  if (decision !== 'approve' && decision !== 'reject') throw new Error('Decision must be approve or reject');
  const name = z.string().trim().min(1).max(120).parse(reviewer);
  const directory = join(catalog, id);
  if (await realpath(directory) !== directory) throw new Error('Candidate directory cannot be a symlink');
  // mkdir is an exclusive review lock, so simultaneous decisions cannot overwrite each other.
  const lock = join(directory, '.review-lock');
  await mkdir(lock);
  try {
    const sidecar = await regularFile(join(directory, 'candidate.asset.json'));
    const asset = assetSchema.parse(await json(sidecar));
    const receipt = receiptSchema.parse(await json(await regularFile(join(directory, 'source-receipt.json'))));
    if (asset.id !== id || 'stock-' + receipt.sha256 !== id || asset.sha256 !== receipt.sha256 ||
        asset.location.kind !== 'local' || !new RegExp('^' + id + '/media\\.(png|jpe?g|mp4)$').test(asset.location.relativePath)) {
      throw new Error('Candidate metadata and receipt do not match');
    }
    if (asset.reviewStatus !== 'draft') throw new Error('Candidate has already been reviewed');
    if (decision === 'approve') {
      if (!receipt.source.licenseUrl || /^(unknown|unclear|unverified|pending|n\/a)$/i.test(receipt.source.license)) {
        throw new Error('Approval requires a documented license and license URL');
      }
      const media = await regularFile(join(catalog, asset.location.relativePath));
      if (await hashFile(media) !== receipt.sha256) throw new Error('Candidate media checksum changed');
    }
    const source = receipt.source;
    const credit = source.attribution ??
      source.title + ' — ' + source.creator + ' (' + source.provider + '), ' +
      source.license + ' · ' + source.sourceUrl;
    const updated = assetSchema.parse({
      ...asset, reviewStatus: decision === 'approve' ? 'approved' : 'retired',
      rights: {
        ...asset.rights, clearance: decision === 'approve' ? 'cleared' : 'review-needed',
        license: source.license, attribution: source.attribution, sourceUrl: source.sourceUrl,
      },
    });
    await writeJson(join(lock, 'decision.json'), {
      reviewer: name, decision, reviewedAt: new Date().toISOString(), licenseUrl: source.licenseUrl, credit,
    });
    await writeJson(join(lock, 'candidate.asset.json'), updated);
    // Save the review receipt before making the candidate eligible for approved-only search.
    await rename(join(lock, 'decision.json'), join(directory, 'review-receipt.json'));
    await rename(join(lock, 'candidate.asset.json'), sidecar);
    console.log(JSON.stringify({id, status: updated.reviewStatus, credit: decision === 'approve' ? credit : undefined}, null, 2));
  } finally {
    await rm(lock, {recursive: true, force: true});
  }
};

const main = async () => {
  const [action, directory, ...args] = process.argv.slice(2);
  if (directory && action === 'import' && args.length === 2) {
    await mkdir(directory, {recursive: true});
    return importCandidate(await realpath(directory), args[0], args[1]);
  }
  if (directory && action === 'review' && args.length === 3) {
    return reviewCandidate(await realpath(directory), args[0], args[1], args[2]);
  }
  throw new Error('Usage: stock-intake.ts import <catalog> <media> <source.json> | ' +
    'stock-intake.ts review <catalog> <id> <approve|reject> <reviewer>');
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
