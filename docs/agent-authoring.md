# Author and review a Sahne clip

## One-page procedure

1. Record the viewer takeaway, language, aspect ratio and exact duration. Pin the channel style revision and template version. Label invented data as illustrative and keep private assets and inputs outside the repository.
2. Inspect existing examples. Use Remotion `SahneTimeline` and the [v1 manifest](scene-manifest.md) for supported metric scenes. Use existing HyperFrames templates for kinetic text and interface scenes. If the current checkout has no suitable template, record a coverage gap or compose the shot in the existing renderer. Never invent an unsupported manifest type.
3. Save editable content as JSON. For Remotion, pass the outer props object with `--props`; `SahneTimeline` validates it in composition metadata. For HyperFrames, resolve pinned channel tokens and declared content with `pnpm exec tsx scripts/template-variables.ts`, then pass the resulting JSON with `--variables-file`. Fix validation errors before rendering.
4. Preview the start, middle, end and both sides of scene boundaries. Check glyphs, safe areas, contrast, visual hierarchy, label accuracy and time to read. Render the selected composition at the declared size and FPS. Verify duration and codecs with ffprobe and watch the exported clip at normal speed.
5. Apply feedback at the reported timecode. Change the smallest input or shot that fixes the issue, rerender and compare the same frames. Record the revision and keep the prior preview available to the reviewer. Human approval remains explicit.

## Repeatable evaluation prompts

Run each prompt from the same clean checkout and channel revision. Keep all examples silent unless an audio brief is given. Use 1920×1080 at 30 fps, and retain editable inputs and a local MP4 or a documented coverage gap.

| ID | Give the agent this prompt | Expected output |
| --- | --- | --- |
| Chart | Create a six-second chart of illustrative worker utilization. A is 62%, B is 81%. | Two labeled bars, same scale, B taller, values match the input and are marked illustrative. |
| Comparison | Compare illustrative battery life of Device A (8 h) and Device B (12 h) in six seconds. | Comparable units and baseline, B is longer, both labels stay legible. Use an existing metrics scene if a dedicated comparison template is unavailable. |
| Flow diagram | Show a request moving Client → Gateway → Server in six seconds. | Three named nodes, two correctly directed connections, one marker follows the full route in order. An unsupported Remotion manifest type is a coverage gap. |
| Math explanation | Explain why 25% of 80 is 20 in eight seconds. Reveal the equivalence 25% = ¼, then 80 ÷ 4 = 20. | Both equations are correct, revealed in order, readable without a narrator and kept inside the safe area. |
| Typography | Highlight “A bigger picture.” after “One small signal.” in a six-second clip. | Correct phrases and reading order, channel font and palette, highlight stays behind the intended phrase without clipping. |

### Score each result

| Check | Pass condition |
| --- | --- |
| Schema validity | Actual project validation succeeds and the renderer accepts the declared props or variables. |
| Visual clarity | Expected properties above pass at normal speed. Inspect start, midpoint and end, plus any boundary. |
| Determinism | Two renders from identical pinned inputs show the same timing and frame content in the same renderer environment. Compare decoded video with `ffmpeg -i clip.mp4 -map 0:v:0 -f framemd5 -` if needed. |
| Edit effort | Change one value or phrase and record minutes, human interventions and shots rerendered. Pass if the requested edit stays scoped and unrelated shots remain unchanged. |

Mark each check pass, fail or blocked. Record prompt ID, commit, template/style versions, outcome, edit time, interventions and evidence. A coverage gap is blocked, with the missing primitive named. It is not a passing render.

## Worked example · recover from missing highlight text

From the repo root with dependencies installed, prepare a disposable HyperFrames project and render the current short example.

```sh
set -e
work=$(mktemp -d)
template=examples/templates/text-highlight
npm exec --yes --package=hyperframes@0.9.20 -- hyperframes init "$work/preview" --example blank --skip-skills --non-interactive
cp "$template/index.html" "$work/preview/index.html"
resolve_vars() {
  pnpm exec tsx scripts/template-variables.ts examples/identity/channel.style.json \
    "$template/template.template.json" "$1"
}
render() {
  npm exec --yes --package=hyperframes@0.9.20 -- hyperframes render "$work/preview" \
    --fps 30 --workers 2 --quality draft --strict \
    --variables-file "$work/vars.json" --output "$work/$1.mp4"
}
resolve_vars "$template/inputs.json" > "$work/vars.json"
render original
printf '%s\n' '{"headline":"One small signal."}' > "$work/edited.json"
if resolve_vars "$work/edited.json" > "$work/vars.json"; then
  echo 'Expected the missing highlight to be rejected' >&2
  exit 1
fi
# Expected error: Missing required template parameter: highlight
printf '%s\n' '{"headline":"One small signal.","highlight":"A bigger picture."}' > "$work/edited.json"
resolve_vars "$work/edited.json" > "$work/vars.json"
render corrected
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,r_frame_rate:format=duration "$work/corrected.mp4"
```

Expect 1920×1080 H.264 at 30 fps and six seconds. Inspect around 0.6, 3 and 5.5 seconds. The edited phrase should appear inside the highlight, with no collision or truncation. The original MP4 remains available for comparison. This workflow requires no LLM API key.
