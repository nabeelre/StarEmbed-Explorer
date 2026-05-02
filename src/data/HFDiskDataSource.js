import { DataSource } from "./DataSource.js";
import { tableFromIPC, DataType } from "apache-arrow";

// DataType.isLargeList was removed in apache-arrow v14+.
const isList = (type) =>
  DataType.isList(type) ||
  DataType.isFixedSizeList(type) ||
  type.valueType !== undefined;

/**
 * Reads a HuggingFace dataset saved to disk (Arrow shard files).
 *
 * On first getRows call, scans all shards once to build a row-count index.
 * Subsequent calls load only the shard that contains the requested offset,
 * so random access across 80k rows only reads ~1/N of the data per request.
 */
export class HFDiskDataSource extends DataSource {
  constructor(files) {
    super();
    const all = Array.from(files);
    this._shards = all
      .filter((f) => f.name.endsWith(".arrow"))
      .sort((a, b) => a.name.localeCompare(b.name));
    this._infoFile = all.find((f) => f.name === "dataset_info.json");
    this.dirName =
      all[0]?.webkitRelativePath?.split("/")[0] ?? all[0]?.name ?? "dataset";
    this._allNames = all.map((f) => f.webkitRelativePath || f.name);

    this._scanPromise = null;      // single shared Promise for the count scan
    this._cumulativeCounts = null; // cumulative row counts across shards
    this._totalRows = 0;
    this._summary = null;
    this._cachedShard = null;      // { idx, table } — most recently loaded shard
  }

  // Scan all shards once to build cumulative row-count index.
  // Returns the same Promise on repeated calls so the scan runs exactly once.
  _scan() {
    if (this._scanPromise) return this._scanPromise;
    this._scanPromise = (async () => {
      if (this._shards.length === 0) {
        const preview = this._allNames.slice(0, 8).join(", ") || "none";
        throw new Error(
          `No .arrow files found in "${this.dirName}". ` +
            `Files received: ${preview}${this._allNames.length > 8 ? ", …" : ""}. ` +
            "Select the directory that directly contains the .arrow shards."
        );
      }
      const counts = [];
      const classIndices = new Map(); // class → global row indices
      const classCoords = new Map();  // class → array of {ra, dec}
      let bands = null;
      let globalIdx = 0;

      for (const file of this._shards) {
        const buf = await file.arrayBuffer();
        const table = tableFromIPC(new Uint8Array(buf));
        counts.push(table.numRows);

        // Band names from schema (first shard only)
        if (!bands) {
          const lcField = table.schema.fields.find((f) => f.name === "lightcurve");
          if (lcField) bands = lcField.type.children.map((f) => f.name);
        }

        // Build class index and bucket RA/Dec by class in one columnar pass
        const classCol = table.getChild("class_str");
        const raCol = table.getChild("gaia_dr3_ra");
        const decCol = table.getChild("gaia_dr3_dec");
        for (let i = 0; i < table.numRows; i++) {
          const key = classCol ? (classCol.get(i) ?? "(none)") : "(none)";
          if (!classIndices.has(key)) classIndices.set(key, []);
          classIndices.get(key).push(globalIdx);
          if (raCol && decCol) {
            const ra = raCol.get(i);
            const dec = decCol.get(i);
            if (ra != null && dec != null) {
              if (!classCoords.has(key)) classCoords.set(key, []);
              classCoords.get(key).push({ ra, dec });
            }
          }
          globalIdx++;
        }
      }

      let cumulative = 0;
      this._cumulativeCounts = counts.map((n) => (cumulative += n));
      this._totalRows = cumulative;

      const sortedIndices = [...classIndices.entries()].sort(
        (a, b) => b[1].length - a[1].length
      );

      const skyPoints = sampleSkyPointsByClass(classCoords);

      this._summary = {
        totalRows: this._totalRows,
        classCounts: Object.fromEntries(sortedIndices.map(([k, v]) => [k, v.length])),
        classIndices: Object.fromEntries(sortedIndices),
        bands: bands ?? [],
        skyPoints,
      };
    })();
    return this._scanPromise;
  }

