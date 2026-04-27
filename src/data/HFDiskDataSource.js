import { DataSource } from "./DataSource.js";
import { tableFromIPC, DataType } from "apache-arrow";

/**
 * Reads a HuggingFace dataset saved to disk (Arrow shard files) using the
 * browser File System Access API. Nothing is uploaded or transferred — files
 * are read locally by the browser directly from the directory the user picks.
 *
 * Requires Chrome/Edge (showDirectoryPicker). Not available in Firefox/Safari.
 */
export class HFDiskDataSource extends DataSource {
  constructor(dirHandle) {
    super();
    this.dirHandle = dirHandle;
    this._shardHandles = null;
  }

  async _getShardHandles() {
    if (this._shardHandles) return this._shardHandles;
    const pairs = [];
    for await (const [name, handle] of this.dirHandle.entries()) {
      if (handle.kind === "file" && name.endsWith(".arrow")) {
        pairs.push([name, handle]);
      }
    }
    if (pairs.length === 0) {
      throw new Error(
        `No .arrow files found in "${this.dirHandle.name}". ` +
          "Make sure you selected the directory containing the Arrow shards."
      );
    }
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    this._shardHandles = pairs.map(([, h]) => h);
    return this._shardHandles;
  }

  async getInfo() {
    // Read dataset_info.json for schema/count without loading Arrow data
    try {
      const infoHandle = await this.dirHandle.getFileHandle("dataset_info.json");
      const file = await infoHandle.getFile();
      const json = JSON.parse(await file.text());
      return {
        source: "hf-disk",
        path: this.dirHandle.name,
        numRows: json.num_examples ?? null,
        columns: json.features ? Object.keys(json.features) : [],
      };
    } catch {
      return { source: "hf-disk", path: this.dirHandle.name };
    }
  }

  async getRows({ offset = 0, length = 100 } = {}) {
    const shards = await this._getShardHandles();
    const collected = [];
    let shardStart = 0;

    for (const handle of shards) {
      if (collected.length >= length) break;

      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      const table = tableFromIPC(new Uint8Array(buf));
      const shardEnd = shardStart + table.numRows;

      const rowFrom = Math.max(0, offset - shardStart);
      const rowTo = Math.min(table.numRows, offset + length - shardStart);

      if (rowFrom < rowTo) {
        for (let i = rowFrom; i < rowTo; i++) {
          collected.push(extractRow(table, table.schema.fields, i));
        }
      }

      shardStart = shardEnd;
    }

    return collected;
  }
}

// ── Arrow → plain JS conversion ────────────────────────────────────────────
// Works column-by-column down the schema tree so we never touch StructRow
// internals (whose API differs across apache-arrow versions).

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
  if (DataType.isList(type) || DataType.isLargeList(type) || DataType.isFixedSizeList(type)) {
    const vec = col.get(i);
    if (vec == null) return [];
    return Array.from({ length: vec.length }, (_, j) => coerce(vec.get(j)));
  }
  return coerce(col.get(i));
}

// BigInt (int64/uint64) → Number; everything else passes through
function coerce(v) {
  return typeof v === "bigint" ? Number(v) : v;
}
