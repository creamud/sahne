import {readFile} from 'node:fs/promises';
import {loadAssetCatalog} from '../src/assets/store';
import {storyboardSchema} from '../src/production/storyboard';
import {mixNarrationWithEffects} from '../src/production/sound';

const usage = 'Usage: pnpm audio:mix <project-directory> <storyboard.json> ' +
  '<local-asset-catalog-directory> <output.wav>';

const readJson = async (path: string): Promise<unknown> => {
  const contents = await readFile(path, 'utf8');
  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error('Invalid JSON in ' + path + ': ' + String(error));
  }
};

const main = async (): Promise<void> => {
  const [projectDirectory, storyboardPath, assetDirectory, outputPath, ...extra] =
    process.argv.slice(2);
  if (!projectDirectory || !storyboardPath || !assetDirectory ||
      !outputPath || extra.length > 0) {
    throw new Error(usage);
  }

  const [rawStoryboard, assets] = await Promise.all([
    readJson(storyboardPath),
    loadAssetCatalog(assetDirectory),
  ]);
  const storyboard = storyboardSchema.parse(rawStoryboard);

  // Timed SFX references require an approved audio catalog record.
  const result = await mixNarrationWithEffects({
    projectDirectory,
    assetDirectory,
    outputPath,
    storyboard,
    assets,
  });
  console.log(JSON.stringify(result, null, 2));
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
