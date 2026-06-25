#!/usr/bin/env python3
"""Извлечь каталоги Funko Pop по линейкам из funko_pop.csv в scripts/data/funko/*.json."""
import csv
import json
import sys
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent / "data/funko"

# Синхронизировать с src/lib/funko/categoryConfig.ts
CATEGORIES = [
    ("animations.json", ["Pop! Animation"]),
    ("asia.json", ["Pop! Asia"]),
    ("disney.json", ["Pop! Disney"]),
    ("games.json", ["Pop! Games"]),
    ("harry-potter.json", ["Pop! Harry Potter"]),
    ("heroes.json", ["Pop! Heroes"]),
    ("marvel.json", ["Pop! Marvel"]),
    ("movies.json", ["Pop! Movies"]),
    ("retro.json", ["Pop! Retro Toys"]),
    ("rocks.json", ["Pop! Rocks"]),
    ("sport.json", ["Pop! Sports"]),
    ("soda.json", ["Soda Figures"]),
    ("starwars.json", ["Pop! Star Wars"]),
    ("game-of-thrones.json", ["Pop! Game Of Thrones"]),
    ("tv.json", ["Pop! Television"]),
    ("8-bit.json", ["Pop! 8-Bit"]),
    ("album.json", ["Pop! Albums"]),
    ("art.json", ["Pop! Art Series", "Pop! Artists"]),
    ("books.json", ["Pop! Books"]),
    ("comedians.json", ["Pop! Comedians"]),
    ("comics.json", ["Pop! Comics"]),
    ("directors.json", ["Pop! Directors"]),
    ("icons.json", ["Pop! Icons"]),
    ("ad-icons.json", ["Pop! Ad Icons"]),
    ("drag-queens.json", ["Pop! Drag Queens"]),
    ("halo.json", ["Pop! Halo"]),
    ("muppets.json", ["Pop! Muppets"]),
    ("myths.json", ["Pop! Myths"]),
    ("pets.json", ["Pop! Pets"]),
    ("rides.json", ["Pop! Rides"]),
    ("royals.json", ["Pop! Royals"]),
    ("sesame-street.json", ["Pop! Sesame Street"]),
    ("sci-fi.json", ["Pop! Sci-Fi"]),
    ("south-park.json", ["Pop! South Park"]),
]

EMPTY = [
    "gold.json",
    "house-of-the-dragon.json",
    "broadway.json",
    "comic-covers.json",
    "nooks.json",
    "racing.json",
    "tokidoki.json",
    "vhs-covers.json",
]


def matches(series_raw: str, needles: list[str]) -> bool:
    return any(n in series_raw for n in needles)


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/funko_pop.csv"
    buckets: dict[str, list] = {name: [] for name, _ in CATEGORIES}

    with open(src, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            series_raw = row["series"]
            for filename, needles in CATEGORIES:
                if not matches(series_raw, needles):
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

    for filename in EMPTY:
        path = OUT_DIR / filename
        path.write_text("[]", encoding="utf-8")
        print(f"Wrote    0 items → {filename} (нет в CSV)")


if __name__ == "__main__":
    main()
