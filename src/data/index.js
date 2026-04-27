import { config } from "../config.js";
import { LocalDataSource } from "./LocalDataSource.js";
import { HFDataSource } from "./HFDataSource.js";

export function createDataSource() {
  if (config.dataSource === "hf") {
    return new HFDataSource(config.hf);
  }
  return new LocalDataSource(config.local);
}

export { DataSource } from "./DataSource.js";
export { LocalDataSource, HFDataSource };
