import {readFile} from 'node:fs/promises';
import {loadAssetCatalog} from '../src/assets/store';
import {validateNarratedStoryboard} from '../src/production/storyboard';

const usage = 'Usage: pnpm storyboard:validate <avenox-transcript.json> ' +
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
  if (!transcriptPath || !storyboardPath || !catalogDirectory || extra.length > 0) {
    throw new Error(usage);
  }

  const [rawTranscript, rawStoryboard, assets] = await Promise.all([
    readJson(transcriptPath),
    readJson(storyboardPath),
    loadAssetCatalog(catalogDirectory),
  ]);

  const {storyboard, transcript} = validateNarratedStoryboard(
    rawStoryboard,
    rawTranscript,
    assets,
  );

  const reusedAssetIds = [...new Set(storyboard.beats.flatMap((beat) =>
    beat.source.kind === 'asset' ? [beat.source.assetId] : [],
  ))];

  console.log(JSON.stringify({
    valid: true,
    transcriptGranularity: transcript.granularity,
    transcriptSegments: transcript.segments.length,
    durationMs: storyboard.durationMs,
    fps: storyboard.fps,
    visualBeats: storyboard.beats.length,
    reusedAssetIds,
    note: 'Metadata/timing validated; actual audio files and rendered output have not been inspected.',
  }, null, 2));
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
