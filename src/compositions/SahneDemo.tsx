import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {MetricBar} from '../components/MetricBar';
import {SceneCanvas} from '../components/SceneCanvas';
import {SceneHeader} from '../components/SceneHeader';
import {tokens} from '../design/tokens';
import {sceneSchema, type SceneSpec} from '../schema';

type Props = {
  scene: SceneSpec;
  /** When embedded inside a Series.Sequence, use the sequence's local duration. */
  sceneDurationInFrames?: number;
};

export const SahneDemo: React.FC<Props> = ({scene, sceneDurationInFrames}) => {
  const {title, subtitle, accentColor, metrics} = sceneSchema.parse(scene);
  const frame = useCurrentFrame();
  const {durationInFrames: compositionDuration} = useVideoConfig();
  const durationInFrames = sceneDurationInFrames ?? compositionDuration;

  return (
    <SceneCanvas>
      <SceneHeader
        title={title}
        subtitle={subtitle}
        accentColor={accentColor}
        frame={frame}
        durationInFrames={durationInFrames}
      />
      <section
        style={{
          marginTop: tokens.spacing.headerToMetrics,
          display: 'grid',
          rowGap: metrics.length >= 4 ? 18 : tokens.spacing.metricGap,
        }}
      >
        {metrics.map((metric, index) => (
          <MetricBar
            key={`${metric.label}-${index}`}
            label={metric.label}
            value={metric.value}
            accentColor={accentColor}
            frame={frame}
            durationInFrames={durationInFrames}
            index={index}
            metricCount={metrics.length}
          />
        ))}
      </section>
    </SceneCanvas>
  );
};
