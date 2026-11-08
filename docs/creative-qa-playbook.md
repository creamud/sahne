# Creative QA playbook: a non-coding reviewer and an AI coding agent

> A working agreement for a **two-person** Sahne production team. The reviewer is not required to know TypeScript, FFmpeg, GitHub CI or how the shot was implemented. Creative QA is different from engineering code review. Related [#52](https://github.com/yesvus/sahne/issues/52).

## One video, explicit roles

| Role | Can decide | Must deliver |
| --- | --- | --- |
| **Creator / editor (human)** | Topic, claims, style, pacing, language, assets, final film approval | Approved script if narrated; recorded or approved imported audio; acceptance or actionable timestamped notes |
| **Creative reviewer (human, no coding required)** | Is it visually compelling, legible, coherent, on-brand and pleasant to watch? | Full-video watch-through, timestamped feedback and a clear *approved/not approved* state |
| **Agent implementer** | Suggest alternatives and implement agreed fixes under repo conventions | Source diff/PR, rerendered footage, issue-to-shot mapping and test evidence |
| **Technical maintainer (human)** | Security, licensing, architecture, reproducibility, merge and release safety | Review of code/asset provenance, CI, scope and final integration |

One person may fill multiple roles, but **an agent passing tests cannot impersonate human final approval**.

## Review packet — handed to the reviewer, not to a programmer

For every candidate video, provide:

- A **private** playable MP4 with a revision label (e.g. `episode-r03`), runtime, language, visual format and channel style revision.
- A timecoded overview (shot list or contact sheet) and, for narration, the approved reference script/transcript.
- Any required factual source/rights/attribution notes. Unapproved stock, uncertain AI likenesses or external logos are called out explicitly.
- An easy place to write notes: existing private review doc, a GitHub Issue if the contents are public-safe, or a small review page once justified. **Don't expose unpublished footage or scripts in a public PR.**
- A concise agent-produced *technical* check: render success, duration/FPS, missing assets, black frames, audio peaks, captions, rights ledger status. State untested quality honestly.

## How to report one defect

```text
Video: episode-r03
Time: 01:12–01:18
Category: Readability / editorial pacing
Problem: The network diagram has 7 small labels; I cannot read them on a phone.
Desired outcome: One key label at a time, font large enough to read at normal speed.
Severity: Blocker before release
Evidence: Screenshot or link to private preview at 01:14
```

Each report should be about **observable output and desired behavior**, not which React component or FFmpeg flag to change. Agent decides implementation and asks only when there is a true creative trade-off.

### Severity

- **Blocker:** inaccurate claim, unlicensed asset, missing final speech, distracting speech-masking sound, empty/black frame, unreadable core idea, wrong language or a broken outro. Cannot approve.
- **Major:** visual style/character inconsistency, clearly poor rhythm, weak scene transition or repeated filler. Needs a correction or explicit human waiver.
- **Minor:** limited aesthetic alternatives with no material comprehension cost; batch instead of rerendering a whole film for each micro-tweak.

A defect is `addressed` when the agent has supplied a new rendered shot/preview, not merely when code was merged. It is `verified` only after the reviewer watches the changed outcome. Keep version+shot references so feedback for an older export cannot be silently closed against a different cut.

## Acceptance gates

1. **Editorial plan approved**: topic + outline + narration text when present. An intentionally SFX-only film does not require fabricated narration.
2. **Assets approved**: stock licence/source, generated-image character consistency and channel fit. Approved-only catalog filtering is a technical *aid*, not a rights warranty.
3. **First cut reviewed**: watch complete video at normal playback speed; issue timestamped notes and mark issues.
4. **Corrected cut checked**: compare specific edited shots against prior version, then watch entire final film again for A/V continuity.
5. **Release approved**: only a human explicitly approves the film. Private package includes final MP4, optional SRT/VTT, credits, thumbnail and metadata. Upload remains manual.

## Agent rules

- Be specific about **what changed on screen**. State time ranges and link a watchable new preview.
- Never reply “fixed” merely because TS compiles or `hyperframes check` passes; verify actual rendered pixels/audio and request reviewer confirmation.
- Keep the rendered shot source and template pin so a fix is reproducible.
- Never regenerate a whole 10-minute film for a small text change if a shot-only render is possible.
- Separate **engineering PR review** from **creative film review**. Don't ask a non-coding reviewer to approve security-sensitive changes without a technical maintainer.
- **No unreviewed model-created images, unsafe scraping, unlicensed stock, automatic publishing or private media links in the public repo.**
- Include negative cases: a test that *rejects* a malformed file proves more than one that only renders the happy path.
- Prefer producer-facing choices over implementation prompts: “a still photograph, a simple graphic or a short clip?” rather than “which CSS class?”.

## Practical two-person collaboration

While a video is being developed, one collaborator owns the **creative review queue** and another handles the **engineering/production integration queue**. Agents may work in parallel on independent shots but should avoid two agents editing the same shared timeline or style file at once. The integration maintainer resolves final cut timing and merges PRs. For content revisions that don't require code, keep changes in the **private project workspace**.

Start with a shared review document and MP4; only build a web interface if this workflow repeatedly wastes time. HyperFrames Studio and Player already cover editing/preview surfaces. If a thin review UI is later built, its first interaction should be **click pause → record timestamp → submit change**, not a custom full-featured editing timeline.

## Ready-to-watch definition

A useful release is not just a playable file. The film must explain the chosen idea accurately, be visually coherent with the pinned channel style, have legible text at phone viewing size, sensible motion, aligned speech/SFX/captions, no licensing ambiguity, a clean ending and explicit human approval. Publish only **after** these gates; tracking “finished and approved minutes” is more meaningful than counting PRs.
