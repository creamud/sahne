# Scene manifest v1

A scene manifest is **data, not executable code**. It describes a deterministic Remotion composition. Sahne presently supports one scene `type`: `metrics`. More templates will be added under issue #5.

## Format

```json
{
  "manifest": {
    "schemaVersion": 1,
    "scenes": [
      {
        "id": "example-a",
        "type": "metrics",
        "durationInFrames": 75,
        "props": {
          "schemaVersion": 1,
          "title": "Illustrative load",
          "subtitle": "Synthetic values, not measurements",
          "accentColor": "#4cc9f0",
          "metrics": [{"label": "Worker A", "value": 72}]
        }
      }
    ]
  }
}
```

The top-level `manifest` property is the input-props object passed to the Remotion composition; it is not part of the manifest schema itself. `examples/two-scenes.json` contains a full two-scene example.

## Timing model

- Default canvas: **1920×1080**, **30 fps**.
- Durations are **positive integer frames**, not floating-point seconds.
- Scenes play in array order and never overlap in v1.
- Scene windows are **half-open** `[startFrame, endFrameExclusive)`. For durations 75 and 105, the windows are `[0,75)` and `[75,180)`.
- Remotion's `<Series.Sequence>` resets the local frame of each scene to 0, so entrance animations replay correctly.
- `calculateMetadata` derives the composition's total frames from the validated manifest and rejects invalid input before rendering.

V1 allows 1–60 scenes, at most 1800 frames per scene, and at most 18000 frames in total (10 min at 30 fps). IDs must be unique lowercase hyphenated identifiers. Unknown properties, scene types and nested values are rejected by Zod. Invalid scenes produce issue paths such as `scenes.1.durationInFrames`.

## Render

```sh
pnpm render:timeline
```

The output is `out/timeline-demo.mp4`. To inspect a boundary quickly, use `pnpm render:timeline:smoke` (frames 60–89, crossing the first scene ending at frame 74).

## Version evolution

- V1 manifests must retain their meaning. Add new template types as validated variants without changing existing field semantics.
- For incompatible changes, introduce `schemaVersion: 2` with an explicit conversion layer or a clear error; do **not** silently reinterpret v1 data.
- Keep the old `SahneDemo` composition and its `scene` input props for backward compatibility while the new timeline evolves.
- Content values must be sourced or explicitly described as illustrative. Sahne cannot validate factual truth automatically.
