import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {sceneSchema, type SceneSpec} from '../schema';

type Props = {scene: SceneSpec};
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const SahneDemo: React.FC<Props> = ({scene}) => {
  const {title, subtitle, accentColor, metrics} = sceneSchema.parse(scene);
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 28], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        background: '#0b1220',
        color: '#f8fafc',
        fontFamily: 'Arial, Helvetica, sans-serif',
        padding: '118px 150px',
      }}
    >
      <div style={{opacity: intro, transform: `translateY(${(1 - intro) * 36}px)`}}>
        <div
          style={{
            fontSize: 26,
            letterSpacing: 5,
            textTransform: 'uppercase',
            color: accentColor,
            fontWeight: 700,
          }}
        >
          SAHNE / EXPLAINER
        </div>
        <h1 style={{fontSize: 82, margin: '24px 0 10px', letterSpacing: -2}}>
          {title}
        </h1>
        <p style={{fontSize: 30, color: '#94a3b8', margin: 0}}>{subtitle}</p>
      </div>

      <div style={{marginTop: 86, display: 'flex', flexDirection: 'column', gap: 46}}>
        {metrics.map((metric, index) => {
          const progress = interpolate(frame, [28 + index * 14, 94 + index * 14], [0, 1], clamp);
          const value = Math.round(metric.value * progress);
          return (
            <div key={metric.label + index}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontSize: 36,
                  marginBottom: 16,
                  fontWeight: 600,
                }}
              >
                <span>{metric.label}</span>
                <span style={{fontVariantNumeric: 'tabular-nums', color: accentColor}}>{value}%</span>
              </div>
              <div style={{background: '#1e293b', height: 28, borderRadius: 14, overflow: 'hidden'}}>
                <div
                  style={{
                    width: `${metric.value * progress}%`,
                    height: '100%',
                    borderRadius: 14,
                    background: accentColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
