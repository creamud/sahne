# Final video assembly — reuse existing FFmpeg and Avenox

> **Status:** small, tested post-render *mux* step for #37, not a complete editor or human-narrated production. The actual user-voiced pilot remains #24.

## Why this is a separate step

Sahne already has **rendered visual MP4s** from HyperFrames and **mixed narration+SFX WAVs** via `pnpm audio:mix`. The remaining mechanical task is to combine these two artifacts in one MP4 **without re-encoding the already finished graphics**.

Existing tools cover the job:

- **FFmpeg** stream copy / stream selection: `-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac`. This is a container/codec operation, not a new video editor.
- **Avenox Studio**'s [`mltgen.py`](https://github.com/avenoxai/avenoxskills/blob/main/avenox-studio/scripts/mltgen.py) already creates an editable MLT timeline for multiple clips and a continuous audio bed. Use that for multi-shot editing and Kdenlive/Shotcut polish. It currently labels that audio field “music” and defaults to gain 0.15; **do not attenuate human narration as though it were background music**. Use the final post-render mux when the visual editing is already finished.
- For future embedded captions, choose FFmpeg/MLT-native text/subtitle features or an upstream caption tool before creating a custom compositor.

## Local command

```bash
# 1. Generate/approve a visual in HyperFrames/Avenox/Remotion:
#    private-project/visual.mp4 (silent H.264, 30 fps for this example)

# 2. Record/review/edit narration. Build a language-specific storyboard
#    with timestamps based on the FINAL narration, not a translated script.

# 3. Mix approved effects under the spoken audio:
pnpm audio:mix \
  private-project \
  private-project/storyboard.json \
  "/private/Asset Library" \
  private-project/outputs/narration-sfx.wav

# 4. Mux the finished video+audio:
pnpm video:assemble \
  private-project/storyboard.json \
  private-project/visual.mp4 \
  private-project/outputs/narration-sfx.wav \
  private-project/outputs/final.mp4
```

Outputs are structured JSON on success or JSON error to stderr on failure. A successful `video:assemble` verifies **one H.264 video stream and one AAC audio stream**, FPS and timeline duration, and preserves the existing encoded visuals using `-c:v copy`. The same command works for **both Turkish and English**, but requires *each language's* separately timed storyboard, narration and **matching-length visual render**. Do not reuse a 7.1-second Turkish video with 6.2-second English audio without an explicit new editorial edit.

## Fail-closed checks

- The supplied visual must already be a **silent H.264 MP4**. A pre-audible video is refused, to avoid overwriting its soundtrack without editorial inspection.
- WAV narration+SFX master must have exactly one PCM audio stream.
- Video must have constant presentation timing at the storyboard FPS, and **both** source durations must agree with the storyboard within at most roughly two frames. No silent stretching, unapproved audio cuts or implicit “-shortest” truncation.
- Output must be a **new** `.mp4` file, never an existing video/audio/master. Inputs are passed to FFmpeg as argv elements, not through a shell.
- Output is verified by `ffprobe` after encoding. A mux test only proves stream correctness — not editorial timing, clarity, LUFS, true peaks, natural speech or media rights.

## Real vs synthetic status

`tests/video-mux.test.ts` creates a **real H.264 visual**, a synthetic sine tone as a *stand-in* for narration, an original synthetic click effect, mixes them via the actual `audio:mix` CLI, then runs `video:assemble` and checks the final MP4. It runs twice with **separate TR and EN timeline durations**. It also tests refusal of an existing output, pre-audible visual and mismatched timestamps.

**The tones are not speech.** These test files do not prove multilingual ASR, natural narration or YouTube-quality sound design; and they are not distributed as reusable sound effects.

## Still needed for #24

1. Human-approved script and recorded audio with corrected language-specific transcript (Avenox's example ASR currently defaults to Turkish on Apple Silicon).
2. Generate useful storyboard-aligned visuals with good editorial quality; select and review approved assets and real licensed SFX.
3. Verify that the concatenated/human-edited visuals are the exact duration of recorded narration. Use Avenox/MLT for that editing, then Sahne's mux if desired.
4. Inspect the whole resulting video, captions, readability, speech intelligibility, timing, licensing and listen for clipping before final human approval and publishing.

Keep real audio, raw media and exports private (local scratch, then Google Drive archive), not in this public repository.
