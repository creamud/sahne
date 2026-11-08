import {z} from 'zod';
import {sceneSchema} from './schema';

const sceneBlockSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/, 'Use lowercase identifiers with hyphens'),
  type: z.literal('metrics'),
  durationInFrames: z.number().int().min(1).max(1800),
  props: sceneSchema,
}).strict();

const narrationSchema = z.object({
  audioPath: z.string().max(240).regex(
    /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:wav|mp3|m4a)$/i,
    'Use a local WAV, MP3 or M4A path relative to public/',
  ),
  showCaptions: z.boolean().optional(),
  cues: z.array(z.object({
    startMs: z.number().int().min(0).max(600_000),
    endMs: z.number().int().min(1).max(600_000),
    text: z.string().trim().min(1).max(110),
  }).strict()).min(1).max(300),
}).strict();

// Convert each absolute timestamp once. Never sum rounded cue durations.
const toFrame = (milliseconds: number) => Math.round(milliseconds * 30 / 1000);

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  scenes: z.array(sceneBlockSchema).min(1).max(60),
  narration: narrationSchema.optional(),
}).strict().superRefine(({scenes, narration}, context) => {
  const seen = new Map<string, number>();
  let total = 0;

  for (const [index, scene] of scenes.entries()) {
    const existing = seen.get(scene.id);
    if (existing !== undefined) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate scene id "${scene.id}" (first used by scene ${existing + 1})`,
        path: ['scenes', index, 'id'],
      });
    }
    if (existing === undefined) {
      seen.set(scene.id, index);
    }
    total += scene.durationInFrames;
  }

  if (total > 18000) {
    context.addIssue({
      code: 'custom',
      message: 'The total manifest duration cannot exceed 18,000 frames (10 min at 30 fps)',
      path: ['scenes'],
    });
  }
  let previousEnd = 0;
  for (const [index, cue] of (narration?.cues ?? []).entries()) {
    if (cue.startMs < previousEnd) {
      context.addIssue({
        code: 'custom', path: ['narration', 'cues', index, 'startMs'],
        message: 'Narration cues must be ordered and non-overlapping',
      });
    }
    if (toFrame(cue.endMs) <= toFrame(cue.startMs) || cue.endMs * 30 > total * 1000) {
      context.addIssue({
        code: 'custom', path: ['narration', 'cues', index, 'endMs'],
        message: 'Cue must cover at least one frame and end within the timeline',
      });
    }
    previousEnd = cue.endMs;
  }

});

export type TimelineManifest = z.infer<typeof manifestSchema>;

export type SceneWindow = {
  id: string;
  startFrame: number;
  endFrameExclusive: number;
};

/** Scene windows use half-open [start, end) frame intervals. */
export const getSceneWindows = (manifest: TimelineManifest): SceneWindow[] => {
  let nextFrame = 0;
  return manifest.scenes.map((scene) => {
    const startFrame = nextFrame;
    nextFrame += scene.durationInFrames;
    return {id: scene.id, startFrame, endFrameExclusive: nextFrame};
  });
};

export const getTotalFrames = (manifest: TimelineManifest): number =>
  getSceneWindows(manifest).at(-1)?.endFrameExclusive ?? 0;

export const getNarrationCue = (manifest: TimelineManifest, frame: number) =>
  manifest.narration?.cues.find(({startMs, endMs}) =>
    frame >= toFrame(startMs) && frame < toFrame(endMs),
  );
