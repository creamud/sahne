import React from 'react';
import {Composition} from 'remotion';
import {SahneDemo} from './compositions/SahneDemo';
import {demoScene} from './examples/default';

export const Root: React.FC = () => (
  <Composition
    id="SahneDemo"
    component={SahneDemo}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={180}
    defaultProps={{scene: demoScene}}
  />
);
