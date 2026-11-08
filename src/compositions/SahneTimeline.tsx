import React from 'react';
import {AbsoluteFill, cancelRender, getStaticFiles, Html5Audio, Series, staticFile, useCurrentFrame} from 'remotion';
import {getNarrationCue, type TimelineManifest} from '../manifest';
import {SahneDemo} from './SahneDemo';

type Props = {manifest: TimelineManifest};

/**
 * Each Series.Sequence resets the local frame to 0 for the child scene.
 * Scenes do not overlap, so the final duration is the exact sum of frames.
 */
export const SahneTimeline: React.FC<Props> = ({manifest}) => {
  const frame = useCurrentFrame();
  const narration = manifest.narration;
  if (narration && !getStaticFiles().some((file) => file.name === narration.audioPath)) {
    cancelRender('Narration file not found in public/: ' + narration.audioPath);
  }
  const caption = narration?.showCaptions !== false ? getNarrationCue(manifest, frame) : undefined;
  return (
    <>
      <Series>
        {manifest.scenes.map((scene) => (
          <Series.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
            <SahneDemo scene={scene.props} sceneDurationInFrames={scene.durationInFrames} />
          </Series.Sequence>
        ))}
      </Series>
      {narration && <Html5Audio src={staticFile(narration.audioPath)} />}
      {caption && (
        <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', padding: '0 10% 6%', pointerEvents: 'none'}}>
          <span style={{
            boxSizing: 'border-box',
            maxWidth: '100%',
            background: '#071020',
            color: '#fff',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 38,
            fontWeight: 600,
            lineHeight: 1.2,
            overflowWrap: 'anywhere',
            padding: '10px 20px',
            textAlign: 'center',
          }}>{caption.text}</span>
        </AbsoluteFill>
      )}
    </>
  );
};
