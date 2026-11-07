# HyperFrames HTTP flow visual spike

**Status:** code-driven, **silent** visual proof of concept. This is not the narration-first end-to-end pilot in [#24](https://github.com/yesvus/sahne/issues/24), and it is not tied to real spoken audio.

## Purpose

Test the smallest part of the Avenox-style pipeline that we can verify without a creator narration recording: **editable HTML/GSAP → HyperFrames → inspectable MP4**. No custom render engine, new UI, AI video diffusion, proprietary graphics or video-generation APIs.

The sample is a 14.5-second, 1920×1080, 30 FPS animated HTTP request explainer: introduction, client → gateway → server route, and an **illustrative** `200 OK` status. It is a generic explanatory concept, not a measurement or an actual captured network trace.

## Prerequisites

- Node.js 22 or newer, a working npm CLI, FFmpeg/ffprobe.
- Network access for the initial HyperFrames package, Chromium and the template GSAP CDN script.
- Enough local disk space for frame capture. Render into a **local non-synced scratch directory**, not an active Google Drive/rclone mount.
- [HyperFrames](https://github.com/heygen-com/hyperframes) v0.9.20 (Apache-2.0); the HTML uses GSAP from the CDN referenced by HyperFrames's own blank scaffold.

## Reproduce

From the repository root:

```sh
npm exec --yes --package=hyperframes@0.9.20 -- hyperframes init sahne-demo --example blank --skip-skills --non-interactive
cp examples/hyperframes/http-request/index.html sahne-demo/index.html
cd sahne-demo
npm exec --yes --package=hyperframes@0.9.20 -- hyperframes lint .
npm exec --yes --package=hyperframes@0.9.20 -- hyperframes render . \
  --output renders/http-flow-draft.mp4 --fps 30 --workers 2 --quality draft
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 renders/http-flow-draft.mp4
```

The present example deliberately keeps 3 sections in one HTML file. HyperFrames may report **nested_structure_needs_subcomposition** lint *warnings*; no reusable editor abstraction is warranted solely for this throwaway spike. If subsequent agent authoring or visual QA shows a need, use upstream sub-composition conventions rather than designing another renderer.

On the initial macOS test workstation (`zombie`), a custom `~/.local/bin/npm` wrapper delegates to a missing pnpm binary. The built-in Homebrew CLI `/opt/homebrew/bin/npm` worked. This is **local environment configuration**, not a Sahne dependency or reason to change the user's global package tooling.

## Quality checklist

- Inspect the first frame and seconds 2, 5.8, 8.4 and 12.0.
- Confirm legible headers/cards, expected packet motion, no blank screens, and consistent 16:9 boundaries.
- Confirm exact output FPS, dimensions, and duration using ffprobe.
- Keep the HTML as the editable source and MP4 as the viewable derivative.
- Do not mark this sample as a cleared reusable production asset without a creator review, even if all code is original.

## Production boundaries

- This sample is **silent** by design. An approved human voice recording is still required for the actual `script → record → transcribe → storyboard → render` pilot.
- The [Avenox Skills](https://github.com/avenoxai/avenoxskills) production skill already provides rough-cut, transcription, MLT/FFmpeg editing and HyperFrames graphic workflows. We should integrate with its existing steps before building an editor or orchestration service.
- In a real production, the corrected transcript from **the recorded voice after edits** is the timing source of truth, with [Sahne's storyboard validation](../../../docs/narration-storyboard.md).
- Store completed exports and reusable assets in private Google Drive *after* rendering; never use the Drive mount as the active media workspace.

## Open decisions

Evaluate whether one reusable visual beat can be tagged, reviewed and reused in a second narrated video, and whether the Avenox MLT template supports narration-only source audio without a silent video base. Neither is proven by this silent demo.
