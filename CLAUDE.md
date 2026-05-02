# CLAUDE.md

Notes for working on this codebase. Things that aren't obvious from reading the code.

## Stack

Vite + React 18, no TypeScript, no router. Plotly.js (`react-plotly.js` + `plotly.js-dist-min`) for sky map and lightcurves. apache-arrow for reading IPC shards. Inline `style={...}` only — no global CSS framework, no styled-components.

## Data architecture

`DataSource` ([src/data/DataSource.js](src/data/DataSource.js)) is an abstract interface with three async methods:

- `getInfo()` → `{ source, numRows, columns }`
- `getRows({ offset, length })` → array of plain row objects
- `getSummary()` → `{ totalRows, classCounts, classIndices, bands, skyPoints }` or `null`

Three implementations swap behind it:

| Source | Origin | When it's used |
|---|---|---|
| `LocalDataSource` | JSONL in `public/data/` | `datasets.js` entry with `source: "local"` |
| `HFDataSource` | HF Datasets Server REST API | `source: "hf"`, or `?dataset=user/name` URL param |
| `HFDiskDataSource` | Arrow IPC shards via browser file picker | "Select local dataset" button |

Factory at [src/data/index.js](src/data/index.js) dispatches by `descriptor.source`.

## Dataset selection (three ways)

1. **Hardcoded list** — `DATASETS` in [src/datasets.js](src/datasets.js). First entry is default.
2. **URL override** — `?dataset=user/name` (optional `&config=`, `&split=`, `&label=`) prepends a synthetic descriptor and selects it. Logic in `descriptorFromURL()` at the top of [src/App.jsx](src/App.jsx).
3. **File picker** — disabled in deployed builds via `IS_DEPLOYED`. **Brittleness**: this currently checks `import.meta.env.BASE_URL !== '/'`, which works for the github.io subpath deploy but would falsely re-enable the picker for a custom-domain build (`BASE_PATH=/`). Switch to a dedicated env var like `VITE_DEPLOY_TARGET=pages` set only in the workflow if adding a custom domain.

## The summary.json mechanism

`HFDataSource.getSummary()` fetches a pre-computed `summary.json` from `https://huggingface.co/datasets/<repo>/resolve/main/summary.json`. **Without it the app degrades**: no sky map, no class filter, no class-balanced random sampling. Falls back gracefully to global random offset.

Why pre-computed: the local sources build the summary by scanning the entire dataset. Impossible for a multi-GB remote dataset, and HF's datasets-server doesn't expose per-row sky positions.

Generate with [scripts/build_summary.py](scripts/build_summary.py), upload via `huggingface-cli upload <repo> summary.json summary.json --repo-type=dataset`. Schema matches what `HFDiskDataSource._scan` produces in-memory ([src/data/HFDiskDataSource.js](src/data/HFDiskDataSource.js)) — keep them in sync.

Size scales with row count: ~1 MB for 50k rows, ~7 MB for 1M (mostly `classIndices`). Tolerable through ~1M rows; past that, rethink the summary shape.

## Class-balanced sky sampling

The sky map is capped at ~10k points (SVG render scaling). Each class contributes `min(class_size, max(SKY_FLOOR, proportional_share))`. Floor (default 100) ensures rare classes are visible; proportional share keeps common classes from dominating; min cap handles classes smaller than the floor. Total may slightly exceed budget when many small classes exist — acceptable.

Helper `sampleSkyPointsByClass()` exported from [src/data/HFDiskDataSource.js](src/data/HFDiskDataSource.js) and reused by `LocalDataSource`. The Python script [scripts/build_summary.py](scripts/build_summary.py) implements the same algorithm so summaries built locally match what the JS sources would produce.

## Lightcurve / band registry

Each row's `lightcurve` field is a struct of bands → `{mjd, mag, mag_unc, ...}`. Band keys are arbitrary strings (e.g. `g_ZTF`, `clear_CSS`). [src/bands.js](src/bands.js) maps known keys to display label, color, and survey grouping. Unknown bands fall back to `key` as label and a fallback palette color. To add a band, edit `SURVEY_LIBRARY` in that file.

The HF `/rows` endpoint returns nested struct/list data already in the schema-native shape. No row transformation needed in `HFDataSource`.

## Build / deploy

- `npm run build` — base path `/`, suitable for self-host or custom-domain deploy.
- `npm run build:gh` — base path `/<package_name>/` for github.io subpath. Note: `npm_package_name` from `package.json` is `timeseries-explorer`, but the GH Actions workflow overrides this with the actual repo name via `BASE_PATH=/${{ github.event.repository.name }}/`.
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — auto-deploys to GitHub Pages on push to `main`.

The workflow currently sets `VITE_DATA_SOURCE`, `VITE_HF_DATASET`, etc. — these are dead since dataset selection moved from env vars to `src/datasets.js` + URL params. [src/config.js](src/config.js) is also vestigial. Cleanup pending.

## Style

- No comments unless the *why* is non-obvious. Don't describe what the code does.
- No new files unless necessary. Prefer extending existing modules.
- Inline styles only. The `GLASS` and `KICKER` design tokens at the top of [App.jsx](src/App.jsx) capture the recurring visual treatments.
