import React from 'react';
import {Series} from 'remotion';
import type {TimelineManifest} from '../manifest';
import {SahneDemo} from './SahneDemo';

type Props = {manifest: TimelineManifest};

/**
 * Each Series.Sequence resets the local frame to 0 for the child scene.
 * Scenes do not overlap, so the final duration is the exact sum of frames.
 */
export const SahneTimeline: React.FC<Props> = ({manifest}) => {
  return (
    <Series>
      {manifest.scenes.map((scene) => (
        <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
          <SahneDemo scene={scene.props} sceneDurationInFrames={scene.durationInFrames} />
        </Series.Sequence>
      ))}
    </Series>
  );
};
