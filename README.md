# Time Series Explorer

Static web UI for exploring a HuggingFace time-series dataset. Reads from a
local JSONL file during development and from the HuggingFace Datasets Server
API in production. Deploys to GitHub Pages.

This is the **scaffolding phase** — the UI is intentionally a bare placeholder
that just confirms the data pipeline works end to end. Real exploration UI
lands in the design phase.

## Stack

- **Vite + React** — fast dev loop, builds to static files for GitHub Pages.
- **Plotly.js** (via `react-plotly.js` factory + `plotly.js-dist-min`) — zoom,
  pan, and rangeslider come built in.
- Plain JavaScript (no TypeScript) — easy to add later if it earns its keep.

## Project layout

```
.
├── index.html                  # Vite entry
├── vite.config.js              # base path is configurable for GH Pages
├── package.json
├── public/
│   └── data/
│       └── sample.jsonl        # tiny synthetic dataset for the dev loop
├── src/
│   ├── main.jsx                # React mount
│   ├── App.jsx                 # placeholder UI (loads data, plots row 0)
│   ├── index.css
│   ├── config.js               # reads VITE_* env vars, picks data source
│   ├── components/
│   │   └── Plot.jsx            # Plotly wrapper (factory + dist-min)
│   └── data/
│       ├── DataSource.js       # abstract interface
│       ├── LocalDataSource.js  # fetches JSONL from public/
│       ├── HFDataSource.js     # hits datasets-server.huggingface.co
│       └── index.js            # factory: returns the right one for the env
├── scripts/
│   └── export_to_json.py       # HF dataset → JSONL for local dev
└── .github/workflows/
    └── deploy.yml              # build + deploy to GitHub Pages
```

## Quick start

```bash
npm install
npm run dev
```

Opens at http://localhost:5173 reading `public/data/sample.jsonl` (5 short
synthetic series). You should see metadata up top and a Plotly preview of the
first row.

## Switching data sources

Two modes, controlled by `VITE_DATA_SOURCE`:

| Mode    | Reads from                                  | When        |
| ------- | ------------------------------------------- | ----------- |
| `local` | `public/<VITE_LOCAL_DATA_PATH>` (JSONL)     | dev default |
| `hf`    | HuggingFace Datasets Server API (no auth, public datasets) | prod default |

### Use your real dataset locally

Convert the on-disk HF dataset to JSONL once:

```bash
pip install datasets
python scripts/export_to_json.py \
    --dataset /path/to/your/saved/dataset \
    --output public/data/dataset.jsonl
```

Then in `.env.local`:

```
VITE_LOCAL_DATA_PATH=data/dataset.jsonl
```

For fast iteration while developing, pass `--limit 200` to export a subset.

### Point at the HuggingFace Hub instead

Once your dataset is uploaded:

```
VITE_DATA_SOURCE=hf
VITE_HF_DATASET=your-username/your-dataset
VITE_HF_CONFIG=default
VITE_HF_SPLIT=train
```

The `HFDataSource` paginates the `/rows` endpoint (which caps at 100 rows per
request).

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages**: set source to **GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: add
   `HF_DATASET` (and optionally `HF_CONFIG`, `HF_SPLIT`).
4. Push to `main`. The workflow builds with `BASE_PATH=/<repo-name>/` and
   deploys.

The site URL will be `https://<your-username>.github.io/<repo-name>/`.

> Static-site limitation: any HF token shipped with the build is public, so
> the dataset must remain **public** on HuggingFace for this deployment model.

## What's intentionally not here yet

- Schema-aware exploration (filtering, multi-series overlay, search) — design
  phase.
- Styling beyond a minimal reset — design phase.
- Tests — once the data layer firms up.
- TypeScript — straightforward to add when the surface is bigger.

## Next step

Share a sample row (or the dataset schema) and we'll lock in the data shape
the rest of the UI will be built around.
