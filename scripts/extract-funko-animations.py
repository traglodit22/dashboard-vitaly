#!/usr/bin/env python3
"""Извлечь Pop! Animation из funko_pop.csv в scripts/data/funko/animations.json."""
import csv
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data/funko/animations.json"


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/funko_pop.csv"
    rows = []
    with open(src, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if "Pop! Animation" not in row["series"]:
                continue
            rows.append(
                {
                    "handle": row["handle"],
                    "title": row["title"],
                    "imageUrl": row["imageName"],
                    "series": [s.strip() for s in row["series"].split(";") if s.strip()],
                }
            )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(rows)} items to {OUT}")


if __name__ == "__main__":
    main()
