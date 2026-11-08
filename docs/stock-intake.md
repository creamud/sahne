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

Choose one action per candidate. Approval rechecks the media checksum and writes a review receipt and credit. Rejected items remain unavailable to storyboard validation. Approved images and clips use ordinary catalog asset IDs. The command does not fetch providers or verify the legal terms on the reviewer's behalf.

The catalog is local and private. New directories are created with `0700` permissions and imported media, sidecars and receipts with `0600`. If the catalog directory already existed, verify its permissions yourself (for example `chmod 700 /private/catalog`); the tool deliberately does not change pre-existing directories.

If the process stops **after** writing `review-receipt.json` but **before** replacing `candidate.asset.json`, do not repeat the human decision or delete the receipt. Resume that exact recorded decision with:

```sh
pnpm exec tsx scripts/stock-intake.ts recover /private/catalog <id>
```

Recovery checks the immutable receipt against source provenance, rechecks the media hash for approvals, and finishes updating the asset sidecar. It refuses missing, inconsistent or already-applied decisions. A stale `.review-lock` after an actual crash requires manual inspection before its removal.

Imports are limited to 512 MiB per file, dimensions no greater than 8192 pixels in either direction, and MP4 visual streams no longer than 10 minutes. FFprobe and FFmpeg each have a 60-second timeout. These are **intake safety bounds**, not a guarantee that every clip within the bounds can be decoded quickly. A human must still check whether the specific source license permits the intended commercial video and attribution.

This CLI validates catalog eligibility, **not** automatic placement of stock media in a final video. Final output still requires separate render and editorial QA.

Run the offline synthetic fixture with `node --import tsx --test tests/stock-intake.test.ts`.
