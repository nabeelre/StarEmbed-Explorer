import { DataSource } from "./DataSource.js";
import { tableFromIPC, DataType } from "apache-arrow";

/**
 * Reads a HuggingFace dataset saved to disk (Arrow shard files).
 *
 * Constructed from the File[] provided by an <input type="file" webkitdirectory>
 * element — works in Safari, Firefox, and Chrome. Nothing is uploaded or
 * transferred; files are read locally by the browser.
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
  }

  async getInfo() {
    if (this._infoFile) {
      try {
        const json = JSON.parse(await this._infoFile.text());
        return {
          source: "hf-disk",
          path: this.dirName,
          numRows: json.num_examples ?? null,
          columns: json.features ? Object.keys(json.features) : [],
        };
      } catch {
        // fall through
      }
    }
    return { source: "hf-disk", path: this.dirName };
  }

  async getRows({ offset = 0, length = 100 } = {}) {
    if (this._shards.length === 0) {
      const preview = this._allNames.slice(0, 8).join(", ") || "none";
      throw new Error(
        `No .arrow files found in "${this.dirName}". ` +
          `Files received: ${preview}${this._allNames.length > 8 ? ", …" : ""}. ` +
          "Select the directory that directly contains the .arrow shards."
      );
    }

    const collected = [];
    let shardStart = 0;

    for (const file of this._shards) {
      if (collected.length >= length) break;

      const buf = await file.arrayBuffer();
      const table = tableFromIPC(new Uint8Array(buf));

      const rowFrom = Math.max(0, offset - shardStart);
      const rowTo = Math.min(table.numRows, offset + length - shardStart);

      if (rowFrom < rowTo) {
        for (let i = rowFrom; i < rowTo; i++) {
          collected.push(extractRow(table, table.schema.fields, i));
        }
      }

      shardStart += table.numRows;
    }

    return collected;
  }
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
  if (
    DataType.isList(type) ||
    DataType.isLargeList(type) ||
    DataType.isFixedSizeList(type)
  ) {
    const vec = col.get(i);
    if (vec == null) return [];
    return Array.from({ length: vec.length }, (_, j) => coerce(vec.get(j)));
  }
  return coerce(col.get(i));
}

function coerce(v) {
  return typeof v === "bigint" ? Number(v) : v;
}
