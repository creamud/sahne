# Sahne motion style guide (v0.1)

This is a deliberately small foundation for code-driven 1920×1080 educational graphics. It is **not** a browser UI design system.

## Canvas and hierarchy

- Default aspect ratio: **16:9**, 1920×1080 at 30 fps.
- Background `#0b1220`; primary text `#f8fafc`; muted text `#a8b5c8`; bar track `#1e293b`.
- Safe padding: **150 px horizontal** and **105 px vertical**, applied once by `SceneCanvas`.
- Use Arial/Helvetica system fallback. Eyebrow **24 px**, title **78 px** (adaptively **68/58 px** for long titles), subtitle **28 px** (24 px for longer text), metric label **34 px**.
- Preserve generous whitespace and avoid more than four metrics per frame. Smaller fonts should be introduced deliberately, not by scaling all elements.
- Theme-specific accent colors are passed as `#RRGGBB` values; the scene schema validates their syntax.

## Color contrast

The relative luminance helper in `src/design/tokens.ts` calculates WCAG-style contrast ratios. The palette's main and muted text pass **4.5:1** contrast against the default dark background; tested example accents pass **3:1**. New themes should preserve at least 4.5:1 for small text and 3:1 for large text and non-text information, where applicable.

This is not an automatic accessibility guarantee: images, tiny text, chart semantics and rapidly moving visuals still need review.

## Motion timing

- **Frame-driven only**: no `setTimeout`, CSS keyframe timelines or random render-time state.
- Helpers `normalizedFrameProgress`, `easeOutCubic`, `getEnterExitMotion`, and `getMetricBarProgress` are pure functions of frame and declared duration.
- Header uses a short ease-out entrance and mild pre-cut exit. Metrics stagger in and finish filling before their scene ends.
- Scene-local duration is passed explicitly to templates embedded in a `Series.Sequence` so a short clip does not accidentally inherit total composition duration.
- One-to-three-frame cuts show static content rather than disappearing during their entrance.

## Review workflow

In Remotion Studio, inspect the first frame, a mid-animation frame, and the final frame of each scene. Verify text is not cropped, no labels collide, and the scene boundary does not leave residual graphics. The CI smoke render verifies valid H.264 output but not aesthetic quality.

Keep these primitives small. Extract more only after real compositions demonstrate repeated needs.
