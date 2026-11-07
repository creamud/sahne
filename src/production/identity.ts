import {z} from 'zod';

const slug = z.string().min(3).max(80).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use a stable lowercase hyphen-separated ID',
);
const hexColor = z.string().regex(/^#[a-fA-F0-9]{6}$/, 'Use a 6-digit hex color');
const relativePath = z.string().trim().min(1).max(4096).refine(
  (value) => !value.startsWith('/') &&
    !value.startsWith('\\') &&
    !/^[A-Za-z]:/.test(value) &&
    !value.split(/[\\/]/).includes('..'),
  'Must be a relative path with no parent traversal',
);

const characterSchema = z.object({
  id: slug,
  name: z.string().trim().min(1).max(120),
  referenceAssetIds: z.array(slug).min(1),
  identityNotes: z.string().trim().min(10).max(2000),
}).strict();

export const channelStyleSchema = z.object({
  schemaVersion: z.literal(1),
  channelId: slug,
  revision: z.number().int().positive(),
  displayName: z.string().trim().min(1).max(120),
  visual: z.object({
    palette: z.object({
      background: hexColor,
      foreground: hexColor,
      accent: hexColor,
    }).strict(),
    typography: z.object({
      displayFont: z.string().trim().min(1).max(120),
      bodyFont: z.string().trim().min(1).max(120),
      minimumReadablePxAt1080p: z.number().int().min(28).max(96),
    }).strict(),
    motion: z.enum(['restrained', 'dynamic']),
    chromePolicy: z.enum(['none', 'only-when-demonstrating-ui']),
  }).strict(),
  characters: z.array(characterSchema).default([]),
}).strict().superRefine((style, context) => {
  const seen = new Set<string>();
  for (const [index, character] of style.characters.entries()) {
    if (seen.has(character.id)) {
      context.addIssue({
        code: 'custom',
        path: ['characters', index, 'id'],
        message: 'Duplicate character ID',
      });
    }
    seen.add(character.id);
    if (new Set(character.referenceAssetIds).size !== character.referenceAssetIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['characters', index, 'referenceAssetIds'],
        message: 'Duplicate reference asset IDs',
      });
    }
  }
});
export type ChannelStyle = z.infer<typeof channelStyleSchema>;

const parameterSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Use a JS-compatible variable name'),
  kind: z.enum(['text', 'number', 'color', 'boolean', 'image']),
  required: z.boolean(),
}).strict();

/**
 * Describes an existing renderer's template input contract.
 * This manifest does not execute/auto-install code or create another renderer.
 */
export const templateManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: slug,
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Use a pinned major.minor.patch version'),
  title: z.string().trim().min(1).max(120),
  category: z.enum(['kinetic-type', 'ui-mockup', 'diagram', 'transition', 'other']),
  renderer: z.enum(['hyperframes', 'remotion']),
  entry: relativePath,
  license: z.string().trim().min(2).max(120),
  parameters: z.array(parameterSchema),
  channelStyleInputs: z.array(z.enum([
    'background', 'foreground', 'accent', 'displayFont', 'bodyFont',
  ])),
}).strict().superRefine((manifest, context) => {
  const keys = manifest.parameters.map((parameter) => parameter.key);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({
      code: 'custom',
      path: ['parameters'],
      message: 'Template parameter keys must be unique',
    });
  }
  if (manifest.parameters.some((parameter) => parameter.key.startsWith('channel'))) {
    context.addIssue({
      code: 'custom',
      path: ['parameters'],
      message: 'Channel identity variables are reserved and cannot be parameters',
    });
  }
  if (new Set(manifest.channelStyleInputs).size !== manifest.channelStyleInputs.length) {
    context.addIssue({
      code: 'custom',
      path: ['channelStyleInputs'],
      message: 'Channel style inputs must be unique',
    });
  }
});
export type TemplateManifest = z.infer<typeof templateManifestSchema>;

