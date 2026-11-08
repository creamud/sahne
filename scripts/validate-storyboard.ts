import {readFile} from 'node:fs/promises';
import {loadAssetCatalog} from '../src/assets/store';
import {
  storyboardSchema,
  validateNarratedStoryboard,
  validateStoryboardAssets,
} from '../src/production/storyboard';

const usage = 'Usage: pnpm storyboard:validate <avenox-transcript.json | -> ' +
  '<storyboard.json> <local-asset-catalog-directory>';

const readJson = async (path: string): Promise<unknown> => {
  const contents = await readFile(path, 'utf8');
  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error('Invalid JSON in ' + path + ': ' + String(error));
  }
};

const main = async (): Promise<void> => {
  const [transcriptPath, storyboardPath, catalogDirectory, ...extra] =
    process.argv.slice(2);
  if (!transcriptPath || !storyboardPath || !catalogDirectory || extra.length) {
    throw new Error(usage);
  }

  const [rawStoryboard, assets] = await Promise.all([
    readJson(storyboardPath),
    loadAssetCatalog(catalogDirectory),
  ]);
  const parsed = storyboardSchema.parse(rawStoryboard);
  // "-" is an explicit absent transcript, only valid for SFX-only projects.
  if (transcriptPath === '-' && parsed.narration) {
    throw new Error('Narrated storyboard requires an actual transcript file');
  }
  if (transcriptPath !== '-' && !parsed.narration) {
    throw new Error('SFX-only storyboard has no transcript; use - as the first argument');
  }
  const result = transcriptPath === '-'
    ? {storyboard: validateStoryboardAssets(parsed, assets), transcript: undefined}
    : validateNarratedStoryboard(parsed, await readJson(transcriptPath), assets);
  const {storyboard, transcript} = result;

  const reusedAssetIds = [...new Set(storyboard.beats.flatMap((beat) =>
    beat.source.kind === 'asset' ? [beat.source.assetId] : [],
  ))];
  console.log(JSON.stringify({
    valid: true,
    mode: storyboard.narration ? 'narrated' : 'sfx-only',
    language: storyboard.language ?? storyboard.narration?.language ?? 'unspecified',
    transcriptGranularity: transcript?.granularity ?? null,
    transcriptSegments: transcript?.segments.length ?? 0,
    durationMs: storyboard.durationMs,
    fps: storyboard.fps,
    visualBeats: storyboard.beats.length,
    soundCues: storyboard.soundCues?.length ?? 0,
    reusedAssetIds,
    note: 'Metadata verified; media files and editorial quality have not been inspected.',
  }, null, 2));
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
