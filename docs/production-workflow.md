# Narration-first video production workflow

> Intended v0 production contract. The end-to-end automation is not yet implemented. See [vision](vision.md) and [#20](https://github.com/yesvus/sahne/issues/20).

## Sequence and approval gates

| Stage | Human responsibility | Agent/tool responsibility | Saved artifact |
| --- | --- | --- | --- |
| 1. Idea | Explore topic with ChatGPT; choose angle | Research/outline suggestions | Short idea note |
| 2. Script | Review, revise and explicitly approve spoken text | Draft script and visual concepts | `script.md` (approved revision) |
| 3. Voice | Record narration in own voice; keep retakes | Ingest and normalize audio without destructive edits | Original audio, optional cleaned derivative |
| 4. Transcript | Review ASR errors, emphasis and names | Speech-to-text and timestamp alignment | `transcript.json` with word/segment timing |
| 5. Storyboard | Approve editorial choices where material | Map claims/beats to overlay, B-roll or no graphic | `storyboard.json` / markdown |
| 6. Asset selection | Approve rights, relevance and aesthetics | Search tagged library first; adapt or create missing graphics | `project.json` / asset references |
| 7. Compose | Watch draft and request edits | Align visuals/captions/audio; render clips and cut | Preview video and editable scene sources |
| 8. QA & release | Approve final and publish manually | Check sync, black frames, clipping, audio, provenance | Final master + QA notes |
| 9. Archive | Decide which elements deserve reuse | Label and register reusable assets | Updated asset catalog and Drive archive |

**Definitions:** A **script** is authored before narration. A **transcript** is the recognized speech *after* recording. The script may differ from what was actually said. Use the **recorded audio and corrected transcript timestamps** to schedule visuals, rather than assuming the script was read verbatim.

## Storyboard guidance

Each visual beat should describe:
- `id`, `startMs`, `endMs`, associated narration phrase/word range;
- visual *purpose* (explain, contrast, emphasize, demonstrate);
- visual form (`none`, `overlay`, `full-frame`, `screen-recording`, etc.);
- candidate asset ID or new-scene instructions;
- source material/claim attribution where relevant.

Never fill visual gaps merely to maximize movement. Preserve attention on speech and avoid obscuring meaningful screen content. Word timing can be corrected manually; don't treat ASR timestamps as ground truth when wrong.

## Asset-first production policy

1. Query catalog by semantic description, format, tags and licensing/reuse status.
2. Reuse compatible existing assets unchanged when possible.
3. Parameterize/recolor/relabel editable assets to fit the new narration.
4. Generate a new animation using existing skills/frameworks if there is a genuine gap.
5. Only then consider stock/media generation, with explicit provenance and rights.
6. Register valuable new assets after review; do **not** automatically classify every disposable cut as a reusable asset.

Use an **asset ID** in project manifests rather than hardcoded machine-specific absolute paths. See [storage and assets](storage-and-assets.md).

## Localized narration and sound effects

For Turkish and English productions, preserve the same pinned channel style and reusable templates but record **separate narrations** with **independent transcripts, segment timings and sound-effect cue times**. See [sound design](sound-design.md).

The optional `soundCues` timeline annotates a visual event with a reviewed audio asset ID, duration and quiet gain. A **SFX-only** video is valid without narrator, script or transcript; its display language is independent of speech. A narrated video may import a licensed external voice recording or use the creator's own recording. Use an existing library asset or import a verified-licensed one; avoid adding sound by default to every motion. FFmpeg creates a distinct stereo WAV stem containing the actual narration and the approved timed effects. This stem has not yet been integrated with Avenox's final video mux; the real voice pilot remains open.

## Final assembly handoff

The reproducible technical gap between an already rendered/edited silent video and the reviewed narration+SFX audio is addressed with `pnpm video:assemble`, a thin FFmpeg **stream mux**, not a new editor. Both inputs must match the **localized** storyboard's timebase; an English visual may need different visual hold times than the Turkish counterpart. See [video assembly](video-assembly.md). Actual narration synchronization and human QA remain required before publishing.

## Tooling boundary

Avenox Skills, existing renderer(s), ASR tools, FFmpeg and optionally HyperFrames are separate components. A coding agent can orchestrate them through documented commands. Sahne must not assume one LLM provider, require a new orchestration service, or rebuild a third-party editing package to get started.

Rendering should preserve editable project definitions and use repeatable configuration where possible. Nondeterministic upstream AI outputs can be frozen and versioned before rendering.

## First proof of concept

- Choose a 45–90s systems/engineering script, read and record it.
- Produce corrected timed transcript (prefer word-level timestamps).
- Generate at least three useful, appropriately timed visual beats.
- Reuse at least one previously cataloged asset.
- Produce a watchable video draft and a QA report.
- Save everything needed to reproduce or revise it (except private media in the public repo).
- Compare existing Remotion path with one Avenox/HyperFrames/motion-broll approach: time-to-first-draft, visual quality, editability, license and integration effort.

Record real friction before adding abstractions.
