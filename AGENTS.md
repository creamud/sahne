# Agent instructions — Sahne

## Mission
**Product mission:** produce Turkish/English code-driven videos with reusable templates, branded typography and sound effects. **SFX-only videos have no spoken narration**. For optional narrated editions, accept either the creator's own recording or a licensed externally supplied audio file; only narrated videos require a corrected speech transcript. See [docs/vision.md](docs/vision.md), [docs/production-workflow.md](docs/production-workflow.md), [docs/storage-and-assets.md](docs/storage-and-assets.md), and [#20](https://github.com/yesvus/sahne/issues/20).

**Implementation today:** a deterministic Remotion scene renderer. Treat that as a component, not the full product. Prefer invoking/adapting proven tools such as Avenox Skills and existing renderers over duplicating them. Do not introduce diffusion video generation, a custom editor, cloud infrastructure, or new orchestration services without an explicit product decision.

## Product workflow constraints

**Primary release objective:** complete human-reviewed, YouTube-watch-ready 3-minute episodes before prioritizing 10-minute throughput. Read the [production readiness roadmap](docs/product-readiness-roadmap.md) and [creative QA playbook](docs/creative-qa-playbook.md) before accepting long-form video or authoring features. A render test passing is not a published-quality video. When a non-coding creative reviewer reports a problem, respond with **the exact video timestamp, changed shot, new private preview and before/after visual result** rather than a code-oriented explanation. Respect the human final approval gate and do not leak private previews.


