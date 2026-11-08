# Create a private video review packet

Keep the project outside Git. The project directory needs `project.json`, `channel.style.json`, the storyboard referenced by the project, and a rendered preview MP4. Run with FFmpeg and ffprobe installed.

```sh
pnpm exec tsx scripts/review-packet.ts /path/to/private-project episode-r03 cut.mp4
```

Send the resulting `review-episode-r03/` folder to the reviewer through an approved private channel. Open `preview.mp4` in a video player and `REVIEW.md` in a Markdown viewer or text editor. The notes include the revision and preview SHA-256, a timecoded shot map and up to 12 linked midpoint stills. Narrated projects should also provide the approved script and corrected transcript through the same private channel.

The reviewer watches the complete cut and records the timestamp range, what happened, the requested change and its priority. Reuse the notes template for every finding. Use a new revision slug when the preview changes. An existing packet and its notes are preserved. Record the exact new revision when a finding is verified by a human.

The command checks the preview’s frame rate and duration against the storyboard and extracts representative frames. It does not check factual claims, source rights, captions or creative quality. Use the [creative QA playbook](creative-qa-playbook.md) for final review.

Run the local fixture with `node --import tsx --test tests/review-packet.test.ts`.
