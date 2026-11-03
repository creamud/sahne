import type {SceneSpec} from '../schema';

export const demoScene: SceneSpec = {
  schemaVersion: 1,
  title: 'Illustrative queue load',
  subtitle: 'Example values only — not real measurements',
  accentColor: '#4cc9f0',
  metrics: [
    {label: 'Worker A', value: 72},
    {label: 'Worker B', value: 49},
    {label: 'Worker C', value: 87},
  ],
};
