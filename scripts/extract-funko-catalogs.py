#!/usr/bin/env python3
"""Извлечь каталоги Funko Pop по линейкам из funko_pop.csv в scripts/data/funko/*.json."""
import csv
import json
import sys
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent / "data/funko"

CATEGORIES = [
    ("animations.json", "Pop! Animation"),
    ("asia.json", "Pop! Asia"),
    ("disney.json", "Pop! Disney"),
    ("games.json", "Pop! Games"),
    ("harry-potter.json", "Pop! Harry Potter"),
    ("heroes.json", "Pop! Heroes"),
    ("marvel.json", "Pop! Marvel"),
    ("movies.json", "Pop! Movies"),
    ("retro.json", "Pop! Retro Toys"),
    ("rocks.json", "Pop! Rocks"),
    ("sport.json", "Pop! Sports"),
    ("soda.json", "Soda Figures"),
    ("starwars.json", "Pop! Star Wars"),
]


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/funko_pop.csv"
    buckets: dict[str, list] = {name: [] for name, _ in CATEGORIES}

    with open(src, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            series_raw = row["series"]
            for filename, needle in CATEGORIES:
                if needle not in series_raw:
                    continue
                buckets[filename].append(
                    {
                        "handle": row["handle"],
                        "title": row["title"],
                        "imageUrl": row["imageName"],
                        "series": [s.strip() for s in series_raw.split(";") if s.strip()],
                    }
                )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, _ in CATEGORIES:
        rows = buckets[filename]
        path = OUT_DIR / filename
        path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Wrote {len(rows):4d} items → {path.name}")

    # Pop! Gold отсутствует в датасете kennymkchan
    gold_path = OUT_DIR / "gold.json"
    gold_path.write_text("[]", encoding="utf-8")
    print(f"Wrote    0 items → {gold_path.name} (нет в CSV)")


if __name__ == "__main__":
    main()
