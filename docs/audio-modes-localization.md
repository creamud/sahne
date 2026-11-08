# Voice-free motion graphics, on-screen language and optional imported voice

> Sahne supports **visuals + sound effects without speech**. Voiceover is an optional production mode, not a universal requirement. See [#39](https://github.com/yesvus/sahne/issues/39).

## The two supported production modes

| Mode | Inputs | Transcript? | Outputs |
| --- | --- | --- | --- |
| **SFX-only** | Animated visuals, on-screen TR/EN text and approved timed SFX assets | **No.** No fictional script or voice audio should be created. | H.264/AAC MP4 with sound effects but no speech |
| **Narrated** | Any supplied voice recording (creator's own **or imported/external**), corrected actual transcript, visuals and optional SFX | **Yes**, for spoken-beat alignment | Voice/SFX WAV, then H.264/AAC MP4 |

Audio generated elsewhere can be **imported as a local WAV or other FFmpeg-readable sound file**, provided the creator has usage rights. The `source: imported` value in `narration` is informational provenance; it does not install or invoke a TTS provider. Sahne must not demand a personal voice recording, a commercial account or a particular provider.

**SFX-only media is not silent media.** Its video graphics are rendered silent, but an approved sound-effects mix is joined during final MP4 assembly. The same native FFmpeg `audio:mix` and `video:assemble` paths are reused; no second audio renderer exists.

## Turkish and English writing

On-screen **display language is independent of narration**. `storyboard.language` or a video's `language` may be `tr` or `en`. A sound-effects-only video has no `narration` object. In a narrated video, the display language and spoken language must agree for a single edition; separate editions get their own scripts, timing and renders.

The cinematic HTTP example uses **native HyperFrames composition variables** rather than hardcoded labels. See:
- [Turkish display variables](../examples/hyperframes/http-request-cinematic/tr.variables.json)
- [English display variables](../examples/hyperframes/http-request-cinematic/en.variables.json)

The same scene geometry, camera, palette and motion are reused. No new localization library, dubbing API or font-rendering service is needed.

**Text QA:** Do not treat English and Turkish labels as the same width. Preview and inspect Turkish glyphs, especially `Ç Ğ İ I Ö Ş Ü ı ğ ş ç ö ü`, and maintain large readable text with safe margins. The SFX-only sample has no microcopy, faux headers or dashboard cards.

## Channel typography: current default Montserrat, replaceable

The versioned channel profile controls `visual.typography.displayFont` and `bodyFont`. The current example profile sets both to **Montserrat**. Individual templates consume the channel's font variable and **cannot silently override its identity**; a deliberate new channel style revision may switch to Inter, Noto Sans or another appropriately licensed font.

[Montserrat](https://github.com/JulietaUla/montserrat) is licensed under **SIL Open Font License 1.1**. We install the system font on the render runner and include an optional Google Fonts stylesheet for browser previews. **No font binaries are redistributed in the public repo or shared in chat.** Offline editors should install fonts locally or use a licensed equivalent. Brand font choice must be a production config value, not a permanent global dependency.

## Reproduce SFX-only media using the existing tools

```bash
# Render the native HyperFrames scene with either language's variable JSON.
npm exec --yes --package=hyperframes@0.9.20 -- hyperframes render \
  /local/hyperframes-project --fps 30 \
  --variables-file examples/hyperframes/http-request-cinematic/tr.variables.json \
  --output /local/work/visual-tr.mp4

# Validate timing and approved local sound assets. A hyphen means
# there is intentionally NO voice transcript.
pnpm storyboard:validate - \
  examples/production/storyboard.sfx-only-tr.sample.json \
  /local/work/approved-assets

# Generate a 48-kHz PCM WAV using the audio mixer's existing FFmpeg
# filters. It creates the backing silent timeline itself (anullsrc).
pnpm audio:mix \
  examples/production \
  examples/production/storyboard.sfx-only-tr.sample.json \
  /local/work/approved-assets \
  /local/work/sfx-only.wav

# Join the already-rendered silent video + SFX WAV to final MP4.
pnpm video:assemble \
  examples/production/storyboard.sfx-only-tr.sample.json \
  /local/work/visual-tr.mp4 \
  /local/work/sfx-only.wav \
  /local/work/tr-final.mp4
```

The sample asset catalog includes **metadata for a synthetic test click only**; its WAV is generated during CI, not bundled or approved as a production sound library. Review actual SFX, provenance and listening balance before publishing.

The [HyperFrames bilingual SFX preview CI](../.github/workflows/hyperframes-preview.yml) performs the above end-to-end operation **for both TR and EN**, verifying 14.5 seconds, 1080p30, H.264/AAC and providing contact sheets and MP4 artifacts.

## Narrated inputs (optional)

A narrated storyboard retains `narration.voicePath`, `approvedScriptPath`, `transcriptPath`, and an optional `narration.source` of `creator-recording` or `imported`.

```json
{
  "language": "tr",
  "narration": {
    "language": "tr",
    "source": "imported",
    "voicePath": "audio/ready-voice.wav",
    "approvedScriptPath": "script.md",
    "transcriptPath": "transcript.json"
  }
}
```

**Do not interpret source=imported as permission to use third-party audio.** Usage rights and final editorial review still apply. Use the recording's real timecodes, not a translated script's estimated duration.

## Editorial workflow policy

Voice-free clips can ship after visual/sound/rights QA. **They are not blocked on anyone recording a voice.**

Long-form narrated videos remain a separate optional product workflow. The creator may record their own voice or provide a licensed/imported audio recording; a real voice track is required **only when that specific video calls for narration**.

Use upstream Avenox, HyperFrames, FFmpeg and existing font tooling first. No bespoke audio engine, dubbing system, font server, TTS subsystem or marketplace is justified by these requirements.
