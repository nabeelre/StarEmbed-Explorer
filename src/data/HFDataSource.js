import { DataSource } from "./DataSource.js";

/**
 * Reads from the HuggingFace Datasets Server API.
 * https://huggingface.co/docs/dataset-viewer
 *
 * Public datasets work without auth. Private datasets would need an API token,
 * which is NOT safe to ship in a static GitHub Pages build — keep the dataset
 * public, or switch to a different deployment that can hold a secret.
 *
 * Note: the /rows endpoint caps `length` at 100 per request. For more rows we
 * paginate.
 */
const BASE = "https://datasets-server.huggingface.co";
const ROWS_PER_REQUEST = 100;

export class HFDataSource extends DataSource {
  constructor({ dataset, config = "default", split = "train" }) {
    super();
    if (!dataset) {
      throw new Error(
        "HFDataSource requires a `dataset` (e.g. 'username/name'). Set VITE_HF_DATASET.",
      );
    }
    this.dataset = dataset;
    this.config = config;
    this.split = split;
    this._infoCache = null;
    this._summaryCache = undefined; // distinct from null: caches the "no summary" answer too
  }

  _qs(params) {
    return new URLSearchParams(params).toString();
  }

  async getInfo() {
    if (this._infoCache) return this._infoCache;

    const url = `${BASE}/info?${this._qs({ dataset: this.dataset })}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HF info request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const cfg = data?.dataset_info?.[this.config];
    const splitInfo = cfg?.splits?.[this.split];

    this._infoCache = {
      source: "hf",
      dataset: this.dataset,
      config: this.config,
      split: this.split,
      numRows: splitInfo?.num_examples,
      columns: cfg?.features ? Object.keys(cfg.features) : [],
      raw: data,
    };
    return this._infoCache;
  }

  async getRows({ offset = 0, length = ROWS_PER_REQUEST } = {}) {
    const collected = [];
    let remaining = length;
    let cursor = offset;

    while (remaining > 0) {
      const take = Math.min(remaining, ROWS_PER_REQUEST);
      const url = `${BASE}/rows?${this._qs({
        dataset: this.dataset,
        config: this.config,
        split: this.split,
        offset: String(cursor),
        length: String(take),
      })}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HF rows request failed: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const rows = (data?.rows || []).map((r) => r.row);
      if (rows.length === 0) break;
      collected.push(...rows);
      cursor += rows.length;
      remaining -= rows.length;
      if (rows.length < take) break; // end of split
    }

    return collected;
  }

  // Fetches a pre-computed summary.json from the dataset repo. Build/upload via
  // scripts/build_summary.py. Returns null gracefully if absent so the app
  // degrades to global random sampling without sky map or class filter.
  async getSummary() {
    if (this._summaryCache !== undefined) return this._summaryCache;
    const url = `https://huggingface.co/datasets/${this.dataset}/resolve/main/summary.json`;
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        this._summaryCache = null;
        return null;
      }
      if (!res.ok) {
        throw new Error(`summary.json fetch failed: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      if (data.version !== 1) {
        console.warn("HF summary: unsupported version", data.version);
        this._summaryCache = null;
        return null;
      }
      this._summaryCache = data;
      return data;
    } catch (e) {
      console.warn("HF summary unavailable:", e.message);
      this._summaryCache = null;
      return null;
    }
  }
}
