import {z} from 'zod';

const assetIdSchema = z.string().min(3).max(80).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use lowercase alphanumeric identifiers separated by hyphens',
);

const tagSchema = z.string().trim().toLowerCase().min(2).max(40).regex(
  /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u,
  'Use words or hyphenated words',
);

const relativePathSchema = z.string().trim().min(1).max(4096).refine(
  (value) => !value.startsWith('/') &&
    !value.startsWith('\\') &&
    !/^[a-zA-Z]:/.test(value) &&
    !value.split(/[\\/]/).includes('..'),
  'Use a relative path without parent traversal',
);

const assetLocationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('local'),
    relativePath: relativePathSchema,
  }).strict(),
  z.object({
    kind: z.literal('google-drive'),
    fileId: z.string().trim().min(1),
  }).strict(),
]);

const rightsSchema = z.object({
  origin: z.enum(['original', 'licensed', 'third-party', 'ai-generated']),
  clearance: z.enum(['cleared', 'review-needed']),
  license: z.string().trim().min(2).max(120),
  attribution: z.string().trim().max(500).optional(),
  sourceUrl: z.url().optional(),
}).strict();

export const assetSchema = z.object({
  schemaVersion: z.literal(1),
  id: assetIdSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  category: z.enum([
    'motion-graphic', 'b-roll', 'still-image', 'screen-recording', 'audio', 'other',
  ]),
  tags: z.array(tagSchema).min(1).max(25).refine(
    (tags) => new Set(tags).size === tags.length,
    'Tags must be unique',
  ),
  reviewStatus: z.enum(['draft', 'approved', 'retired']),
  rights: rightsSchema,
  location: assetLocationSchema,
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  durationMs: z.number().int().positive().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  editableSource: relativePathSchema.optional(),
  createdFrom: z.string().trim().max(240).optional(),
}).strict().superRefine((asset, context) => {
  if (asset.reviewStatus === 'approved' && asset.rights.clearance !== 'cleared') {
    context.addIssue({
      code: 'custom',
      path: ['rights', 'clearance'],
      message: 'Approved assets require cleared reuse rights',
    });
  }
});

export type AssetRecord = z.infer<typeof assetSchema>;

export type AssetSearchOptions = {
  includeUnapproved?: boolean;
};

const queryTerms = (query: string): string[] =>
  query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * Local deterministic discovery, not a semantic/vector search engine.
 * By default, only approved assets with cleared usage rights are surfaced.
 */
export const searchAssets = (
  assets: readonly AssetRecord[],
  query: string,
  {includeUnapproved = false}: AssetSearchOptions = {},
): AssetRecord[] => {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const ranked = assets.flatMap((asset) => {
    if (!includeUnapproved &&
        (asset.reviewStatus !== 'approved' || asset.rights.clearance !== 'cleared')) {
      return [];
    }

    const title = asset.title.toLowerCase();
    const description = asset.description.toLowerCase();
    const tags = asset.tags.join(' ').toLowerCase();
    let score = 0;

    for (const term of terms) {
      const tagHit = asset.tags.some((tag) => tag.includes(term));
      const titleHit = title.includes(term);
      const descriptionHit = description.includes(term);
      if (!tagHit && !titleHit && !descriptionHit && !tags.includes(term)) {
        return [];
      }
      score += (tagHit ? 8 : 0) + (titleHit ? 4 : 0) + (descriptionHit ? 1 : 0);
    }
    return [{asset, score}];
  });

  const compareCodepoint = (a: string, b: string): number =>
    a < b ? -1 : a > b ? 1 : 0;
  ranked.sort((left, right) =>
    right.score - left.score ||
    compareCodepoint(left.asset.title, right.asset.title) ||
    compareCodepoint(left.asset.id, right.asset.id),
  );
  return ranked.map(({asset}) => asset);
};
