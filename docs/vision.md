# Sahne — Product vision

> Status: product direction, not an assertion that the end-to-end pipeline is already implemented.
> Tracking: [#20](https://github.com/yesvus/sahne/issues/20).

## One-sentence mission

**Sahne is an agent-operated, narration-first video production workflow for polished, informative YouTube videos.** It helps a human creator turn an approved script and a recording of their **own voice** into a well-timed video with reusable B-roll and motion graphics.

The intended differentiator is **turning spoken ideas into appropriate, timely visuals while maintaining a searchable library of assets across videos**, not inventing another rendering engine.

## Intended user and outcome

First user: a solo creator who brainstorms with ChatGPT, reviews the script, records narration, and expects coding agents to handle repetitive production tasks. The creator remains responsible for editorial decisions, factual claims, quality review, and publishing.

An excellent result has:
- Visually appropriate graphics, *not* continuous distracting decoration.
- Reliable alignment to the actual recorded narration.
- Consistent brand/visual identity across videos.
- Editable or regenerable project sources and documented provenance.
- Rapid reuse of approved visual assets, diagrams, animations and templates.
- A preview and a final render that can be manually reviewed.

## Product boundaries

- **Sahne (product):** workflow, agent instructions, timed storyboard and project manifests, asset discovery/reuse, composition, quality gates.
- **Existing tooling (dependencies):** transcription/alignment, video codecs, scene renderers and editing/graphics skills. Prefer integrating these rather than reimplementing them.
- **Current code (baseline):** local Remotion scene rendering with JSON schemas and examples. This is useful foundation work, but it does **not** yet deliver the product.
- **Human:** ideas, approved script, narration, factual/editorial review, publication.
- **Storage:** project artifacts and large binary assets live outside the public code repository; see [storage and assets](storage-and-assets.md).

### Explicit non-goals for the first vertical slice

No custom video editor/NLE, bespoke render engine, SaaS dashboard, distributed render farm, cloud job orchestrator, in-house digital asset management service, fully autonomous publishing, mandatory text-to-speech, or rewriting the Avenox workflow. Generative video/image models may be evaluated for specific gaps later, but code-driven motion graphics and reuse are the default.

## Existing work: evaluate and reuse

Evaluate these as **options**, with runtime, licensing, editing and quality checks before adopting:

- [Avenox Skills](https://github.com/avenoxai/avenoxskills) — production/rough-cut/graphics skill patterns; adapt or invoke as permitted.
- [HyperFrames](https://github.com/heygen-com/hyperframes) — agent-friendly HTML-to-video rendering candidate.
- [Barty-Bart motion-graphics](https://github.com/Barty-Bart/motion-graphics) — narration-synchronized B-roll workflow reference.
- [Remotion](https://www.remotion.dev/) — working Sahne rendering baseline. Do not migrate based on enthusiasm alone.

Keep tooling/provider choice modular and driven by a repeatable A/B proof of concept. Follow upstream license requirements; do not bundle third-party copyrighted templates/assets without permission.

## MVP: proof of useful production

Produce a real 45–90 second technical explainer using:
1. An approved script and personally recorded narration.
2. A word-aligned (or adequately time-aligned) transcript sourced from actual audio.
3. A storyboard with at least three visual beats, mixing overlay and full-frame graphics when appropriate.
4. One or more **reused** approved assets from a tagged, traceable asset library.
5. A project manifest with scene timing, asset references, editable motion-graphics source, and a reproducible local render.
6. A preview, captions as needed, explicit QA checklist, and final export.

The first success criterion is **a good video with less manual editing**. Number of templates, agents, microservices, or integrations are not success metrics.

See [production workflow](production-workflow.md) and [architecture](architecture.md).

## Principles

1. **Reuse before build:** search approved assets, then adapt, then generate new work only when needed.
2. **Use the recording as timing truth:** script is editorial intent; transcript reflects what was actually said.
3. **Human approval at meaningful gates:** script and final video.
4. **Local-first, tool-agnostic orchestration:** CLI/script/skills first; no mandatory hosted UI.
5. **Separate source, metadata and bulky media:** public code is not a private production vault.
6. **No over-engineering:** demonstrate a real bottleneck before adding databases, queues or render backends.

## Commercialization hypothesis (not a commitment)

**Start with a genuinely useful open-source, local-first core.** If creators repeatedly use it and request convenience, offer an optional **managed Sahne Cloud**. Paid value should initially come from hosted rendering, managed storage/catalog indexing, reliability, collaboration and convenience—not crippling essential local features.

- **OSS core:** script/transcript/storyboard workflow, asset catalog and portable manifests, CLI, agent skills, integrations, local rendering and export; self-hostable/BYOK where applicable.
- **Potential managed service:** online projects, secured storage, queued renders, managed compute, durable jobs, teams and billing. No hosted infra should be built before demand and unit economics are demonstrated.
- **Alternative early revenue:** bespoke video-production/automation setup or integration work, before a self-serve SaaS justifies its operational cost.
- **Competitive advantage hypothesis:** *narration-to-visual timing, editorial quality, brand consistency and reusable asset recall*, not a new video rendering engine.

**Licensing remains undecided:** assess permissive OSS (Apache-2.0 or MIT) versus network copyleft (AGPL) for the **Sahne-owned code**. The repository currently has no explicit Sahne license. Open-core is an option later, not the launch default. Treat third-party dependencies separately: Remotion has proprietary, eligibility-based terms; HyperFrames is Apache-2.0; Avenox Skills lists MIT. Verify all incorporated code, skill content, fonts and media rights before publishing or monetizing. See [#13](https://github.com/yesvus/sahne/issues/13).

Before deciding pricing, prove repeat usage, measure cost per produced minute, and identify which hosted conveniences users will actually pay for.
