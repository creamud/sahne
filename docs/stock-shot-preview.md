# Local approved-shot preview (technical vertical slice)

This command creates a **silent H.264 MP4** from an existing storyboard containing contiguous, frame-aligned beats referencing approved, rights-cleared **local** still images, B-roll MP4s or pre-rendered motion-graphic MP4s.

It uses FFmpeg, not a custom video editor. It does not fetch stock assets, render template briefs, mix audio, add captions, provide editorial cuts or prove licensing. Those remain separate production steps.

## Usage

First import and **human-review** the stock still/video with [stock intake](stock-intake.md); optionally register your own already-rendered motion MP4 in the private asset catalog with reviewStatus: approved and rights.clearance: cleared. Only approve actual reuse rights after checking the original source and license.

- The first storyboard beat starts at 0ms. Subsequent beats begin exactly when the previous one ends.
- Each beat duration is an integer number of frames at the storyboard FPS (30 or 60).
- The final beat ends at storyboard.durationMs.
- Generated briefs cannot yet be rendered here. Import pre-rendered visuals as approved local assets.
- Still images must be PNG/JPEG, and B-roll/motion footage must be MP4.
- Video clips begin at the start of the original source. If the source does not contain enough frames, preview creation **fails**; it never silently loops or stretches a clip.

Run from the repository root:

    pnpm video:shots:preview \
      /private/project/storyboard.json \
      /private/catalog \
      /private/project/visual-preview.mp4

Output is **1920 × 1080** at storyboard FPS, with one H.264 video track and no audio. Sources are checked for catalog containment and SHA-256 when available. Encoded shot frame counts and final output duration are checked. Output must be new, never an existing preview.

For narrated work, use the real edited narration and validated transcript to choose storyboard timing before previewing. To add mastered audio use [video assembly](video-assembly.md) with a correctly timed audio mix.

## Validation and limits

The stock-shot-preview test generates genuine synthetic PNG and H.264 inputs with FFmpeg, imports/approves stock, adds an original motion graphic, refuses unapproved inputs and checks a three-shot silent export with **90 actual frames** at 30 FPS. This is reproducible, non-copyrighted technical QA only.

The preview does **not** prove editorial quality, commercial reuse rights, real human narration, smooth cuts, color consistency, creative suitability or approved YouTube upload. It does not create incremental shot caches or recover failed multi-shot renders. Those remain in [issue #50](https://github.com/yesvus/sahne/issues/50). A watch-ready three-minute episode remains [issue #49](https://github.com/yesvus/sahne/issues/49).

Keep private videos, metadata, credits and finished MP4s outside this public repository.
