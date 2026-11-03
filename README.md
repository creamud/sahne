# Sahne

**Code-driven motion graphics for educational videos.** Sahne turns structured content into deterministic, editable animations and MP4 clips. It is designed for coding agents, not diffusion-based video generation.

## Quick start

Requirements: Node.js 22+, pnpm 10+, and a machine able to run Chromium (Remotion installs/uses a supported browser).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open Remotion Studio to inspect and scrub **SahneDemo**.

```bash
pnpm render:example
```

This exports `out/sahne-demo.mp4` (1920×1080, 30 fps, six seconds). The example metrics are **illustrative, not measurements**.

To customize the input, edit [examples/demo.json](examples/demo.json). To change animation design, edit [src/compositions/SahneDemo.tsx](src/compositions/SahneDemo.tsx).

```bash
pnpm typecheck
pnpm test
pnpm render:smoke
pnpm verify:smoke
```

## Architecture

- **Scene specification:** versioned JSON validated with Zod.
- **Visual implementation:** React components and frame-driven animation primitives.
- **Preview:** Remotion Studio; **export:** Remotion CLI → MP4.
- **MVP limit:** local-first, one example composition and one template. More templates, CLI automation and quality checks are tracked in [issues](https://github.com/yesvus/sahne/issues).

See [development and CI](docs/development.md), [architecture](docs/architecture.md) and [agent instructions](AGENTS.md).

## Scope and licensing

No diffusion/video-generation models, SaaS dashboard, Kubernetes, cloud render farm or custom timeline editor in v0.

Sahne itself has no assigned open-source license yet: `public` on GitHub does **not** automatically grant redistribution rights. Remotion has its own [license conditions](https://www.remotion.dev/docs/license/). Choose a Sahne license in a dedicated issue before encouraging reuse.

## Resources

[Remotion](https://www.remotion.dev/docs/) · [Parameterized videos](https://www.remotion.dev/docs/parameterized-rendering) · [CLI](https://www.remotion.dev/docs/cli/)

## Multi-scene timeline (v1)

Edit [examples/two-scenes.json](examples/two-scenes.json) to change the ordered scenes and their durations.

```bash
pnpm render:timeline
pnpm render:timeline:smoke
```

The full sample is six seconds and consists of two 2.5s/3.5s scenes. The smoke test renders 30 frames across the scene boundary. See [scene manifest format](docs/scene-manifest.md).
