# Sahne

**An agent-operated, narration-first video production workflow.** Sahne aims to turn creator-approved scripts and human-recorded narration into timed, reviewable YouTube videos with reusable B-roll and editable motion graphics. Reuse existing tools and cataloged assets before writing new renderers.

> **Project status:** the existing implementation is a small Remotion-based scene renderer, **not** a complete narration-to-video pipeline. Product direction is tracked in [#20](https://github.com/yesvus/sahne/issues/20).

## Product docs

- [Vision and MVP](docs/vision.md)
- [Narration-first workflow](docs/production-workflow.md)
- [GitHub vs Drive / asset catalog](docs/storage-and-assets.md)
- [Current renderer architecture](docs/architecture.md)

**Creator flow:** brainstorm in ChatGPT → approve a script → record real voice → align the audio transcript → storyboard → reuse or generate visuals → render → QA → archive reusable assets. Keep unpublished scripts and media in a private production workspace, not this public repository.

## Asset catalog (first implemented production component)

Sahne can validate and search local copies of private reusable-asset metadata. It does **not** integrate with the Drive API or render narrated videos yet.

```bash
pnpm assets:validate "/path/to/Asset Library"
pnpm assets:search "/path/to/Asset Library" "client server"
```

The CLI reads `*.asset.json` sidecars and returns JSON on success; on failure it writes a JSON `{ "error": "..." }` object to stderr and exits nonzero. Search defaults to **approved assets with cleared rights**, and `--all` includes drafts for inspection. Keep private files and Drive IDs out of this public repository. See [asset catalog format and storage](docs/storage-and-assets.md).

## Narration storyboard validation (first integration boundary)

Use Avenox Studio's existing transcription pipeline and validate its timed **segment-level** output against a human/agent-authored storyboard. This **does not** perform transcription, generate graphics or render the final narrated video.

```bash
pnpm storyboard:validate examples/production/transcript.sample.json examples/production/storyboard.sample.json examples/production/catalog
```

The sample contains **synthetic metadata**, not real voice or produced video. Real audio and unpublished plans must stay outside the public repo. See [storyboard contract and upstream Avenox integration](docs/narration-storyboard.md).

## Code-driven B-roll visual spike (silent)

A small [HyperFrames HTTP request animation](examples/hyperframes/http-request/README.md) demonstrates editable HTML/GSAP motion graphics rendered to a 14.5-second 1080p30 MP4 using an existing open-source renderer. It is **silent** and uses illustrative content. It demonstrates graphic production only; a real recorded narration and end-to-end integration are still tracked in [#24](https://github.com/yesvus/sahne/issues/24). No custom rendering engine is introduced.

## Channel styles and reusable templates (first metadata contract)

Channel identity (typography, colors, motion and character reference sheets) is **versioned and pinned per video**. Visual templates accept content variables but use the channel's style tokens, so an episode or newly downloaded template cannot silently change the channel's established look.

Two initial HyperFrames-native examples are [large text highlight](examples/templates/text-highlight/index.html) and [macOS-inspired UI window](examples/templates/macos-window/index.html). These are **editable template sources**, not a marketplace or a complete editor.

```bash
pnpm template:variables examples/identity/channel.style.json \
  examples/templates/text-highlight/template.template.json \
  examples/templates/text-highlight/inputs.json
```

See [channel/style and template architecture](docs/channel-style-and-templates.md). No hosted service, template marketplace or automatic third-party code installation has been introduced.

## Narration-first sound design (Turkish + English)

Sahne now supports **optional timed, rights-checked sound-effect cues** under the creator's own narration. Turkish and English audio tracks have independent transcript/cue timings but may reuse the same channel style, video templates and licensed sound effects.

```bash
pnpm storyboard:validate examples/production/transcript.sfx-tr.sample.json \
  examples/production/storyboard.sfx-tr.sample.json \
  examples/production/sound-catalog

pnpm storyboard:validate examples/production/transcript.sfx-en.sample.json \
  examples/production/storyboard.sfx-en.sample.json \
  examples/production/sound-catalog
```

The samples are **metadata-only**: no human voice or downloadable sound pack is committed. For actual private audio, use `pnpm audio:mix <project-dir> <storyboard.json> <local-assets-dir> <output.wav>`. It invokes FFmpeg, not a custom audio engine.

See [sound-design contract](docs/sound-design.md) and the [reuse-first research protocol](docs/research-and-reuse.md).

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

## Current implementation — renderer baseline

- **Scene specification:** versioned JSON validated with Zod.
- **Visual implementation:** React components and frame-driven animation primitives.
- **Preview:** Remotion Studio; **export:** Remotion CLI → MP4.
- **MVP limit:** local-first, one example composition and one template. More templates, CLI automation and quality checks are tracked in [issues](https://github.com/yesvus/sahne/issues).

See [development and CI](docs/development.md), [architecture](docs/architecture.md), and the [style guide](docs/style-guide.md) and [agent instructions](AGENTS.md).

## Current renderer scope and licensing

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
