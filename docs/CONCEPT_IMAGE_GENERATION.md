# Multiplex concept boards — image generation

The multiplex underwriter shows a pre-rendered "sample board" (elevation +
street perspective + site plan) matched to the lot's width band, depth band,
and lane access. The matching logic is `lib/multiplex/multiplexConceptLibrary.ts`
(24 combinations, exhaustive by construction); the pages degrade gracefully
until the images exist, showing a placeholder tile.

**The images do not exist yet. Generating them is the one outstanding asset task.**

## Top 10 Toronto lot configurations (generate these first)

Ranked by how often the underwriter will actually hit them, from Toronto's lot
fabric:

| # | File | Lot | Where this lot lives |
|---|------|-----|----------------------|
| 1 | `25ft-standard-no-lane.webp` | 25′ × ~115′ | The classic old-Toronto lot — East York, Danforth corridor, prewar west end. The single most common multiplex candidate. |
| 2 | `25ft-standard-lane.webp` | 25′ × ~115′ + rear lane | East-end laneway grid (Leslieville, Riverdale, Greenwood-Coxwell). The lane unlocks the laneway-suite fifth unit. |
| 3 | `30ft-standard-no-lane.webp` | 30′ × ~110′ | Midtown side streets and older inner suburbs — comfortable setbacks, the easiest fourplex build. |
| 4 | `25ft-shallow-no-lane.webp` | 25′ × ~95′ | Wartime and rowhouse blocks — tight rear yards force compact stacked massing. |
| 5 | `30ft-standard-lane.webp` | 30′ × ~115′ + lane | Lane-served 30-footers in the old city — fourplex plus garden/laneway suite. |
| 6 | `40ft-standard-no-lane.webp` | 40′ × ~110′ | The postwar bungalow lot — Scarborough/North York default fabric, prime sixplex candidate in By-law 654-2025 wards. |
| 7 | `30ft-deep-no-lane.webp` | 30′ × ~140′ | Deep East York/Scarborough lots — depth supports a detached garden suite behind a full multiplex. |
| 8 | `40ft-deep-no-lane.webp` | 40′ × ~140′ | North York deep lots — side-by-side formats plus a rear suite. |
| 9 | `50ft-deep-no-lane.webp` | 50′ × ~132′+ | North York / Etobicoke rebuild lots — widest common band, sixplex-plus massing. |
| 10 | `25ft-deep-lane.webp` | 25′ × ~140′ + lane | Narrow-but-long east-end lane lots — the showcase for main building + laneway suite. |

Prompt files (each line pins `gpt-image-2`, medium quality, 1536×1024, WebP 82):

- `scripts/multiplex-concept-top10-prompts.jsonl` — the ten above, in priority order
- `scripts/multiplex-concept-library-prompts.jsonl` — the full 24-board library

## Batch generation (imagegen CLI)

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/image_gen.py" generate-batch \
  --input scripts/multiplex-concept-top10-prompts.jsonl \
  --out-dir public/assets/multiplex-concepts \
  --concurrency 4
```

Requires `OPENAI_API_KEY`. Run the full 24-board file the same way afterwards —
already-generated files can be left in place (identical filenames). Review each
board for **cross-panel consistency** (the elevation, perspective, and site plan
must show the same building) before deploying; regenerate any board that drifts.

## Master prompt (for manual one-off generation)

If you'd rather paste into an image tool by hand, this is the template — fill
the bracketed values from the table row:

> Landscape architectural concept drawing board for a common Toronto
> missing-middle site: representative **[WIDTH] ft by [DEPTH] ft** lot,
> **[no rear lane / rear lane along the back property line]**,
> **[three-storey stacked fourplex / four-storey sixplex / fourplex plus
> separate smaller rear laneway suite — match the lot]**. Show three internally
> consistent panels of the same design: clean front elevation, realistic
> eye-level street perspective, and simplified top-down site plan with the
> public street, main footprint, side path and rear yard clearly legible
> **[, and the rear lane with the laneway suite footprint for lane variants]**.
> Contemporary Toronto brick, warm wood and dark metal detailing, neighbouring
> low-rise houses shown only as muted context, restrained professional
> architecture-competition board, off-white background, no people, no cars.
>
> Settings: gpt-image-2 · quality medium · 1536×1024 · WebP · save as
> `[width]ft-[shallow|standard|deep]-[lane|no-lane].webp`

The exact per-board prompt text (with per-variant constraints already worded)
is in the JSONL files — prefer those over the template when scripting.
