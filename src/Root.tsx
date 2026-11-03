import React from 'react';
import {Composition} from 'remotion';
import {SahneDemo} from './compositions/SahneDemo';
import {SahneTimeline} from './compositions/SahneTimeline';
import {demoScene} from './examples/default';
import {demoManifest} from './examples/timeline';
import {getTotalFrames, manifestSchema} from './manifest';

export const Root: React.FC = () => (
  <>
    <Composition
      id="SahneDemo"
      component={SahneDemo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={180}
      defaultProps={{scene: demoScene}}
    />
    <Composition
      id="SahneTimeline"
      component={SahneTimeline}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={getTotalFrames(demoManifest)}
      defaultProps={{manifest: demoManifest}}
      calculateMetadata={({props}) => {
        const parsed = manifestSchema.parse(props.manifest);
        return {
          durationInFrames: getTotalFrames(parsed),
          props: {manifest: parsed},
        };
      }}
    />
  </>
);
