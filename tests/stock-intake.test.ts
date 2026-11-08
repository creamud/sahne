import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {chmod, mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {searchAssets} from '../src/assets/catalog';
import {loadAssetCatalog} from '../src/assets/store';

const cli = fileURLToPath(new URL('../scripts/stock-intake.ts', import.meta.url));
const toolsAvailable = ['ffmpeg', 'ffprobe'].every((tool) => spawnSync(tool, ['-version']).status === 0);

test('imports stock offline and enforces draft, approved, and rejected catalog states', {
  skip: !toolsAvailable,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sahne-stock-'));
  const catalog = join(dir, 'catalog');
  const metadata = join(dir, 'source.json');
  const source = {
    title: 'Synthetic stock', provider: 'Fixture provider', creator: 'Fixture creator',
    sourceUrl: 'https://example.com/source', license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Fixture creator',
  };
  const invoke = (...args: string[]) =>
    spawnSync(process.execPath, [...process.execArgv, cli, args[0], catalog, ...args.slice(1)], {encoding: 'utf8'});
  const media = (name: string, color: string) => {
    const path = join(dir, name);
    const output = name.endsWith('.png') ? ['-frames:v', '1'] : ['-t', '0.3', '-c:v', 'libx264'];
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=' + color + ':s=96x64', ...output, path]);
    return path;
  };
  const intake = (file: string) => {
    const result = invoke('import', file, metadata);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout) as {id: string; preview: string; status: string};
  };
  try {
    await writeFile(metadata, JSON.stringify(source));
    const still = media('still.png', 'red');
    const video = media('b-roll.mp4', 'blue');
    const photo = intake(still);
    assert.equal((await stat(join(catalog, photo.id))).mode & 0o777, 0o700);
    assert.equal((await stat(photo.preview)).mode & 0o777, 0o600);
    assert.equal((await stat(join(catalog, photo.id, 'source-receipt.json'))).mode & 0o777, 0o600);
    const clip = intake(video);
    assert.equal(photo.status, 'draft');
    assert.equal(searchAssets(await loadAssetCatalog(catalog), 'stock').length, 0);
    assert.match(invoke('import', still, metadata).stderr, /already exists/);

    for (const candidate of [photo, clip]) {
      const approved = invoke('review', candidate.id, 'approve', 'Human reviewer');
      assert.equal(approved.status, 0, approved.stderr);
      assert.equal(JSON.parse(approved.stdout).credit, 'Fixture creator');
      const receipt = JSON.parse(await readFile(join(catalog, candidate.id, 'review-receipt.json'), 'utf8'));
      assert.equal(receipt.reviewer, 'Human reviewer');
      assert.equal(receipt.licenseUrl, source.licenseUrl);
    }
    assert.deepEqual(searchAssets(await loadAssetCatalog(catalog), 'stock')
      .map(({category}) => category).sort(), ['b-roll', 'still-image']);

    await writeFile(metadata, JSON.stringify({...source, license: 'unknown'}));
    const unclear = intake(media('unclear.png', 'green'));
    assert.match(invoke('review', unclear.id, 'approve', 'Human reviewer').stderr, /documented license/);
    assert.equal(invoke('review', unclear.id, 'reject', 'Human reviewer').status, 0);
    assert.match(invoke('review', unclear.id, 'approve', 'Human reviewer').stderr, /durable review decision|already been reviewed/);

    await writeFile(metadata, JSON.stringify(source));
    const changed = intake(media('changed.png', 'white'));
    await writeFile(changed.preview, 'corrupt');
    assert.match(invoke('review', changed.id, 'approve', 'Human reviewer').stderr, /checksum changed/);
    // Simulate interruption after the durable receipt was published but before the sidecar changed.
    const interrupted = intake(media('interrupted.png', 'yellow'));
    await writeFile(join(catalog, interrupted.id, 'review-receipt.json'), JSON.stringify({decision: 'reject'}));
    assert.match(invoke('review', interrupted.id, 'approve', 'Human reviewer').stderr, /durable review decision/);
    const broken = join(dir, 'broken.mp4');
    await writeFile(broken, 'not a video');
    assert.equal(invoke('import', broken, metadata).status, 1);
    assert.equal(searchAssets(await loadAssetCatalog(catalog), 'stock').length, 2);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