export const videoProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: slug,
  title: z.string().trim().min(1).max(180),
  style: z.object({
    channelId: slug,
    revision: z.number().int().positive(),
  }).strict(),
  scriptPath: relativePath,
  voicePath: relativePath,
  storyboardPath: relativePath,
  templatePins: z.array(z.object({
    id: slug,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  }).strict()).default([]),
}).strict().superRefine((project, context) => {
  const pins = project.templatePins.map((pin) => pin.id);
  if (new Set(pins).size !== pins.length) {
    context.addIssue({
      code: 'custom',
      path: ['templatePins'],
      message: 'Use one pinned version per template ID in each video project',
    });
  }
});
export type VideoProject = z.infer<typeof videoProjectSchema>;

/**
 * Validate a project's immutable style and template references against
 * explicitly supplied local metadata. No package downloads or renderer calls.
 */
export const validateVideoProjectIdentity = (
  projectInput: unknown,
  styleInput: unknown,
  templateInputs: readonly unknown[],
): {project: VideoProject; style: ChannelStyle; templates: TemplateManifest[]} => {
  const project = videoProjectSchema.parse(projectInput);
  const style = channelStyleSchema.parse(styleInput);
  const templates = templateInputs.map((input) => templateManifestSchema.parse(input));

  if (project.style.channelId !== style.channelId ||
      project.style.revision !== style.revision) {
    throw new Error(
      'Video project references channel style ' +
      project.style.channelId + '@' + project.style.revision +
      ', but supplied ' + style.channelId + '@' + style.revision,
    );
  }

  for (const pin of project.templatePins) {
    if (!templates.some((manifest) =>
      manifest.id === pin.id && manifest.version === pin.version)) {
      throw new Error('Missing pinned template: ' + pin.id + '@' + pin.version);
    }
  }
  return {project, style, templates};
};


type TemplateVariables = Record<string, string | number | boolean>;

const channelStyleVariableNames = {
  background: 'channelBackground',
  foreground: 'channelForeground',
  accent: 'channelAccent',
  displayFont: 'channelDisplayFont',
  bodyFont: 'channelBodyFont',
} as const;

/**
 * Resolve a template's declared public inputs with pinned channel identity
 * tokens. Caller-supplied parameters never override channel design tokens.
 * Pass result to HyperFrames' existing --variables-file option.
 */
export const resolveTemplateVariables = (
  style: ChannelStyle,
  template: TemplateManifest,
  inputs: Record<string, unknown>,
): TemplateVariables => {
  const declared = new Map(template.parameters.map((parameter) => [
    parameter.key, parameter,
  ]));
  const result: TemplateVariables = {};

  for (const [key, value] of Object.entries(inputs)) {
    const parameter = declared.get(key);
    if (!parameter) throw new Error('Undeclared template parameter: ' + key);

    const valid = parameter.kind === 'text'
      ? typeof value === 'string' && value.trim().length > 0
      : parameter.kind === 'number'
        ? typeof value === 'number' && Number.isFinite(value)
        : parameter.kind === 'boolean'
          ? typeof value === 'boolean'
          : parameter.kind === 'color'
            ? typeof value === 'string' && hexColor.safeParse(value).success
            : typeof value === 'string' && relativePath.safeParse(value).success;
    if (!valid) throw new Error('Invalid template parameter: ' + key);
    result[key] = value as string | number | boolean;
  }

  for (const parameter of template.parameters) {
    if (parameter.required && !(parameter.key in inputs)) {
      throw new Error('Missing required template parameter: ' + parameter.key);
    }
  }

  const palette = style.visual.palette;
  const type = style.visual.typography;
  const tokens = {
    background: palette.background,
    foreground: palette.foreground,
    accent: palette.accent,
    displayFont: type.displayFont,
    bodyFont: type.bodyFont,
  };

  for (const requested of template.channelStyleInputs) {
    result[channelStyleVariableNames[requested]] = tokens[requested];
  }
  return result;
};
