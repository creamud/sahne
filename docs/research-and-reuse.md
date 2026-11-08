# Reuse-first research protocol

> Policy: **Before adding a Sahne subsystem, check whether a maintained upstream tool already does it.** Integrate or contribute upstream whenever feasible; don't clone the implementation unless a concrete gap and licensing constraints justify it.

## Lightweight decision workflow

1. State the **user-visible production problem**, not the implementation you'd like to build.
2. Search upstream projects, published skills, libraries, their release notes and issues; distinguish demonstration claims from verified code.
3. Check **license**, hosted/automated use rights, media/template asset redistribution, dependencies, OS/hardware assumptions and maintenance.
4. Run the smallest **real local experiment** with the user's type of input (including Turkish/English if relevant).
5. Decide: **adopt**, **adapt/wrap**, **contribute upstream**, or **implement the smallest missing seam**. Record why, with links and measurable evidence.
6. Avoid creating issue/PR duplicates for capabilities already tracked; re-evaluate if new upstream releases close the gap.

## Known upstream options (reverify before decisions)

| Need | Existing options | Why this matters |
| --- | --- | --- |
| Video edit / rough cut / graphics | [Avenox Skills](https://github.com/avenoxai/avenoxskills) | Use its established operator workflow and renderer integration; avoid a custom NLE |
| HTML/CSS/GSAP motion graphics | [HyperFrames](https://github.com/heygen-com/hyperframes) | Already rendered and QA'd for Sahne; no new scene renderer needed |
| Narration transcript, cuts, B-roll | [video-alchemy](https://github.com/kingbootoshi/video-alchemy), [motion-graphics](https://github.com/Barty-Bart/motion-graphics) | Compare before inventing transcript/EDL tools; check OS and language support |
| Agent-controlled NLE and multi-track audio | [Kinewright](https://github.com/CanadaApollo6/Kinewright) | Existing deep audio editing; GPLv3/legal integration review needed |
| Local audio filter mixing | [FFmpeg](https://ffmpeg.org/ffmpeg-filters.html) | Trim, delay, volume, mix and limiter exist: use filters instead of new DSP |
| Low-friction interface SFX | [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 option; provenance still tracked |
| Code-first React scenes (existing baseline) | [Remotion](https://www.remotion.dev/) | Preserve present rendering code but check commercial automation licensing |

These are **candidates**, not claims that all features are present or compatible. Maintain a clear distinction between an open-source library's *code license*, imported third-party media rights and a hosted service's commercial terms.

## Ongoing watch

A separate **Sahne Research Radar** automation is configured for weekly research. It reviews genuinely new upstream releases and empirical demos in agentic video production, B-roll, transcript alignment, template libraries, audio/SFX and bilingual voice-first editing. It reports up to five developments with sources, dates, relevance and an **adopt/evaluate/ignore** decision. It does not mutate GitHub without explicit approval.

Research summaries should identify whether a newly upstreamed component makes an existing Sahne issue redundant. Do not treat each headline as a new feature requirement. **KISS: recurring review, occasional evidence-based change.**
