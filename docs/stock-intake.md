# Review local stock media

Use a private, local catalog outside the repository. Download a PNG, JPEG or MP4 from its original provider and save a source receipt as JSON:

```json
{
  "title": "Harbor establishing shot",
  "provider": "Example provider",
  "creator": "Example creator",
  "sourceUrl": "https://example.com/asset",
  "license": "Example license",
  "licenseUrl": "https://example.com/license",
  "attribution": "Exact credit if required"
}
```

Import the file offline with FFmpeg and ffprobe available:

```sh
pnpm exec tsx scripts/stock-intake.ts import /private/catalog footage.mp4 source.json
```

The command prints the candidate ID and a local preview path. It copies and decodes the media, saves a timestamped source and license snapshot and records its SHA-256 checksum. A draft is excluded from approved-only catalog search. A missing license URL or an unknown license may be recorded on a draft but prevents approval.

Open the preview and inspect the original provider page and license. Confirm permissions for the planned edit and publication and record any required credit exactly. Then record the human decision:

```sh
pnpm exec tsx scripts/stock-intake.ts review /private/catalog <id> approve "Reviewer name"
pnpm exec tsx scripts/stock-intake.ts review /private/catalog <id> reject "Reviewer name"
```

Choose one action per candidate. Approval rechecks the media checksum and writes a review receipt and credit. Rejected items remain unavailable to storyboard validation. Approved images and clips use ordinary catalog asset IDs. Review receipts and footage stay private. The command does not fetch providers or verify the legal terms on the reviewer’s behalf.

Run the offline synthetic fixture with `node --import tsx --test tests/stock-intake.test.ts`.
