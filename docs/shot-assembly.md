# Assemble a multi-shot preview

Export each motion shot using its existing renderer before assembly. This command normalizes and caches supplied visual files, then uses Sahne’s existing final mux. It does not invoke template renderers, cut narration, or master audio.

```sh
pnpm exec tsx scripts/assemble-shots.ts /path/to/local-project
```

Keep the project outside Git. Provide `project.json`, the pinned `channel.style.json`, the storyboard named in the project, a local `catalog/`, and a reviewed PCM audio mix as `master.wav`. Narrated projects must supply the actual corrected transcript referenced by the storyboard. The storyboard must cover the full visual timeline at 30 fps. Millisecond boundaries are rounded to frames.

Use `shots.json` to match every beat ID to one project-relative MP4, PNG or JPEG. Set `renderer` to the versioned export identity. Catalog beats must use the approved catalog file. A newly rendered motion shot can use a generated-source beat. Supply the pinned template manifests when the project declares template pins.

```json
{
  "shots": {
    "intro-motion": {"file": "visuals/intro.mp4", "renderer": "hyperframes@0.9.20"},
    "photo-detail": {"file": "catalog/detail.jpg", "renderer": "stock-still-v1"},
    "closing-b-roll": {"file": "catalog/closing.mp4", "renderer": "stock-video-v1"}
  },
  "templates": []
}
```

Verified shots remain in `.sahne-shot-cache/` if a later shot fails. Fix the reported shot and rerun the same command. Modified media, renderer identity, frame count, pinned style, or template manifests change the cache key. The command reports reuse per shot and writes a `shot-preview-*.mp4` draft. Keep cache and preview files private.

Run the synthetic three-shot integration fixture with FFmpeg installed:

```sh
node --import tsx --test tests/assemble-shots.test.ts
```
