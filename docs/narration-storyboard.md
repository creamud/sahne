# Narration-driven storyboard contract (v0)

> **Implementation status:** a metadata/timing validation boundary, **not** a transcription, audio-editing, motion-graphics generation or video-rendering pipeline. Tracks [#25](https://github.com/yesvus/sahne/issues/25) as one step toward the real human-voice pilot in [#24](https://github.com/yesvus/sahne/issues/24).

## External tools: integrate, don't rebuild

[Avenox Skills](https://github.com/avenoxai/avenoxskills) already provides local transcript/rough-cut, graphics and edit/export skills. Use its existing setup and keep media scratch **on local disk, outside Google Drive sync and outside this public repository**. After the final export/approval, archive the master and reusable assets into a private Drive workspace.

The published `avenox-studio/scripts/transcribe.py` uses **mlx-whisper** (Apple Silicon) and is currently configured for **Turkish**. Its output resembles:

```json
{
  "text": "The client sends a request.",
  "segments": [
    {"start": 0.2, "end": 1.8, "text": "The client sends a request."}
  ]
}
```

Times are **seconds** and **segment-level**, not word-level. The Sahne importer validates this shape and converts timestamps to integer milliseconds. If you edit silence/flubs before graphics, **retranscribe the final cut** or explicitly remap timecodes; otherwise the visuals drift.

The upstream helper currently puts output into a `transcript/` directory relative to its own `avenox-studio/` root. Copy the generated JSON into your **private** per-video work directory. Do not check in raw narration, transcript, unpublished script, or Google Drive file IDs.

## Validation contract

The new `storyboard.json` contains:

- `narration.voicePath`, `approvedScriptPath`, `transcriptPath`: private project-relative paths. These are **declared references**, not evidence of editorial approval or file existence.
- `fps`: 30 or 60. Choose a format for the pilot and keep it consistent through editing/rendering.
- `durationMs`: proposed narration timeline duration. It must cover all recognized speech. **Validate it against actual audio duration in the real pilot.**
- `beats[]`: sequential, non-overlapping visual beats with `startMs` and `endMs`, `treatment` (`overlay` or `cutaway`), an editorial `cueText` and a **zero-based `cueSegmentIndex`**.
- `source`: either `{"kind":"asset","assetId":"stable-id"}` or `{"kind":"generate","brief":"..."}`. Reused assets must exist in the private catalog, have `reviewStatus: approved` and `rights.clearance: cleared`.

Every beat must overlap the referenced **transcript segment**. `cueText` is an editorial description, **not** a verified exact spoken quotation. Segment timestamps are approximate: this guards against obvious errors, **not frame-/word-perfect alignment**. Intro/outro/pauses and layered overlaps are left for a later explicit edit-plan design instead of pretending to support them now.

## Run the synthetic metadata-only example

```bash
pnpm install --frozen-lockfile
pnpm storyboard:validate \
  examples/production/transcript.sample.json \
  examples/production/storyboard.sample.json \
  examples/production/catalog
```

The sample illustrates three timed beats, reusing one ID in two beats. The example asset is a **synthetic test fixture**, NOT a produced video and NOT actual proof of copyright clearance. The example narration paths do not point to real recordings. CLI success verifies **metadata only**, not media files, audio quality, editorial approval or rendered video.

For a real project, pass actual private local paths to transcript, storyboard and an asset-catalog directory. The CLI prints structured JSON on success, or a JSON error on stderr with nonzero exit status. Asset metadata stays separate from binary footage; see [storage and assets](storage-and-assets.md).

## Localized sound cues

The storyboard also optionally accepts `narration.language` (`tr` or `en`) and `soundCues[]`. Sound cues have a stable ID, time in milliseconds, duration, gain in dB, approved audio asset ID and optional linked visual beat. A cue's trigger must fall within the referenced beat, and its audio must have cleared usage rights. English and Turkish tracks must maintain **independent timing**; Avenox's published ASR helper is currently Turkish-configured.

See [sound design](sound-design.md) for the existing FFmpeg mixer, metadata-only examples and real-recording quality gates.

## Human review and next integration

1. Approve the script, record narration, edit any retakes.
2. Run the upstream Avenox ASR on **the edited narration** to produce timed transcript JSON, correct obvious ASR errors.
3. Draft visuals against the real segment timeline. Search/reuse existing licensed assets before generating new ones.
4. Validate the storyboard with `pnpm storyboard:validate`.
5. **Still to be implemented/tested:** translate approved beats into Avenox/HyperFrames clips and an MLT/FFmpeg narration-first timeline. Avenox's sample `edit.json` mainly assumes video inputs and optional music; the pilot must explicitly preserve recorded narration as the primary audio track.
6. Render a draft, inspect timing/caption/audio correctness, obtain creator approval, archive final artifacts.

Don't build a new editor, renderer or hosted service just to bridge this step. Keep the current Remotion example as a separate backend until a quality comparison provides reason to change it.
