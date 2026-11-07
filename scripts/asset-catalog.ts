import {loadAssetCatalog} from '../src/assets/store';
import {searchAssets} from '../src/assets/catalog';

const usage = 'Usage:\n' +
  '  pnpm assets:validate <local-catalog-dir>\n' +
  '  pnpm assets:search <local-catalog-dir> <search terms...> [--all]\n' +
  'Search defaults to approved assets with cleared reuse rights.';

const main = async (): Promise<void> => {
  const [command, directory, ...argumentsAfterDirectory] = process.argv.slice(2);
  if (!directory || (command !== 'validate' && command !== 'search')) {
    throw new Error(usage);
  }
  if (command === 'validate') {
    if (argumentsAfterDirectory.length > 0) {
      throw new Error(usage);
    }
    const records = await loadAssetCatalog(directory);
    console.log(JSON.stringify({valid: true, count: records.length}, null, 2));
    return;
  }

  const includeUnapproved = argumentsAfterDirectory.includes('--all');
  const terms = argumentsAfterDirectory.filter((arg) => arg !== '--all');
  if (terms.length === 0 || terms.some((arg) => arg.startsWith('--')) ||
      !/[\p{L}\p{N}]/u.test(terms.join(' '))) {
    throw new Error(usage);
  }
  const records = await loadAssetCatalog(directory);
  const matches = searchAssets(records, terms.join(' '), {includeUnapproved});
  console.log(JSON.stringify({
    count: matches.length,
    query: terms.join(' '),
    includeUnapproved,
    assets: matches,
  }, null, 2));
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
