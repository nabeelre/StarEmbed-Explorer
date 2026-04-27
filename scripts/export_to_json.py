#!/usr/bin/env python3
"""
Export a HuggingFace dataset to JSON Lines for local development.

The website's LocalDataSource reads JSONL from public/data/. Run this once
against your local HF dataset (or a remote one) to produce a file the dev
server can serve.

Examples:
    # From a local on-disk dataset (saved with ds.save_to_disk(...))
    python scripts/export_to_json.py \\
        --dataset /path/to/local/dataset \\
        --output public/data/dataset.jsonl

    # From the HuggingFace Hub
    python scripts/export_to_json.py \\
        --dataset username/dataset-name \\
        --split train \\
        --output public/data/dataset.jsonl

    # Limit rows for fast dev iteration
    python scripts/export_to_json.py \\
        --dataset username/dataset-name \\
        --limit 200 \\
        --output public/data/sample.jsonl

After exporting, point the dev server at the file by setting in .env.local:
    VITE_LOCAL_DATA_PATH=data/dataset.jsonl
"""
from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dataset",
        required=True,
        help="Path to a local on-disk dataset OR a HF Hub repo (e.g. user/name)",
    )
    parser.add_argument("--split", default="train", help="Split to export (default: train)")
    parser.add_argument("--config", default=None, help="Dataset config name (optional)")
    parser.add_argument(
        "--output",
        default="public/data/dataset.jsonl",
        help="Output JSONL path (default: public/data/dataset.jsonl)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional row limit for fast dev iteration",
    )
    args = parser.parse_args()

    try:
        from datasets import load_from_disk, load_dataset
    except ImportError as e:
        raise SystemExit(
            "Missing dependency. Install with: pip install datasets"
        ) from e

    src = Path(args.dataset)
    if src.exists():
        ds = load_from_disk(str(src))
        # If load_from_disk returned a DatasetDict, pick the requested split.
        if hasattr(ds, "keys") and args.split in ds:
            ds = ds[args.split]
    else:
        ds = load_dataset(args.dataset, args.config, split=args.split)

    if args.limit is not None:
        ds = ds.select(range(min(args.limit, len(ds))))

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    ds.to_json(str(out), lines=True, force_ascii=False)
    print(f"Exported {len(ds)} rows to {out}")


if __name__ == "__main__":
    main()
