# Development and rendering

## Local prerequisites

- Node.js >=22 and **pnpm 10.20.0**.
- Supported macOS, Linux or Windows for Remotion.
- Internet access is required for the first installation and for Remotion to download its managed Chrome Headless Shell. The Remotion CLI supplies platform-specific encoding binaries through its dependencies.
- `ffprobe` on your PATH is required only for the `verify:smoke` validation step. If absent, install FFmpeg from your OS package manager.

## Install and check

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm exec remotion browser ensure
```

## Preview and export

```sh
pnpm dev
pnpm render:example
```

The full demo is six seconds at 1920×1080, 30 fps. Its numbers are illustrative.

For faster CI-grade video verification:

```sh
pnpm render:smoke
pnpm verify:smoke
```

The smoke export contains the first 30 frames (one second). The verifier checks H.264 codec, dimensions, frame rate, duration and a non-empty playable container using `ffprobe`.

## CI contract

`.github/workflows/ci.yml` runs on pull requests and pushes to main. It uses frozen dependencies, type checking, unit tests, Remotion's managed browser, a short render, and metadata verification. Failed jobs upload `out/` artifacts for debugging.

Visual quality is not established by metadata checks: manually scrub the start, midpoint and end in Remotion Studio before merging visual PRs.

For a new dependency, update `package.json` and regenerate `pnpm-lock.yaml` with `pnpm install`; commit both.

## Troubleshooting

- Browser errors: run `pnpm exec remotion browser ensure` and inspect missing OS libraries and network access.
- Failed encoding: check the Remotion CLI error and that the `@remotion/*` package versions match `remotion` exactly.
- CLI works but metadata verifier fails: check `ffprobe -version`, the output path, and rendered codec.
- CI times out: inspect logs before increasing timeouts or parallel render concurrency.
