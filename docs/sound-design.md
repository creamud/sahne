# Sound design — narration first

> Initial implementation for [#35](https://github.com/yesvus/sahne/issues/35). The creator's original narration is the dominant audio. A sound effect is an optional, timed supporting event — not something placed on every animation.

## Existing tools, not another audio editor

[Avenox Skills](https://github.com/avenoxai/avenoxskills) already handles transcription, editing and rendering with MLT/FFmpeg, but its current `mltgen.py` edit-list supports an optional single continuous music bed, not independent timed effects. **FFmpeg** already provides trim, delay, gain, mixing and limiting; use these filters to produce an independent PCM WAV audio master. Do **not** write an audio DSP engine, MIDI system, editor or bespoke time stretch feature.

Candidate media packs: [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) (CC0) for subtle UI clicks, optionally other licensed sound libraries. Source/license/provenance must be attached to each approved audio asset. A library license may permit inclusion in an exported video but **not resale or redistribution as a stand-alone SFX pack** — verify this before any marketplace idea.

## Same video, two languages

Each localized rendition has its **own** `script`, `narration`, `transcript`, `storyboard`, `soundCues` and export. The *channel style*, visual templates and approved sound assets can be shared, but **timecodes must come from the specific recording in the specific language**. A Turkish sentence may be longer than the English equivalent. Do not rescale another language's cues blindly.

Avenox's published `transcribe.py` is currently configured for **Turkish on Apple Silicon** and returns **segment-level** timestamps; explicit English language setup/ASR adapter is needed for the English recording. The examples below use invented transcripts and are not proof of real bilingual ASR.

The stereo master is prepared with FFmpeg; an editor can later mux this alongside visuals using upstream Avenox/MLT tooling. **A full narration-plus-video render is still not implemented or approved.**

## Metadata contract

`storyboard.json` now accepts **optional** `narration.language: "tr" | "en"` and `soundCues[]` (existing visual-only projects remain valid). An example cue:

```json
{
  "id": "request-click",
  "assetId": "synthetic-click-v1",
  "atMs": 650,
  "durationMs": 200,
  "gainDb": -22,
  "visualBeatId": "client-request"
}
```

- `atMs` anchors the effect **in the recording's timeline**, not the draft script.
- `visualBeatId` optionally explains the intended screen event; its timestamp must fall inside the referenced visual beat.
- Effect clips are capped at 30 seconds in this v0 contract; gains may range from **−48 to −6 dB** (never silently full volume).
- The cue must end within the recorded narration timeline, and the asset must exist in the **approved, rights-cleared, audio** catalog.
- `atMs` should ordinarily coincide with a meaningful event (click, reveal, movement, transition); avoid sound on every text movement.

SFX **are assets**, not templates: same stable ID, rights/license/provenance and asset files as other reusable items. Use `category: audio` and semantic tags, e.g., `click`, `whoosh`, `impact`, `transition`. Channel-level sonic identity (preferred family, loudness, density) can initially be described in a private channel style note; no new database/schema required.

## Local CLI

```bash
pnpm install --frozen-lockfile

pnpm storyboard:validate \
  examples/production/transcript.sfx-tr.sample.json \
  examples/production/storyboard.sfx-tr.sample.json \
  examples/production/sound-catalog

pnpm storyboard:validate \
  examples/production/transcript.sfx-en.sample.json \
  examples/production/storyboard.sfx-en.sample.json \
  examples/production/sound-catalog
```

These are **metadata-only** illustrative examples. They deliberately contain no genuine voice recording or imported sound pack. The fictitious approved asset record in `sound-catalog` is a *test fixture*, **not** authorization to use an absent real sound file.

With your actual **private, locally accessible** post-edit narration and an approved SFX catalog containing real audio:

```bash
pnpm audio:mix \
  "/local/private/video-project" \
  "/local/private/video-project/storyboard.json" \
  "/local/private/Asset Library" \
  "/local/private/video-project/outputs/narration-sfx.wav"
```

The tool rejects missing media, catalog path traversal/symlink escapes, non-audio or unapproved effects, unsupported remotely stored assets that have not been downloaded locally, and mismatched narration-vs-storyboard durations. It never replaces an existing output master. It emits a machine-readable JSON result. **It is not an ASR, time-stretching or loudness-mastering service.**

Current FFmpeg mix: 48kHz stereo 24-bit WAV, explicit effect gains, non-normalizing `amix`, peak limiter. This protects against obvious summation peaks but does **not** guarantee consistent perceived loudness: listen and inspect loudness/true peak before publication. Do not mechanically target an LUFS number without understanding delivery normalization and spoken-word intelligibility.

## Synthetic actual-audio smoke test

`tests/sound-mix.test.ts` generates short mono sine WAVs for a simulated voice and click (no copyrighted recordings, no TTS, no private data), runs the real FFmpeg mixer twice — **Turkish 7.1 seconds**, **English 6.2 seconds** — then probes both output codecs, durations, channel layouts and sample rates. It also rejects symlinked catalog media escaping the allowed directory. CI installs FFmpeg before running these tests.

**This test demonstrates audio mixing mechanics only.** No actual Turkish/English narrator has been recorded or heard, and the test tones are not production sound effects.

## Next steps / quality gates

1. Choose two or three licensed sounds with good tonal consistency and add complete metadata outside the public repository.
2. Approve a real TR or EN script and record its narration.
3. Run language-correct ASR on the **actual post-edit recording**, correct names and timings.
4. Let the agent annotate visual beats with sound cues, deliberately sparse by default.
5. Listen to the voice+SFX WAV and edit gains/cues; check no audible clipping, harsh transients or masked words.
6. Feed the mixed narration WAV into Avenox's rendering/editor workflow and export a reviewable MP4, then obtain human approval.
7. Keep creative sound assets in private Drive after processing; store source/metadata with permissions, not just the mixed file.

Research/upstream reuse is required before adding any more audio subsystem; see [research and reuse](research-and-reuse.md).
