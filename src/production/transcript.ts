import {z} from 'zod';

/**
 * Avenox Studio transcribe.py writes seconds, segment-level text, and no word
 * timing. Keep this boundary explicit; do not invent word-level alignment.
 */
const avenoxSegmentSchema = z.object({
  start: z.number().finite().nonnegative(),
  end: z.number().finite().positive(),
  text: z.string().trim().min(1),
}).strict();

export const avenoxTranscriptSchema = z.object({
  text: z.string().trim().min(1),
  segments: z.array(avenoxSegmentSchema).min(1),
}).strict().superRefine(({segments}, context) => {
  for (const [index, segment] of segments.entries()) {
    if (segment.end <= segment.start) {
      context.addIssue({
        code: 'custom',
        path: ['segments', index, 'end'],
        message: 'Segment end must be after start',
      });
    }
    if (index > 0 && segment.start < segments[index - 1].start) {
      context.addIssue({
        code: 'custom',
        path: ['segments', index, 'start'],
        message: 'Transcript segments must be ordered by start time',
      });
    }
  }
});

export type TimedTranscript = {
  schemaVersion: 1;
  granularity: 'segment';
  text: string;
  segments: Array<{
    index: number;
    startMs: number;
    endMs: number;
    text: string;
  }>;
};

/** Convert the seconds from Avenox into integer millisecond timestamps. */
export const normalizeAvenoxTranscript = (input: unknown): TimedTranscript => {
  const transcript = avenoxTranscriptSchema.parse(input);
  const segments = transcript.segments.map((segment, index) => ({
    index,
    startMs: Math.round(segment.start * 1000),
    endMs: Math.round(segment.end * 1000),
    text: segment.text,
  }));

  for (const segment of segments) {
    if (segment.endMs <= segment.startMs) {
      throw new Error(
        'Transcript segment ' + segment.index +
        ' is shorter than 1ms after timestamp rounding',
      );
    }
  }

  return {
    schemaVersion: 1,
    granularity: 'segment',
    text: transcript.text,
    segments,
  };
};
