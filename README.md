# Sahne

**Agent-operated, code-driven video production.** Sahne supports localized motion graphics with sound effects **without speech**, as well as optional narration using creator-recorded or externally supplied audio. Reuse existing tools and cataloged assets before writing new renderers.

> **Project status:** the existing implementation is a small Remotion-based scene renderer, **not** a complete narration-to-video pipeline. Product direction is tracked in [#20](https://github.com/yesvus/sahne/issues/20).

## Product docs

- [Vision and MVP](docs/vision.md)
- [Narration-first workflow](docs/production-workflow.md)
- [GitHub vs Drive / asset catalog](docs/storage-and-assets.md)
- [Current renderer architecture](docs/architecture.md)

**Creator flow:** choose a topic → plan visual beats → reuse templates/assets → render localized motion → add SFX → QA. **When narration is wanted**, optionally approve a script, import or record voice, align the actual transcript and mix it with the visuals. No voice is required for SFX-only clips. Keep unpublished scripts and media in a private production workspace, not this public repository.

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

## Assemble final H.264/AAC preview from visual + voice/SFX

After **editing/approving the visual footage** and separately mixing the creator's actual voice with approved timed sound effects, Sahne can perform the final mux **without re-encoding the rendered graphics**:

```bash
pnpm video:assemble private-project/storyboard.json \
  private-project/visual.mp4 \
  private-project/outputs/narration-sfx.wav \
  private-project/outputs/final.mp4
```

The visual must be silent H.264 and both media durations must agree with the language-specific storyboard. This does **not** generate visuals, recognize speech, align captions or approve the creative edit. The automated TR/EN smoke tests use **synthetic tones**, not real narration. See [final video assembly](docs/video-assembly.md).

## Speech-free TR/EN animations (Montserrat + sound effects)

**No narration is required for the motion graphics examples.** Current channel font preference is **Montserrat**, set in the versioned channel style and overridable per channel. The same HyperFrames HTTP scene accepts Turkish or English text through its existing render variables.

```bash
pnpm storyboard:validate - \
  examples/production/storyboard.sfx-only-tr.sample.json \
  examples/production/sound-catalog
```

This validates the **SFX-only** storyboard without inventing a speech transcript. A real locally approved WAV SFX file is needed for actual audio mixing; our CI generates original synthetic test clicks and renders both language editions to reviewable MP4s.

See [speech-free/localized workflow and optional voice inputs](docs/audio-modes-localization.md).

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
