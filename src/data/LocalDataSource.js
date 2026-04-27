import { DataSource } from "./DataSource.js";

/**
 * Reads a JSON Lines file from the public/ folder at runtime.
 * The full file is loaded into memory once and cached for the session.
 * Suitable for development and for small enough datasets to ship statically.
 */
export class LocalDataSource extends DataSource {
  constructor({ path = "data/sample.jsonl" } = {}) {
    super();
    this.path = path;
    this._cache = null;
  }

  async _load() {
    if (this._cache) return this._cache;

    // import.meta.env.BASE_URL respects vite's base config (e.g., /repo-name/)
    const url = `${import.meta.env.BASE_URL}${this.path.replace(/^\//, "")}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const rows = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        try {
          return JSON.parse(line);
        } catch (err) {
          throw new Error(`Invalid JSON on line ${i + 1} of ${url}: ${err.message}`);
        }
      });
    this._cache = rows;
    return rows;
  }

  async getInfo() {
    const rows = await this._load();
    return {
      source: "local",
      path: this.path,
      numRows: rows.length,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    };
  }

  async getRows({ offset = 0, length = 100 } = {}) {
    const rows = await this._load();
    return rows.slice(offset, offset + length);
  }
}
