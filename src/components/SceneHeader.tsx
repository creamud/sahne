import React from 'react';
import {getEnterExitMotion} from '../design/motion';
import {tokens} from '../design/tokens';

type Props = {
  title: string;
  subtitle: string;
  accentColor: string;
  frame: number;
  durationInFrames: number;
};

export const SceneHeader: React.FC<Props> = ({
  title,
  subtitle,
  accentColor,
  frame,
  durationInFrames,
}) => {
  const {opacity, translateY} = getEnterExitMotion(frame, durationInFrames);
  const titleFontSize = title.length > 60 ? 58 : title.length > 38 ? 68 : tokens.fontSizes.title;
  const subtitleFontSize = subtitle.length > 110 ? 24 : tokens.fontSizes.subtitle;

  return (
    <header style={{opacity, transform: `translateY(${translateY}px)`}}>
      <div
        style={{
          color: accentColor,
          fontSize: tokens.fontSizes.eyebrow,
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}
      >
        SAHNE / EXPLAINER
      </div>
      <h1
        style={{
          fontSize: titleFontSize,
          lineHeight: 1.08,
          margin: `${tokens.spacing.eyebrowToTitle}px 0 10px`,
          letterSpacing: -2,
          overflowWrap: 'anywhere',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          color: tokens.colors.muted,
          fontSize: subtitleFontSize,
          lineHeight: 1.28,
          margin: 0,
          overflowWrap: 'anywhere',
        }}
      >
        {subtitle}
      </p>
    </header>
  );
};
