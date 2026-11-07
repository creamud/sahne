# Storage and reusable assets

> Decision for the initial, personal video-production workflow. Google Drive folder creation is a **separate action**; this document does not imply it exists yet.

## Canonical systems of record

| Kind | Home | Reason |
| --- | --- | --- |
| Open-source Sahne code, docs, issues, generic schemas | Public `yesvus/sahne` GitHub repository | Versioned development and collaboration |
| Brainstorming conversation | ChatGPT | Exploration; not the durable index |
| Selected ideas and working scripts | Private Google Drive workspace | Easy review/editing with ChatGPT and large accessible storage |
| Raw voice, footage, music, B-roll binaries, previews, masters | Google Drive | Private archive of large files |
| Episode manifests and asset catalog metadata | **Private** project workspace, initially next to Drive media | Search/reproducibility without leaking unpublished work |
| Agent workspace and rendering cache | Local machine/temporary working directory | Processing; not authoritative storage |

**Do not commit unpublished scripts, personal recordings, private Drive identifiers/URLs, or large media to the public repository.** Use GitHub Issues for Sahne *engineering tasks*, not every video idea. Add a private production Git repo only once versioning/branching of episode manifests is demonstrably useful.

## Proposed Drive organization

```text
Sahne Production/
├── Ideas/
│   └── Idea Index (Google Doc)
├── Videos/
│   └── <yyyy-mm>-<episode-slug>/
│       ├── script.md (or Google Doc)
│       ├── voice-original.wav
│       ├── transcript.json
│       ├── storyboard.json
│       ├── project.json
│       ├── sources/              # editable visual source, footage, references
│       └── exports/              # previews and final master
└── Asset Library/
    └── <stable-asset-id>/
        ├── asset.json
        ├── source/               # editable original, if available
        └── renders/              # reusable transparent/video/image variants
```

This is **a convention, not a requirement to precreate every directory**. Start with Ideas, Videos and Asset Library; create per-video subfolders on demand. Do not depend on naming alone for machine discovery.

## Minimum asset catalog record

The catalog is a set of small JSON sidecars, not a database. Example with dummy values:

```json
{
  "schemaVersion": 1,
  "id": "asset-network-request-flow-v1",
  "title": "Client-server request flow",
  "description": "Animated request/response between client and service",
  "category": "motion-graphic",
  "tags": ["networking", "request", "response", "systems"],
  "kind": "editable-animation",
  "aspectRatio": "16:9",
  "durationMs": 6000,
  "rights": {
    "origin": "original",
    "license": "creator-owned",
    "attribution": null
  },
  "reviewStatus": "approved",
  "location": {
    "storage": "google-drive",
    "fileId": "<private-file-id>",
    "relativePath": "Asset Library/asset-network-request-flow-v1/"
  },
  "sha256": "<checksum-of-master-binary-or-source-archive>",
  "createdFrom": "example-video/project.json"
}
```

The above ID, values and file ID are examples, not a real uploaded asset. Keep actual private file IDs in the private catalog. A future public schema/example should remove access credentials, file identifiers and unpublished titles. For a real production asset, record owner, creation date and relevant source revision when known.

An episode manifest references **`asset-network-request-flow-v1`**, not a transient local pathname. Asset IDs should remain stable; use a new version/ID for materially changed output rather than silently overwriting a reused clip.

## Search, reuse and lifecycle

- Search initially by titles, tags, descriptions and rights status. Plain JSON files plus a small CLI index are sufficient.
- Prefer `approved` reusable assets; distinguish `draft`, `approved` and `retired` from project-only renders.
- Retain editable source (HTML/JS, Remotion component, SVG, etc.) when possible, plus the video/image export.
- Capture whether the asset is original, licensed stock, third-party, or AI-generated. **Do not assume a GitHub repository's contents grant rights to all example media.**
- Hash files for duplicate detection/integrity; keep the authoritative binary in Drive and use temporary local copies for rendering.
- Audit and update usage/references when an asset is reused; this helps identify high-value templates.
- Do not publish or share private Drive URLs as part of the public docs.

## What we deliberately postpone

No bespoke DAM, semantic/vector database, Drive auto-sync daemon, Google Sheets control plane, giant Git LFS repository, cloud render infrastructure or video-centric issue tracker before the first complete narrated video proves the need. Add stronger indexing and version control incrementally based on failures.

## Migration path if needed

When multiple productions or multiple people make manual catalog tracking painful, move *metadata only* to a private Git repository or database. Leave binary originals in Drive or another object store. Preserve stable asset IDs so project manifests survive that migration.
