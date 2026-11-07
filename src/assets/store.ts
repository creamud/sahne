import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {assetSchema, type AssetRecord} from './catalog';

const discoverSidecars = async (directory: string): Promise<string[]> => {
  const found: string[] = [];
  const visit = async (folder: string): Promise<void> => {
    const entries = await readdir(folder, {withFileTypes: true});
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      // Skip OS metadata and hidden directories (e.g. macOS AppleDouble files).
      if (entry.name.startsWith('.')) continue;
      const entryPath = join(folder, entry.name);
      // Never traverse symlinked directories. Explicitly reject symlinked sidecars.
      if (entry.isSymbolicLink() && entry.name.endsWith('.asset.json')) {
        throw new Error('Symlinked asset sidecar is not supported: ' + entryPath);
      }
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.asset.json')) {
        found.push(entryPath);
      }
    }
  };
  await visit(directory);
  return found;
};

/** Read and validate JSON sidecars from a private, locally accessible folder. */
export const loadAssetCatalog = async (directory: string): Promise<AssetRecord[]> => {
  const files = await discoverSidecars(directory);
  const assets: AssetRecord[] = [];
  const ids = new Map<string, string>();

  for (const file of files) {
    const contents = await readFile(file, 'utf8');
    let value: unknown;
    try {
      value = JSON.parse(contents);
    } catch (error) {
      throw new Error('Invalid JSON in ' + file + ': ' + String(error));
    }
    const parsed = assetSchema.safeParse(value);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) =>
        issue.path.join('.') + ': ' + issue.message,
      ).join('; ');
      throw new Error('Invalid asset metadata in ' + file + ': ' + issues);
    }
    const firstFile = ids.get(parsed.data.id);
    if (firstFile !== undefined) {
      throw new Error('Duplicate asset ID ' + parsed.data.id + ' in ' +
        file + ' (already used by ' + firstFile + ')');
    }
    ids.set(parsed.data.id, file);
    assets.push(parsed.data);
  }

  return assets;
};
