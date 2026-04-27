import { config } from "../config.js";
import { LocalDataSource } from "./LocalDataSource.js";
import { HFDataSource } from "./HFDataSource.js";

/**
 * Create a DataSource from a dataset descriptor (from src/datasets.js).
 * Falls back to the env-var config when called with no argument.
 */
export function createDataSource(descriptor) {
  if (descriptor) {
    return descriptor.source === "hf"
      ? new HFDataSource({
          dataset: descriptor.dataset,
          config: descriptor.config ?? "default",
          split: descriptor.split ?? "train",
        })
      : new LocalDataSource({ path: descriptor.path });
  }
  // Env-var fallback (production builds / CI)
  return config.dataSource === "hf"
    ? new HFDataSource(config.hf)
    : new LocalDataSource(config.local);
}

export { DataSource } from "./DataSource.js";
export { LocalDataSource, HFDataSource };
