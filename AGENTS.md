# Agent instructions — Sahne

## Mission
Produce deterministic motion graphics and informative animations **from code**. Do not introduce diffusion-based video generation, prompt-to-video model APIs, a custom timeline editor, or cloud infrastructure without an explicit product decision.

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
