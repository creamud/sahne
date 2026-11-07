# HTTP request — cinematic visual revision (v2)

> **Status:** GitHub Actions rendered and inspected a 14.5-second H.264 1080p30 **silent** preview. The v2 asset remains **draft** pending creator approval. The original v1 archive remains untouched.

## Why this revision exists

The original HTTP B-roll successfully proved **HTML/GSAP → HyperFrames → MP4**, but the first review identified too much miniature copy, panels, permanent headers/footers and general web/dashboard styling.

This revision follows [#30](https://github.com/yesvus/sahne/issues/30):

- **Intro:** very large editorial text and one highlight wipe.
- **Journey:** a simple three-node diagram (`Client → Gateway → Server`) animated by a traveling point rather than information cards. No constant UI chrome.
- **Outro:** a large, uncluttered illustrative `200 OK` response.
- **Channel color inputs:** `channelAccent`, `channelBackground`, `channelForeground` are HyperFrames-native composition variables and can be supplied from a pinned channel style. For project/template identity architecture, see `docs/channel-style-and-templates.md` once #29 lands.

Everything remains code-driven, deterministic in principle, **silent** and non-diffusion. This is **not yet** a recorded-narration video.

## Render locally when a workstation is available

Use upstream HyperFrames v0.9.20 and FFmpeg, as tested for the earlier v1. Work outside a Drive/rclone sync folder:

```bash
# From the Sahne repository root:
npm exec --yes --package=hyperframes@0.9.20 -- \
  hyperframes init sahne-cinematic-demo --example blank --skip-skills --non-interactive
cp examples/hyperframes/http-request-cinematic/index.html sahne-cinematic-demo/index.html

npm exec --yes --package=hyperframes@0.9.20 -- \
  hyperframes check sahne-cinematic-demo
npm exec --yes --package=hyperframes@0.9.20 -- \
  hyperframes render sahne-cinematic-demo --fps 30 --workers 2 \
  --output sahne-cinematic-demo/renders/http-flow-v2.mp4

ffprobe -v error \
  -show_entries format=duration:stream=codec_name,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 sahne-cinematic-demo/renders/http-flow-v2.mp4
```

**Verified** on a GitHub-hosted Linux runner: H.264, 1920×1080, 30 FPS, 14.5 s. A path-scoped [HyperFrames preview workflow](../../../.github/workflows/hyperframes-preview.yml) also runs `hyperframes check` and uploads MP4/contact-sheet artifacts. The rendered sample is **silent**.

## Review checklist

- [x] HyperFrames `check` passes with no runtime/layout/motion/contrast errors; benign example-level nesting warnings remain.
- [x] Extracted and inspected representative frames at approximately 2.35s, 7.4s and 11.7s.
- [ ] Confirm no tiny UI text, no accidental occlusion and enough reading time.
- [x] Verified 14.5s, 1080p and 30fps with ffprobe in Actions and again on downloaded MP4.
- [x] Archived tested v2 under a **new** private Drive video folder without overwriting v1.
- [ ] User approves before `reviewStatus=approved` or automatic asset reuse.

### Deployment note

At the time the revision began, `zombie` was unreachable from `gurbet`. A GitHub-hosted visual QA workflow provides independent reproducibility when local workstations are offline. **Do not imply this substitutes for real voice-over integration or creator editorial approval.**

The original silent v1 proof can be found in [the predecessor](../http-request/README.md).
