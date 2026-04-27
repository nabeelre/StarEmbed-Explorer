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
    label: "PTF North — local",
    source: "local",
    path: "data/ptf_north.jsonl",
  },
  // Example HuggingFace entry — fill in dataset and uncomment to enable:
  // {
  //   id: "ptf-north-hf",
  //   label: "PTF North — HuggingFace",
  //   source: "hf",
  //   dataset: "your-username/ptf-north",
  //   config: "default",
  //   split: "train",
  // },
];
