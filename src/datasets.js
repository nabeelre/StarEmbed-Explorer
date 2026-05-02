/**
 * All datasets available in the dropdown.
 * The first entry is selected on load.
 *
 * Local entry:
 *   { id, label, source: "local", path }
 *   path is relative to public/ (same as VITE_LOCAL_DATA_PATH)
 *
 * HuggingFace entry:
 *   { id, label, source: "hf", dataset, config?, split? }
 *   dataset is "username/repo-name" on the HF Hub
 */
export const DATASETS = [
  {
    id: "ptf-north-local",
    label: "PTF North",
    source: "local",
    path: "data/ptf_north.jsonl",
  },
  {
    id: "se-test-hf",
    label: "SE test",
    source: "hf",
    dataset: "nabeelr/SE_test",
    config: "default",
    split: "train",
  },
];
