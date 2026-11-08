import {z} from 'zod';
import type {AssetRecord} from '../assets/catalog';
import {normalizeAvenoxTranscript} from './transcript';

const localPathSchema = z.string().trim().min(1).max(4096).refine(
  (value) => !value.startsWith('/') &&
    !value.startsWith('\\') &&
    !/^[a-zA-Z]:/.test(value) &&
    !value.split(/[\\/]/).includes('..'),
  'Use a local, relative path without parent traversal',
);

const idSchema = z.string().min(3).max(80).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use a stable lowercase hyphenated identifier',
);

const sourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('asset'),
    assetId: idSchema,
  }).strict(),
  z.object({
    kind: z.literal('generate'),
    brief: z.string().trim().min(10).max(2000),
  }).strict(),
]);

const soundCueSchema = z.object({
  id: idSchema,
  assetId: idSchema,
  atMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().max(30_000),
  // A quiet effect under spoken narration; no accidental 0 dB cue.
  gainDb: z.number().finite().min(-48).max(-6),
  visualBeatId: idSchema.optional(),
}).strict();

const visualBeatSchema = z.object({
  id: idSchema,
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  treatment: z.enum(['overlay', 'cutaway']),
  cueText: z.string().trim().min(1).max(400),
  cueSegmentIndex: z.number().int().nonnegative(),
  source: sourceSchema,
}).strict();

export const storyboardSchema = z.object({
  schemaVersion: z.literal(1),
  narration: z.object({
    voicePath: localPathSchema,
    language: z.enum(['tr', 'en']).optional(),
    approvedScriptPath: localPathSchema,
    transcriptPath: localPathSchema,
  }).strict(),
  fps: z.union([z.literal(30), z.literal(60)]),
  durationMs: z.number().int().positive(),
  beats: z.array(visualBeatSchema).min(1).max(120),
  soundCues: z.array(soundCueSchema).max(120).optional(),
}).strict().superRefine(({beats, soundCues = [], durationMs}, context) => {
  const ids = new Set<string>();
  let previousEnd = 0;
  for (const [index, beat] of beats.entries()) {
    if (ids.has(beat.id)) {
      context.addIssue({
        code: 'custom',
        path: ['beats', index, 'id'],
        message: 'Duplicate visual beat ID: ' + beat.id,
      });
    }
    ids.add(beat.id);
    if (beat.endMs <= beat.startMs) {
      context.addIssue({
        code: 'custom',
        path: ['beats', index, 'endMs'],
        message: 'Beat end must be after start',
      });
    }
    if (index > 0 && beat.startMs < previousEnd) {
      context.addIssue({
        code: 'custom',
        path: ['beats', index, 'startMs'],
        message: 'Visual beats must be sequential and non-overlapping in v0',
      });
    }
    if (beat.endMs > durationMs) {
      context.addIssue({
        code: 'custom',
        path: ['beats', index, 'endMs'],
        message: 'Visual beat exceeds declared narration duration',
      });
    }
    previousEnd = Math.max(previousEnd, beat.endMs);
  }
  const cueIds = new Set<string>();
  for (const [index, cue] of soundCues.entries()) {
    if (cueIds.has(cue.id)) {
      context.addIssue({
        code: 'custom',
        path: ['soundCues', index, 'id'],
        message: 'Duplicate sound cue ID: ' + cue.id,
      });
    }
    cueIds.add(cue.id);
    if (cue.atMs + cue.durationMs > durationMs) {
      context.addIssue({
        code: 'custom',
        path: ['soundCues', index, 'durationMs'],
        message: 'Sound cue extends past narration timeline',
      });
    }
    if (cue.visualBeatId !== undefined) {
      const beat = beats.find(({id}) => id === cue.visualBeatId);
      if (!beat) {
        context.addIssue({
          code: 'custom',
          path: ['soundCues', index, 'visualBeatId'],
          message: 'Sound cue references missing visual beat',
        });
      } else if (cue.atMs < beat.startMs || cue.atMs >= beat.endMs) {
        context.addIssue({
          code: 'custom',
          path: ['soundCues', index, 'atMs'],
          message: 'Sound cue trigger must be within its referenced visual beat',
        });
      }
    }
  }
});

export type Storyboard = z.infer<typeof storyboardSchema>;

export const validateNarratedStoryboard = (
  storyboardInput: unknown,
  avenoxTranscriptInput: unknown,
  assets: readonly AssetRecord[],
) => {
  const storyboard = storyboardSchema.parse(storyboardInput);
  const transcript = normalizeAvenoxTranscript(avenoxTranscriptInput);
  const lastSpokenEnd = Math.max(...transcript.segments.map((segment) => segment.endMs));
  if (lastSpokenEnd > storyboard.durationMs) {
    throw new Error(
      'Spoken transcript ends at ' + lastSpokenEnd +
      'ms, after storyboard duration ' + storyboard.durationMs + 'ms',
    );
  }

  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  for (const cue of storyboard.soundCues ?? []) {
    const asset = byId.get(cue.assetId);
    if (!asset) {
      throw new Error('Sound cue "' + cue.id + '" references missing asset ' + cue.assetId);
    }
    if (asset.category !== 'audio') {
      throw new Error('Sound cue "' + cue.id + '" references non-audio asset ' + cue.assetId);
    }
    if (asset.reviewStatus !== 'approved' || asset.rights.clearance !== 'cleared') {
      throw new Error('Sound cue "' + cue.id + '" references unapproved/uncleared asset ' + cue.assetId);
    }
  }
  for (const beat of storyboard.beats) {
    const segment = transcript.segments[beat.cueSegmentIndex];
    if (!segment) {
      throw new Error(
        'Storyboard beat "' + beat.id + '" has invalid cueSegmentIndex ' +
        beat.cueSegmentIndex,
      );
    }
    if (beat.startMs >= segment.endMs || beat.endMs <= segment.startMs) {
      throw new Error(
        'Storyboard beat "' + beat.id +
        '" does not overlap its referenced narration segment ' +
        beat.cueSegmentIndex,
      );
    }
    if (beat.source.kind !== 'asset') continue;
    const asset = byId.get(beat.source.assetId);
    if (!asset) {
      throw new Error(
        'Storyboard beat "' + beat.id + '" references missing asset ' +
        beat.source.assetId,
      );
    }
    if (asset.reviewStatus !== 'approved' || asset.rights.clearance !== 'cleared') {
      throw new Error(
        'Storyboard beat "' + beat.id + '" references unapproved/uncleared asset ' +
        beat.source.assetId,
      );
    }
  }

  return {storyboard, transcript};
};
