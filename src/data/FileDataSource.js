import { DataSource } from "./DataSource.js";

/**
 * Reads a JSONL file chosen by the user via the browser File API.
 * The file can live anywhere on the local filesystem — no public/ required.
 */
export class FileDataSource extends DataSource {
  constructor(file) {
    super();
    this.file = file;
    this._cache = null;
  }

  async _load() {
    if (this._cache) return this._cache;
    const text = await this.file.text();
    const rows = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        try {
          return JSON.parse(line);
        } catch (err) {
          throw new Error(`Invalid JSON on line ${i + 1} of ${this.file.name}: ${err.message}`);
        }
      });
    this._cache = rows;
    return rows;
  }

  async getInfo() {
    const rows = await this._load();
    return {
      source: "file",
      path: this.file.name,
      numRows: rows.length,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    };
  }

  async getRows({ offset = 0, length = 100 } = {}) {
    const rows = await this._load();
    return rows.slice(offset, offset + length);
  }
}
