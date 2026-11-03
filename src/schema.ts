import {z} from 'zod';

export const metricSchema = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.number().finite().min(0).max(100),
}).strict();

export const sceneSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(90),
  subtitle: z.string().trim().max(180),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  metrics: z.array(metricSchema).min(1).max(4),
}).strict();

export type SceneSpec = z.infer<typeof sceneSchema>;
