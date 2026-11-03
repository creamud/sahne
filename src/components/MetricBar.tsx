import React from 'react';
import {getMetricBarProgress} from '../design/motion';
import {tokens} from '../design/tokens';

type Props = {
  label: string;
  value: number;
  accentColor: string;
  frame: number;
  durationInFrames: number;
  index: number;
  metricCount: number;
};

export const MetricBar: React.FC<Props> = ({
  label,
  value,
  accentColor,
  frame,
  durationInFrames,
  index,
  metricCount,
}) => {
  const progress = getMetricBarProgress(frame, durationInFrames, index, metricCount);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 32,
          fontSize: tokens.fontSizes.metric,
          fontWeight: 600,
          marginBottom: 14,
          alignItems: 'baseline',
        }}
      >
        <span style={{overflowWrap: 'anywhere'}}>{label}</span>
        <span style={{fontVariantNumeric: 'tabular-nums', color: accentColor, flexShrink: 0}}>
          {Math.round(value * progress)}%
        </span>
      </div>
      <div
        style={{
          background: tokens.colors.track,
          borderRadius: tokens.metricBarHeight / 2,
          height: tokens.metricBarHeight,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${value * progress}%`,
            background: accentColor,
            borderRadius: tokens.metricBarHeight / 2,
          }}
        />
      </div>
    </div>
  );
};
