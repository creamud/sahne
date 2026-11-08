# Render the same timeline in landscape and Shorts

Sahne registers `SahneTimeline` at 1920×1080 and `SahneTimelineShorts` at 1080×1920. Both run at 30 fps. Select the composition on the CLI and pass the same structured scene data to both. The existing landscape default and `SahneDemo` remain available.

```sh
pnpm exec remotion render src/index.ts SahneTimeline out/landscape.mp4 --props=examples/two-scenes.json
pnpm exec remotion render src/index.ts SahneTimelineShorts out/shorts.mp4 --props=examples/two-scenes.json
```

The side-by-side fixture is the same `examples/two-scenes.json` in both commands. Add `--frames=60-89` for a one-second boundary preview. Both layouts change scenes between frames 74 and 75 and produce 180 frames when rendered in full.

The Shorts canvas uses 100 px horizontal and 185 px vertical padding. Its content is centered vertically and reflows with a 0.9 size scale. The landscape canvas retains its original padding and typography. Unsupported canvas sizes fail explicitly.

Inspect both outputs at normal speed and around the boundary. Verify that titles, labels, numbers and bar edges remain visible. Player overlays vary across devices, so also watch the vertical cut in the intended Shorts player before release.

Run the preset-selection checks with `node --import tsx --test tests/canvas-presets.test.ts`.
