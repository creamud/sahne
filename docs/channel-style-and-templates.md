# Channel identity, video projects, templates and assets

> First product architecture contract for [#29](https://github.com/yesvus/sahne/issues/29). **Metadata and two template sources**, not a full brand-management UI or marketplace.

## Why we distinguish these concepts

| Entity | Responsibility | Ownership / location | Example |
| --- | --- | --- | --- |
| **Channel** | Stable creative identity: palette, typography, motion tempo, characters and design rules | Private channel profile; example metadata may be open | A systems-explainer YouTube channel |
| **Video project (episode)** | One production: approved script, actual recorded narration, corrected transcript, storyboard, template pins and exports | Private production workspace, usually Google Drive; local scratch during renders | “How an HTTP request travels” |
| **Template** | Parameterized **recipe** for a recurring visual treatment | Reusable public/private source; renderer-specific implementation | Text highlight, macOS-inspired window, flow diagram |
| **Asset** | Specific produced or licensed media/source, provenance and review status | Private/public asset catalog | Approved HTTP-request WebM/MP4, character illustration |
| **Character reference** | Persistent design identity across episodes; an approved sheet referencing cataloged assets | Part of channel identity and asset library | Same mascot, silhouette, palette and expressions |

**Important:** A template is *not* an asset. It is a repeatable function that produces shots, sometimes by consuming assets. The project pins the specific version it used so rerendering is not silently changed by future template updates. Templates don't replace upstream HyperFrames/Avenox; they **feed them**.

## Storage and scope

Existing private Drive structure remains valid; add a `Channels/` folder **only when there is a real channel profile to store**, rather than empty scaffolding:

```text
Sahne Production/
├── Ideas/
├── Channels/
│   └── <channel-id>/
│       ├── channel.style.json       # versioned identity
│       ├── characters/              # reference-sheet assets and notes
│       └── lookbook/                # approved image/frame references
├── Videos/
│   └── <episode-id>/
│       ├── video.project.json       # pinned channel style revision + template versions
│       ├── script.md
│       ├── audio/
│       ├── transcript.json
│       ├── storyboard.json
│       └── exports/
└── Asset Library/
    └── <asset-id>/
        ├── metadata.asset.json
        ├── source/
        └── renders/
```

The channel style file, character sheets, working scripts and Drive identifiers are **private**. This public repository only stores schemas, generic templates and synthetic examples. Don't edit synced Drive media during renders.

## Style inheritance and consistency

1. **Channel profile is authoritative.** Current typography defaults to Montserrat for display and body text (SIL OFL 1.1); font choice is overridable in a new channel style revision. Each channel profile has `channelId` + incrementing `revision`. Its colors, typefaces, motion direction and character identities are shared across the channel's videos.
2. **Each video pins one channel revision.** Replaying a video against a different revision must fail rather than silently drift. Upgrading is an explicit editorial decision, with before/after previews.
3. **Each template pins an ID and version** such as `kinetic-text-highlight@1.0.0`. Its approved input schema describes content, not brand identity.
4. **Channel tokens override template defaults.** Template authored defaults are preview fallbacks. A caller supplies text/images and other declared inputs, but cannot pass `channelAccent` as arbitrary content and escape the channel style policy.
5. **Characters are reference assets**, not just textual prompts. Preserve the approved identity sheet, allowable expressions, silhouettes and style across episodes. Rendering/source reference consistency still requires human visual QA; validation cannot guarantee generated media looks identical.
6. **Rights and review are independent of branding.** A character reference or downloaded template does not make the media automatically publishable. Asset catalog approval still applies.

The current implementation exposes these checks via `src/production/identity.ts`, and can generate **native HyperFrames variable values** for a template without building a new rendering engine.

## Two initial templates

- [Text highlight](../examples/templates/text-highlight/index.html) — very large kinetic typography with a controlled highlight wipe. No ornamental footers or small type.
- [macOS-inspired window](../examples/templates/macos-window/index.html) — generic desktop window with three traffic lights and a reveal animation. **Use only when explaining software/UI**; it is not a persistent chrome design for every video and does not include Apple trademarks, icons or screenshots.

Both rely on [HyperFrames composition variables](https://github.com/heygen-com/hyperframes/blob/main/docs/concepts/variables.mdx): public inputs such as `headline`, `highlight` and `windowTitle`; plus channel-provided color/font tokens. Reuse the installed upstream CLI, not a custom video rendering API. Existing Remotion renderer is still available for cases it handles better.

### Reproduce an example with pinned style

```bash
pnpm install --frozen-lockfile

# Safe local source data, synthetic defaults only.
# Bypass pnpm lifecycle banners: HyperFrames needs a pure JSON file.
pnpm exec tsx scripts/template-variables.ts \
  examples/identity/channel.style.json \
  examples/templates/text-highlight/template.template.json \
  examples/templates/text-highlight/inputs.json \
  > /tmp/sahne-highlight-variables.json

# In a disposable non-synced work directory:
npm exec --yes --package=hyperframes@0.9.20 -- \
  hyperframes init highlight-demo --example blank --skip-skills --non-interactive
cp examples/templates/text-highlight/index.html highlight-demo/index.html

npm exec --yes --package=hyperframes@0.9.20 -- \
  hyperframes render highlight-demo --fps 30 \
  --variables-file /tmp/sahne-highlight-variables.json \
  --output highlight-demo/renders/highlight.mp4
```

The commands above assume the current directory contains `examples/`. An implementation can instead set working directories/paths explicitly. `template:variables` emits **only JSON** to stdout; errors go to stderr. The generated variables are values for HyperFrames's own `--variables-file`; they do not attempt to execute untrusted templates or check installed media files.

For the macOS window, substitute its `template.template.json`, `inputs.json` and `index.html`.

## Art direction: motion graphics, not website mockups

Feedback from the first [HTTP sample](../examples/hyperframes/http-request/README.md) established that dense dashboard cards, tiny labels, persistent headers/footers, progress bars, technical metadata and miniature paragraphs create the wrong look for informative YouTube B-roll.

Default to:
- **One focal concept per shot**. A bold title, a diagram or a single motion event rather than a page of panels.
- **Large, easily read typography**. The channel's `minimumReadablePxAt1080p` is a baseline, not a substitute for viewing on a phone.
- **Selective visual emphasis**. Highlight a specific phrase or animate the relevant object, not everything simultaneously.
- **Negative space and calm pacing**. Text needs sufficient on-screen hold for actual reading.
- **UI chrome is contextual**. A macOS window template is excellent for demonstrating an application, but shouldn't make every video look like a website.
- **Human preview at final resolution**, plus HyperFrames `check` and spot frames where applicable.

Brand consistency is an important **creative quality constraint**, not a reason to implement a CMS or a large theme engine now.

## Marketplace (later, not MVP)

See [#31](https://github.com/yesvus/sahne/issues/31). A future marketplace could distribute community template packs, but only after the core project has several templates reused in real video productions.

Important security boundary: **templates contain executable HTML/JS or React code**. A future marketplace must pin versions, verify provenance/licenses, define compatibility and treat installation/execution as **untrusted code**, not an automatic download. Creator-owned channel styles and proprietary scripts must not leak into public packs.

Do not implement storefronts, accounts, billing, cloud rendering or package registries before repeat usage and a business model justify their complexity.
