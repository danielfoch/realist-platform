# Multiplex concept sample library

This folder holds 24 pre-generated sample drawing boards:

- 25, 30, 40, and 50 foot frontage bands
- shallow (95 ft), standard (115 ft), and deep (140 ft) lots
- rear-lane and no-lane variants

Each board contains a representative elevation, street perspective, and
simplified site-plan view of one internally consistent concept. The public
report labels every board as visual context for a similar lot—not a design for
the submitted address.

Generate the library with the bundled Image Generation skill CLI:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/image_gen.py" generate-batch \
  --input scripts/multiplex-concept-library-prompts.jsonl \
  --out-dir client/public/assets/multiplex-concepts \
  --concurrency 4
```

The prompt file pins `gpt-image-2`, medium quality, 1536×1024 WebP output, and
stable semantic filenames. `OPENAI_API_KEY` must be set in the shell running the
batch. Review all boards for cross-panel consistency before publishing.
