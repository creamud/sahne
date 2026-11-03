import React from 'react';
import {AbsoluteFill} from 'remotion';
import {tokens} from '../design/tokens';

type Props = {children: React.ReactNode};

export const SceneCanvas: React.FC<Props> = ({children}) => (
  <AbsoluteFill
    style={{
      boxSizing: 'border-box',
      overflow: 'hidden',
      background: tokens.colors.background,
      color: tokens.colors.foreground,
      fontFamily: tokens.fontFamily,
      padding: `${tokens.safeArea.vertical}px ${tokens.safeArea.horizontal}px`,
    }}
  >
    {children}
  </AbsoluteFill>
);
