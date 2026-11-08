# Sahne: 3-minute production readiness audit and 10-minute roadmap

> Reviewed against `main` on 2026-11-08. Product objective: **watch-ready YouTube videos**, starting with a credible 3-minute episode and later 10-minute productions. This is not a delivery estimate or a claim of completed end-to-end narration.

## Decision

**Do not build a new video editing application now.** Validate the 3-minute vertical slice using existing HyperFrames Studio/Player, Remotion where beneficial, Avenox/MLT for editing, FFmpeg for assembly, and the current Sahne asset/brand/storyboard contracts. Build a **thin creator review app** only after actual editorial changes show that a shared preview, timestamped comments and approvals save work for non-coding collaborators. The app is a production/review surface, not an NLE, render engine, renderer fleet, template marketplace or cloud SaaS.

## Evidence-based implementation audit

| Capability | Status on 2026-11-08 | Evidence/limit |
| --- | --- | --- |
| Deterministic short graphics | Verified, short format | HyperFrames source and 14.5s MP4; Remotion demo/smoke render |
| Template/channel identity metadata | Implemented | Validated pinned style and template metadata; native HyperFrames variables |
| TR/EN localized motion | Verified short demos | CI-generated video frames use distinct TR and EN text |
| Narration and SFX mixing | Implemented, synthetic tested | Optional voice, rights-checked timed effects, audio master; no real human narration |
| Final H.264/AAC mux | Implemented, synthetic tested | Strict duration/fps/PTS checks and video stream copy |
| Rights-aware asset catalog | Implemented metadata only | Approved/cleared filtering, local metadata; not provider search, actual rights verification or cloud ingestion |
| Real recorded voice → transcript → visuals | **Not proven** | Segment-level transcript import and metadata validation only, issue #24 |
| Storyboard → rendered heterogeneous multi-shot timeline | **Missing integration** | Existing small two-scene Remotion demo is not an episode compiler |
| Stock image/video sourcing | **Not integrated** | No reviewed provider/local media ingestion workflow |
| AI still image generation | **Not integrated** | No provider adapter, price/rights ledger or character reference evaluation |
| Captions, upload package and full editorial review | **Not implemented end-to-end** | Output MP4 metadata is not proof of YouTube-ready content |
| 3-minute and 10-minute runtime | **Not proven** | Existing real examples are seconds long; no long-form cache/restart benchmark |

Existing 1080p30/14.5s samples contain **435 frames**; 3 minutes contain **5,400** and 10 minutes **18,000** frames at the same FPS. This is why final production should render/cache by independently replaceable shot; don't render every shot on every code PR or use a giant 10-minute monolithic browser composition as the default.

## Minimal production flow

```text
Topic + references
  → approved outline/script (if narrated)
  → recorded/imported voice (optional for SFX-only)
  → corrected post-edit transcript (for narrated)
  → human-readable shot plan with timing and visual purpose
  → source assets: approved library → licensed stock → graphics template → optional AI still
  → preview each shot → assemble cut → mix approved audio → caption/subtitle pass
  → agent technical QA + human editorial QA → fix affected shots → full watch-through
  → MP4 + captions + thumbnail + title/description/credits → private archive
```

The selected source of timing is the actual edited narration when narrated, and the authored motion timeline for intentionally SFX-only content. Never infer voice approval from a silent/SFX-only preview, and never silently cut speech to fit visuals.

## What to build in order

1. [#24](https://github.com/yesvus/sahne/issues/24) **Complete 45–90s narration pilot** using a genuine approved recording and current tools; this de-risks final audio timing.
2. [#50](https://github.com/yesvus/sahne/issues/50) **Shot-level composition**, source references, incremental renders/cache and resumability; make long-form editing mechanical instead of a single huge HTML document.
3. [#49](https://github.com/yesvus/sahne/issues/49) **Ship one 3-minute watch-ready episode** with licensed/reused assets, final creator review and a private YouTube upload package. Use a particular topic; don't require generic support for every topic first.
4. [#51](https://github.com/yesvus/sahne/issues/51) **Manual-first licensed stock intake** with approvals; provider search comes later and should be replaceable. Never scrape/cache all of a stock service.
5. [#52](https://github.com/yesvus/sahne/issues/52) and [#53](https://github.com/yesvus/sahne/issues/53) **Non-coder timestamped QA and delivery gate**: subtitle timing, audible audio, rights credits, thumbnail/title/description and final MP4 review.
6. [#54](https://github.com/yesvus/sahne/issues/54) **Optional AI still generation** after real asset intake. Keep exact provider/model/prompt/reference image and content hash with a candidate asset. A generative image is not permission to use an individual's likeness or third-party marks.
7. [#55](https://github.com/yesvus/sahne/issues/55) **10-minute benchmark only after 3-minute reliability is demonstrated**: measure CPU/RAM/disk/renders and test restart/cached re-render. No automatic Kubernetes or distributed worker build.

**Out of scope until real demand:** template marketplace (#31), subscription/billing, public cloud backend, new bespoke video editor, autonomous YouTube publication. Resolve the Sahne OSS licence (#13) before telling other users they can redistribute source/templates.

## Stock and AI provider constraints

Start with **manual imports** and optional Openverse search for CC/public-domain candidates; check original provenance, creator attribution and licence before approving. Unsplash API requires attribution, hotlinked preview URLs and its download-location event; the exported media lifecycle needs to respect the provider API conditions. Pexels has free video/photo media and an API, but new API key issuance was paused as of 2026-11-07; do not make it a hard dependency. For AI stills, prefer a small provider abstraction around a single successful adapter, preserve channel visual references, and treat all output as *draft* pending visual and rights review.

Official references:
- https://api.openverse.org/v1/
- https://docs.openverse.org/api/reference/made_with_ov.html
- https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines
- https://help.pexels.com/hc/en-us/articles/900004904026-How-do-I-get-an-API-key
- https://developers.openai.com/api/docs/guides/image-generation
- https://support.google.com/youtube/answer/1722171

## Application decision gate

Use **HyperFrames Studio** for source editing and **HyperFrames Player or private MP4 playback** for review first. If non-coding review friction persists after one real 3-minute episode, a separate minimal local-first UI may show:
- Channel and video-project list, statuses and pinned style.
- Video player with a seekable timeline, current shot and asset/source provenance.
- A fixed set of actions: **approve / reject / replace visual / comment at timestamp / request rerender**.
- An approved/rejected asset candidate queue and before/after shot preview.
- A final release checklist and private export link.

Do not replicate Studio's timeline, effects, transitions, keyframes, browser scene editing or renderer job internals. Multi-user authentication/permissions are unnecessary for a trusted **local-first** first prototype; revisit only before network-exposed access. Treat any future internet-facing instance as a separate security design.

## Measures of actual product progress

Report **finished, human-approved video minutes**, editorial fixes per minute, percent of shots reused, percent rerendered after a review, mean/max render time per shot, human review burden, cost per finished video, media license completeness and repeatable export success. Commit count, prompt count, model tokens and template catalog size are secondary.
