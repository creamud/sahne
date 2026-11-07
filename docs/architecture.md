# Architecture — currently implemented scene renderer (v0)

> **Scope notice:** this describes the existing renderer, **not** the full target product. Sahne's mission is the narration-first production workflow described in [vision](vision.md), [production workflow](production-workflow.md), and [asset storage](storage-and-assets.md). See [#20](https://github.com/yesvus/sahne/issues/20). Avoid interpreting a JSON → MP4 pipeline as an adequate end-to-end MVP.

## Present implementation

```text
JSON scene data ── Zod validation ──> React/Remotion composition
                                             │
                          Remotion Studio preview / render CLI
                                             │
                                   encoded MP4 (out/)
```

## Invariants

- Frame-based and deterministic. The same specification and source revision must produce the same visual content.
- Scene specs are versioned (`schemaVersion: 1`) and do not contain arbitrary executable code.
- Visual design is owned by reusable components. Narration synchronization, multiscene timelines, advanced diagrams, alternative aspect ratios, CLI batch processing and caching are future issues.
- Design tokens can be extended later; avoid building an elaborate framework before three reusable real examples exist.
- The sample uses fake numbers and says so in the frame.

## Current entry points

- `src/index.ts`: register Remotion root
- `src/Root.tsx`: declare composition metadata
- `src/compositions/SahneDemo.tsx`: current demo animation
- `src/schema.ts`: validated scene contract
- `examples/demo.json`: render input for `pnpm render:example`

## Engineering decisions

- Local CLI is the first product; no backend/API/service in MVP.
- CI initially typechecks/tests. Add render smoke tests once the dependency lockfile and Chromium dependencies are standardized.
- External fonts, audio, images, and maps require explicit license/attribution checks.
- Remotion is a separately licensed dependency. Review terms if Sahne evolves into a public automation service.
