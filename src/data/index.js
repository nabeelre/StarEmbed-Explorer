import { config } from "../config.js";
import { LocalDataSource } from "./LocalDataSource.js";
import { HFDataSource } from "./HFDataSource.js";
import { FileDataSource } from "./FileDataSource.js";

/**
 * Create a DataSource from a dataset descriptor (from src/datasets.js or the
 * file picker). Falls back to the env-var config when called with no argument.
 */
export function createDataSource(descriptor) {
  if (descriptor) {
    if (descriptor.source === "hf") {
      return new HFDataSource({
        dataset: descriptor.dataset,
        config: descriptor.config ?? "default",
        split: descriptor.split ?? "train",
      });
    }
    if (descriptor.source === "file") {
      return new FileDataSource(descriptor.file);
    }
    return new LocalDataSource({ path: descriptor.path });
  }
  // Env-var fallback (production builds / CI)
  return config.dataSource === "hf"
    ? new HFDataSource(config.hf)
    : new LocalDataSource(config.local);
}

export { DataSource } from "./DataSource.js";
export { LocalDataSource, HFDataSource, FileDataSource };
