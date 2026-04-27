// Centralizes runtime config. All values come from Vite env vars (VITE_*).
// Defaults: local in dev, hf in production. Override via .env files or CI.

const env = import.meta.env;

export const config = {
  // "local" | "hf"
  dataSource: env.VITE_DATA_SOURCE || (env.DEV ? "local" : "hf"),

  local: {
    // Path is relative to the public/ folder at build time.
    // Format: JSON Lines (.jsonl) — one row per line.
    path: env.VITE_LOCAL_DATA_PATH || "data/sample.jsonl",
  },

  hf: {
    // e.g. "huggingface-username/dataset-name"
    dataset: env.VITE_HF_DATASET || "",
    config: env.VITE_HF_CONFIG || "default",
    split: env.VITE_HF_SPLIT || "train",
  },
};
