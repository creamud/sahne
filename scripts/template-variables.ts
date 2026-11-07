import {readFile} from 'node:fs/promises';
import {
  channelStyleSchema,
  resolveTemplateVariables,
  templateManifestSchema,
} from '../src/production/identity';

const usage = 'Usage: pnpm template:variables <channel.style.json> ' +
  '<template.template.json> <template-inputs.json> ' +
  '(prints HyperFrames --variables-file JSON to stdout)';

const readJson = async (path: string): Promise<unknown> => {
  const contents = await readFile(path, 'utf8');
  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error('Invalid JSON in ' + path + ': ' + String(error));
  }
};

const main = async () => {
  const [stylePath, templatePath, inputsPath, ...extra] = process.argv.slice(2);
  if (!stylePath || !templatePath || !inputsPath || extra.length) {
    throw new Error(usage);
  }
  const [rawStyle, rawTemplate, rawInputs] = await Promise.all([
    readJson(stylePath), readJson(templatePath), readJson(inputsPath),
  ]);
  const style = channelStyleSchema.parse(rawStyle);
  const template = templateManifestSchema.parse(rawTemplate);
  if (!rawInputs || typeof rawInputs !== 'object' || Array.isArray(rawInputs)) {
    throw new Error('Template inputs must be a JSON object');
  }
  const variables = resolveTemplateVariables(
    style, template, rawInputs as Record<string, unknown>,
  );
  console.log(JSON.stringify(variables, null, 2));
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
