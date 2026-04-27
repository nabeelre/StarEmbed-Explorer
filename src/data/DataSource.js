/**
 * Abstract interface for a time-series dataset source.
 *
 * Concrete implementations:
 *   - LocalDataSource: reads JSONL from public/data/ (dev)
 *   - HFDataSource:    hits the HuggingFace Datasets Server API (prod)
 *
 * As we learn more about the dataset schema, we can grow this interface
 * (e.g., getSeries(id), search(query), getColumn(name)). For now it stays
 * minimal: enough to confirm the pipeline works.
 */
export class DataSource {
  /**
   * @returns {Promise<{
   *   source: "local" | "hf",
   *   numRows?: number,
   *   columns?: string[],
   *   [key: string]: any
   * }>}
   */
  async getInfo() {
    throw new Error("DataSource.getInfo not implemented");
  }

  /**
   * @param {{ offset?: number, length?: number }} opts
   * @returns {Promise<object[]>} array of row objects
   */
  // eslint-disable-next-line no-unused-vars
  async getRows(opts = {}) {
    throw new Error("DataSource.getRows not implemented");
  }

  /**
   * @returns {Promise<{
   *   totalRows: number,
   *   classCounts: Record<string, number>,  // sorted descending
   *   bands: string[],
   * } | null>}  null if the source can't produce a summary cheaply
   */
  async getSummary() {
    return null;
  }
}
