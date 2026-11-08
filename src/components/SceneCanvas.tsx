import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {getCanvasPreset, tokens} from '../design/tokens';

type Props = {children: React.ReactNode};

export const SceneCanvas: React.FC<Props> = ({children}) => {
  const {width, height} = useVideoConfig();
  const {safeArea, contentScale} = getCanvasPreset(width, height);
  return (
    <AbsoluteFill
      style={{
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: tokens.colors.background,
        color: tokens.colors.foreground,
        fontFamily: tokens.fontFamily,
        padding: `${safeArea.vertical}px ${safeArea.horizontal}px`,
        ...(contentScale === 1 ? {} : {justifyContent: 'center' as const}),
      }}
    >
      {contentScale === 1 ? children : <div style={{zoom: contentScale}}>{children}</div>}
    </AbsoluteFill>
  );
};
