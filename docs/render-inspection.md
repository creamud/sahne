# Inspect smoke render frames

From the repository root, render the existing illustrative JSON fixture and extract the first, middle and last frames. Use a new output directory for every extraction.

```sh
pnpm render:smoke
pnpm verify:smoke --stills out/local-smoke-stills
```

CI attaches the same three PNGs for the single scene and the scene-boundary fixture in the `sahne-render-inspection` artifact. The verifier checks 1080p30 H.264, a nonzero duration near one second and 30 decoded frames before exporting indices 0, 15 and 29. The single-scene and timeline fixtures remain JSON in `examples/demo.json` and `examples/two-scenes.json`.

Review the PNGs and play the clip at normal speed. Check that headings and values fit, contrast stays readable, motion remains continuous through the scene boundary, and the displayed data matches the illustrative fixture. PNGs come from the encoded video with no separate browser or font request. CI does not compare pixel snapshots.
