# Export corrected narrator captions — SRT and WebVTT

Sahne can export **sidecar** captions from a **human-corrected Avenox transcript** synchronized to the actual recorded or imported narration. There is no invented word-level alignment: Avenox's current example emits **segment-level timestamps in seconds**, which Sahne converts to integer milliseconds.

## Command

```bash
pnpm captions:export \
  "/private/episode" \
  "/private/episode/storyboard.json" \
  "/private/episode/outputs/episode-tr"
```

The storyboard must declare a `narration` block with a **project-local `transcriptPath`**. The command reads that transcript, validates each segment's order and timing against the final storyboard duration, and writes:

- `/private/episode/outputs/episode-tr.srt` (SubRip, comma-millisecond timecode);
- `/private/episode/outputs/episode-tr.vtt` (WebVTT, dot-millisecond timecode).

Both are UTF-8, keep Turkish and English Unicode, and are written with restrictive file permissions. Existing subtitle exports are **never overwritten**. Speech-free/SFX-only projects correctly reject narrated caption export rather than inventing speech.

This produces **uploadable caption sidecars**, not burnt-in subtitles. No cloud services or YouTube API calls. It does not perform speech recognition, clean voice, correct misheard words or verify on-screen safe areas.

## Editorial requirements

- Review the actual recording *after any cuts or retakes*, then correct the transcript **text and segment timecodes**. Never reuse timings from a translated script or from the other language's recording.
- Each segment must fit in **two lines of at most 42 characters per line**. Long segments fail with a request to correct the transcript's segmentation/timecodes; Sahne deliberately does **not** synthesize timing for new word splits.
- Transcript segments must not overlap or extend beyond the storyboard duration. Gaps are permitted when the narrator pauses. XML/HTML-like text is escaped to avoid accidental formatting.
- For TR/EN editions, create separate sidecars using each video's final recording and storyboard. For YouTube, choose the actual spoken language and watch the uploaded captions at full speed.
- A creator must review the entire caption track after any timeline or audio edit; these files are **draft exports** until confirmed.
- Keep real transcripts, recordings, unpublished scripts, subtitles and private project paths **outside the public GitHub repository**.

## Next for #53

Caption sidecars are only one delivery component. Still missing: mastered audio loudness QA, black-frame/flicker/error inspection, final full-video human approval, thumbnail/title/description/rights ledger, and a complete private YouTube upload package. Do not close #53 until the real episode is shipped.
