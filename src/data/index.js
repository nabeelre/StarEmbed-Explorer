import { config } from "../config.js";
import { LocalDataSource } from "./LocalDataSource.js";
import { HFDataSource } from "./HFDataSource.js";
import { HFDiskDataSource } from "./HFDiskDataSource.js";

export function createDataSource(descriptor) {
  if (descriptor) {
    if (descriptor.source === "hf") {
      return new HFDataSource({
        dataset: descriptor.dataset,
        config: descriptor.config ?? "default",
        split: descriptor.split ?? "train",
      });
    }
    if (descriptor.source === "hf-disk") {
      return new HFDiskDataSource(descriptor.files);
    }
    return new LocalDataSource({ path: descriptor.path });
  }
  return config.dataSource === "hf"
    ? new HFDataSource(config.hf)
    : new LocalDataSource(config.local);
}

export { DataSource } from "./DataSource.js";
export { LocalDataSource, HFDataSource, HFDiskDataSource };