  async getInfo() {
    let numRows = null;
    let columns = [];
    if (this._infoFile) {
      try {
        const json = JSON.parse(await this._infoFile.text());
        numRows = json.num_examples ?? null;
        columns = json.features ? Object.keys(json.features) : [];
      } catch {
        // fall through
      }
    }
    // Always kick off the scan so it runs in the background.
    // getRows will await it before proceeding.
    const scanDone = this._scan();
    if (numRows === null) {
      await scanDone;
      numRows = this._totalRows;
    }
    return { source: "hf-disk", path: this.dirName, numRows, columns };
  }

  async getRows({ offset = 0, length = 1 } = {}) {
    await this._scan();

    const collected = [];
    let remaining = length;
    let cursor = offset;

    while (remaining > 0) {
      const shardIdx = this._cumulativeCounts.findIndex((c) => c > cursor);
      if (shardIdx === -1) break; // offset beyond end of dataset

      const shardStart = shardIdx === 0 ? 0 : this._cumulativeCounts[shardIdx - 1];
      const table = await this._loadShard(shardIdx);

      const rowFrom = cursor - shardStart;
      const rowTo = Math.min(table.numRows, rowFrom + remaining);

      for (let i = rowFrom; i < rowTo; i++) {
        collected.push(extractRow(table, table.schema.fields, i));
      }

      const fetched = rowTo - rowFrom;
      remaining -= fetched;
      cursor += fetched;
    }

    return collected;
  }

  async getSummary() {
    await this._scan();
    return this._summary;
  }

  async _loadShard(idx) {
    if (this._cachedShard?.idx === idx) return this._cachedShard.table;
    const file = this._shards[idx];
    const buf = await file.arrayBuffer();
    const table = tableFromIPC(new Uint8Array(buf));
    this._cachedShard = { idx, table };
    return table;
  }
}

// ── Sky-point sampling ─────────────────────────────────────────────────────

// Class-balanced sampling: each class gets at least SKY_FLOOR points (or all
// of them if fewer), plus a proportional share of the SKY_SAMPLE budget.
// scattergeo renders in SVG so render time scales ~linearly with point count;
// 10k is comfortable on desktop. Total may slightly exceed the budget when
// many classes have <floor rows — acceptable tradeoff for visibility.
const SKY_SAMPLE = 10_000;
const SKY_FLOOR = 100;

export function sampleSkyPointsByClass(classCoords) {
  let total = 0;
  for (const coords of classCoords.values()) total += coords.length;
  if (total === 0) return [];

  const out = [];
  for (const [cls, coords] of classCoords) {
    const n = coords.length;
    const proportional = Math.round((n / total) * SKY_SAMPLE);
    const target = Math.max(SKY_FLOOR, proportional);
    const actual = Math.min(target, n);
    const idxs = Array.from({ length: n }, (_, i) => i);
    for (let k = 0; k < actual; k++) {
      const j = k + Math.floor(Math.random() * (n - k));
      [idxs[k], idxs[j]] = [idxs[j], idxs[k]];
      const { ra, dec } = coords[idxs[k]];
      out.push({ ra, dec, cls });
    }
  }
  return out;
}

// ── Arrow → plain JS conversion ────────────────────────────────────────────

function extractRow(parent, fields, i) {
  const obj = {};
  for (const field of fields) {
    const col = parent.getChild(field.name);
    obj[field.name] = extractValue(col, field.type, i);
  }
  return obj;
}

function extractValue(col, type, i) {
  if (DataType.isStruct(type)) {
    return extractRow(col, type.children, i);
  }
  if (isList(type)) {
    const vec = col.get(i);
    if (vec == null) return [];
    return Array.from({ length: vec.length }, (_, j) => coerce(vec.get(j)));
  }
  return coerce(col.get(i));
}

function coerce(v) {
  return typeof v === "bigint" ? Number(v) : v;
}
