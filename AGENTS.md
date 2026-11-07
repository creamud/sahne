# Agent instructions — Sahne

## Mission
**Product mission:** support a human creator making narration-first YouTube videos with an agent-operated script → voice recording → timed transcript → storyboard → asset reuse/creation → render → review workflow. The creator supplies and approves the script and their own voice. See [docs/vision.md](docs/vision.md), [docs/production-workflow.md](docs/production-workflow.md), [docs/storage-and-assets.md](docs/storage-and-assets.md), and [#20](https://github.com/yesvus/sahne/issues/20).

**Implementation today:** a deterministic Remotion scene renderer. Treat that as a component, not the full product. Prefer invoking/adapting proven tools such as Avenox Skills and existing renderers over duplicating them. Do not introduce diffusion video generation, a custom editor, cloud infrastructure, or new orchestration services without an explicit product decision.

## Product workflow constraints

- Use approved scripts for editorial intent, but align visuals to the **actual recorded audio** and corrected transcript timestamps.
- Search/inspect approved cataloged assets before generating new B-roll or motion graphics. Track provenance, rights, stable asset IDs and editable source.
- Human gates: script approval and final video QA/publishing; do not auto-publish.
- `yesvus/sahne` is public: **never commit unpublished scripts, recordings, Drive file IDs, private storyboards, credentials or binary video archives**.
- Tool/provider agnostic and local-first. Do not make Remotion vs HyperFrames migration decisions without a sample-based evaluation.
- Treat `docs/vision.md` as the product direction and `docs/architecture.md` as the current renderer implementation. Re-triage legacy issues under [#1](https://github.com/yesvus/sahne/issues/1) against [#20](https://github.com/yesvus/sahne/issues/20).

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