- **SFX-only:** never invent a voice file, transcript or mandatory spoken script. Align visual events and approved SFX against the motion timeline. **Narrated:** align visuals to the actual provided/recorded audio and corrected transcript timestamps.
- Search/inspect approved cataloged assets before generating new B-roll or motion graphics. Track provenance, rights, stable asset IDs and editable source.
- Human gates: approve a narration script **only if speech is actually used**, and always review final video QA/publishing; do not auto-publish.
- `yesvus/sahne` is public: **never commit unpublished scripts, recordings, Drive file IDs, private storyboards, credentials or binary video archives**.
- Tool/provider agnostic and local-first. Do not make Remotion vs HyperFrames migration decisions without a sample-based evaluation.
- Treat `docs/vision.md` as the product direction and `docs/architecture.md` as the current renderer implementation. Re-triage legacy issues under [#1](https://github.com/yesvus/sahne/issues/1) against [#20](https://github.com/yesvus/sahne/issues/20).

## Asset catalog (v0)

Before designing new visual assets, search approved entries with `pnpm assets:search <local-catalog-dir> <query>`; use `--all` only for review. Keep real sidecars with Drive IDs or private production metadata outside this public repository. The catalog schema and parser are in `src/assets/`; see `docs/storage-and-assets.md`. This is **not** a Drive integration or a reason to build a DAM.

## Narrated storyboard validation (metadata only)

When an approved script and **real** recorded narration are available, use upstream Avenox tooling for ASR/rough cutting. It produces timestamps in **seconds** for speech **segments**; see `docs/narration-storyboard.md`. The local `pnpm storyboard:validate` command checks a timed transcript against a storyboard and a rights-cleared asset catalog. It does **not** transcribe, process audio or render final video.

Never schedule visual cues using unverified pre-recording script timestamps. Corrections/retakes change the spoken timeline; use the actual post-edit recording. Keep any private transcript and audio outside the public repo. Don't claim synthetic fixtures constitute a real video proof.

## Channel identity and template consistency

Before adding a new graphic or template, read `docs/channel-style-and-templates.md`. **Channel is the stable creative identity; video projects pin a channel style revision and template versions; assets are reviewed outputs/sources.** Montserrat is the current default, **not a fixed dependency**; use the channel's overridable font tokens and verify Turkish glyphs. Do not let a downloaded template override a channel's palette/typefaces or change recurring character identities. Keep character reference sheets and unpublished channel/video metadata private.

For visual direction, prefer one dominant concept per shot, large typography, ample empty space and meaningful animation. Avoid faux-website dashboard cards, permanent UI chrome, dense captions, small technical labels and decorative progress bars in explanatory B-roll. The macOS window template is appropriate **only when actual software/UI is being explained**.

Use upstream HyperFrames composition variables instead of a custom parameterized renderer. `pnpm template:variables` resolves approved content parameters plus pinned channel tokens for HyperFrames `--variables-file`; do not execute arbitrary marketplace template code or add a marketplace in v0.

## Reuse-first development and bilingual sound

**Before implementing any feature**, consult `docs/research-and-reuse.md` and assess existing maintained solutions (Avenox Skills, HyperFrames, FFmpeg, video-alchemy, other relevant upstream projects) plus their **licenses and actual capabilities**. Prefer a small wrapper/contribution over rebuilding video/audio infrastructure. A weekly research radar exists to catch changes; do not automatically file issues for headlines.

**Bilingual production:** Turkish (`tr`) and English (`en`) share the same reusable graphics and channel identity. **On-screen copy can change without any speech.** Voice/audio/transcripts only exist for narrated editions (creator-recorded or imported); timings of narrated editions remain independent.

**Sound design:** `docs/sound-design.md` describes rights-checked SFX cues and `pnpm audio:mix`. Use the existing asset catalog (`category: audio`), **only approved/cleared** sounds, and native FFmpeg filtergraphs. For SFX-only clips no voice or transcript is necessary; for narrated clips the supplied voice is authoritative. Effects remain sparse, subtle and tied to animation events. Real voice/audio binaries and Drive IDs must not be committed to public GitHub. Automated sine-wave audio tests do not prove human speech clarity or licensing.

## Final audio+video handoff (no new editor)

After preparing a **silent H.264 visual MP4** in upstream Avenox/HyperFrames/Remotion and a reviewed narration+SFX WAV via Sahne's FFmpeg mix, use `pnpm video:assemble` to **mux** them into H.264/AAC MP4 without video re-encoding. See `docs/video-assembly.md`. Validate FPS and independently recorded language-specific durations; never silently trim speech to make it fit video or replace an already-audible video. If source clips still require editorial cutting or captions, use existing Avenox/MLT tools, not a new video editor.

## Stack
Node.js 22+, pnpm 10+, TypeScript/React, Remotion 4 (pin `remotion` and all `@remotion/*` packages to exactly the same version), Zod.

## Rules
1. Keep scene **content** in JSON/typed data and visuals in React components.
2. Animations MUST depend on `useCurrentFrame()` (and `useVideoConfig()` where needed). No `setTimeout`, CSS keyframe animation, arbitrary nondeterministic `Math.random()` or stateful playback-dependent movement.
3. Validate untrusted scene data. Make metrics/claims in example animations explicitly illustrative unless sourced.
4. Treat 1920×1080 at 30 fps as the default output; other formats need explicit options.
5. Keep MVP local-first and make additions testable. Avoid new dependencies unless there is a concrete need.
6. Run `pnpm typecheck` and `pnpm test` before PRs; render a sample MP4 for visual changes when a supported browser is available.
7. When editing visual components, use Remotion Studio and inspect beginning, middle, and final frames; no clipped text, unreadable fonts, or off-canvas items.
8. Track work in scoped GitHub issues with acceptance criteria. Use feature branches and PRs for substantial changes.

## Official guidance
- https://www.remotion.dev/docs/
- https://www.remotion.dev/docs/ai/coding-agents
- https://www.remotion.dev/docs/license/

Install the official Remotion Agent Skills locally with `pnpm exec remotion skills add` if appropriate. Do not commit generated vendor skill files without review.

## Multi-scene manifests

Prefer a versioned JSON manifest over hand-coded one-off sequences. V1 supports ordered `metrics` scenes with explicit integer `durationInFrames` and typed scene `props`. Validate with `manifestSchema`, keep IDs unique, and use `getSceneWindows()` for half-open boundaries. See `docs/scene-manifest.md`.

Do not bake scene durations into global time calculations or use wall-clock time. New scene types must be introduced through a schema variant and renderer dispatch with tests.

## Visual primitives

Use `src/design/tokens.ts` for typography, colors and 16:9 safe-area defaults; use pure functions in `src/design/motion.ts` for timing and easing. Assemble templates from `SceneCanvas`, `SceneHeader`, and `MetricBar` rather than duplicating CSS or interpolation logic. The duration passed to a scene within a `Series.Sequence` must be the **local** duration, not the total video duration. Inspect contrast and clipping at 1080p. See `docs/style-guide.md`.


## Sentence-to-motion clips

When the creator supplies a sentence for a standalone motion graphic, default to a character-free, SFX-only clip. Use a few unboxed keywords in the channel’s typeface and omit corner captions, generic badges, and decorative labels. Use the graphic itself to communicate the change. If the input gives only a qualitative scale, avoid inventing exact figures, percentages, or axis values.

When the subject is a named product or brand, place its verified product mark next to its name in the upper-left subject header. Prefer an official brand asset and follow its usage guidance. If the mark cannot be verified or cleared, use the name alone. Do not substitute another product’s mark or commit third-party brand artwork to the repo.

Match licensed effects to visible events. Use a short pencil-on-paper cue for a drawn underline and a soft, quiet bubble pop for a bubble reveal. Omit celebratory stingers. Keep effects sparse and avoid adding narration or music to the sentence-to-motion format unless requested.

When a sentence names a real object, device, or place, prefer relevant real footage or photography when a suitable licensed asset is available. Use motion graphics alongside it to explain mechanisms or relationships that the footage does not show. Record the source and license in the project notes, follow attribution requirements, and keep third-party footage out of the repository.
