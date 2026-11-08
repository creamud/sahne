# Check a private release candidate

Place the final MP4 at `final.mp4` and the matching storyboard at `storyboard.json` in a private local project. For a narrated edition, point the storyboard to the corrected Avenox-format transcript of the final recording, with segment timestamps in seconds. Declare Turkish or English for each edition and rerun after any timing edit.

```sh
pnpm exec tsx scripts/release-qa.ts /path/to/private-project
```

The command expects one H.264 1080p square-pixel stream at the storyboard frame rate and one 48 kHz stereo AAC stream. Both streams must match the storyboard duration within one frame. It flags missing progressive or BT.709 tags, profile mismatches, black intervals of at least 0.35 s, narrated silence of at least 1.5 s below −45 dB, and audio sample peaks at or above −1 dBFS. These are local review thresholds. See the [YouTube encoding recommendations](https://support.google.com/youtube/answer/1722171).

The private `release-qa/` directory contains a JSON report and, for narrated editions, UTF-8 SRT and WebVTT captions. Existing output directories are preserved. Caption cues retain segment boundaries and reject overlap or timestamps beyond the final streams. Long lines and fast reading are review flags. SFX-only editions do not generate captions automatically. See [YouTube caption formats](https://support.google.com/youtube/answer/2734698).

The report always requires human review. Watch the entire export, verify the spoken text and cue timing, and clear rights and credits before manually uploading. This check does not measure integrated loudness, detect flicker, or certify a release package.

Run the synthetic failure fixture with `node --import tsx --test tests/release-qa.test.ts`.
