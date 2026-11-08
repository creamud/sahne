# Add local narration to a timeline

Add optional `narration` under the existing `manifest` object. Supply a WAV, MP3 or M4A path relative to the public asset directory, plus caption cues in absolute integer milliseconds. Keep private recordings in an external directory supplied through `--public-dir`. Set `showCaptions: false` to hide on-screen captions while keeping the audio. Manifests without narration render as before.

Each cue covers the half-open frame range from `round(startMs × 30 / 1000)` to `round(endMs × 30 / 1000)`. Both ends come from absolute timestamps, so rounding does not accumulate. Keep cues sorted and non-overlapping and revalidate them after changing the cut. Trim the approved voice track to the intended timeline outside Remotion. Captions are burned into the picture when visible. For selectable captions use the repository’s separate caption export.

## Three scene timing fixture

The following local smoke fixture uses generated tones, so no voice recording or stock audio is checked in. The three tone onsets, scene starts and cue starts share times 0, 2 and 4 seconds.

```sh
assets=$(mktemp -d)
mkdir -p "$assets/voice" out
ffmpeg -v error -f lavfi -i 'aevalsrc=0.16*sin(2*PI*440*t)*lt(mod(t\,2)\,0.18):s=48000:d=6' "$assets/voice/demo.wav"
node --input-type=module > out/narrated.json <<'JS'
import {readFileSync} from 'node:fs';
const {manifest} = JSON.parse(readFileSync('examples/two-scenes.json', 'utf8'));
manifest.scenes.push({...manifest.scenes[0], id: 'closing'});
for (const scene of manifest.scenes) scene.durationInFrames = 60;
manifest.narration = {
  audioPath: 'voice/demo.wav',
  cues: ['Birinci sahne', 'İkinci sahne', 'Üçüncü sahne'].map((text, index) => ({
    startMs: index * 2000, endMs: (index + 1) * 2000, text,
  })),
};
console.log(JSON.stringify({manifest}));
JS
pnpm exec remotion render src/index.ts SahneTimeline out/narrated.mp4 --props=out/narrated.json --public-dir="$assets"
```

Inspect frames 59/60 and 119/120. Captions should change at the same frame as each new scene. To render a narrated edition, replace the generated tone with your approved voice track and update cues from the actual recording. Missing audio fails explicitly and invalid or overlapping cue ranges fail manifest validation.
