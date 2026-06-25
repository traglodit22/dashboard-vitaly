#!/usr/bin/env python3
"""Извлечь каталоги Funko Pop по линейкам из funko_pop.csv в scripts/data/funko/*.json."""
import csv
import json
import sys
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent / "data/funko"

# Синхронизировать с src/lib/funko/categoryConfig.ts
# (filename, needle, match_mode) — match_mode: "pop" | "football"
CATEGORIES: list[tuple[str, str, str]] = [
    ("animations.json", "Pop! Animation", "pop"),
    ("asia.json", "Pop! Asia", "pop"),
    ("basketball.json", "Pop! Basketball", "pop"),
    ("disney.json", "Pop! Disney", "pop"),
    ("football.json", "Pop! Football", "football"),
    ("games.json", "Pop! Games", "pop"),
    ("harry-potter.json", "Pop! Harry Potter", "pop"),
    ("heroes.json", "Pop! Heroes", "pop"),
    ("hockey.json", "Pop! Hockey", "pop"),
    ("marvel.json", "Pop! Marvel", "pop"),
    ("mlb.json", "Pop! MLB", "pop"),
    ("movies.json", "Pop! Movies", "pop"),
    ("retro.json", "Pop! Retro Toys", "pop"),
    ("rocks.json", "Pop! Rocks", "pop"),
    ("snl.json", "Pop! SNL", "pop"),
    ("soda.json", "Soda Figures", "pop"),
    ("sports-legends.json", "Pop! Sports Legends", "pop"),
    ("starwars.json", "Pop! Star Wars", "pop"),
    ("tennis.json", "Pop! Tennis", "pop"),
    ("ufc.json", "Pop! UFC", "pop"),
    ("wwe.json", "Pop! WWE", "pop"),
    ("game-of-thrones.json", "Pop! Game Of Thrones", "pop"),
    ("tv.json", "Pop! Television", "pop"),
    ("8-bit.json", "Pop! 8-Bit", "pop"),
    ("album.json", "Pop! Albums", "pop"),
    ("art.json", "Pop! Art Series", "pop"),
    ("books.json", "Pop! Books", "pop"),
    ("comedians.json", "Pop! Comedians", "pop"),
    ("comics.json", "Pop! Comics", "pop"),
    ("directors.json", "Pop! Directors", "pop"),
    ("icons.json", "Pop! Icons", "pop"),
    ("ad-icons.json", "Pop! Ad Icons", "pop"),
    ("drag-queens.json", "Pop! Drag Queens", "pop"),
    ("halo.json", "Pop! Halo", "pop"),
    ("muppets.json", "Pop! Muppets", "pop"),
    ("myths.json", "Pop! Myths", "pop"),
    ("pets.json", "Pop! Pets", "pop"),
    ("rides.json", "Pop! Rides", "pop"),
    ("royals.json", "Pop! Royals", "pop"),
    ("sesame-street.json", "Pop! Sesame Street", "pop"),
    ("sci-fi.json", "Pop! Sci-Fi", "pop"),
    ("south-park.json", "Pop! South Park", "pop"),
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
    "boxing.json",
    "nba-mascots.json",
]


def series_parts(series_raw: str) -> list[str]:
    return [s.strip() for s in series_raw.split(";") if s.strip()]


def pop_series_match(series_raw: str, needle: str) -> bool:
    """Совпадение линейки Pop! включая волны, без ложных префиксов."""
    for part in series_parts(series_raw):
        if part == needle:
            return True
        if part.startswith(needle + ":"):
            return True
    return False


def football_match(series_raw: str) -> bool:
    """Pop! Football (NFL), без Pop! Football (Soccer)."""
    for part in series_parts(series_raw):
        if part == "Pop! Football (Soccer)":
            continue
        if part == "Pop! Football" or part.startswith("Pop! Football:"):
            return True
    return False


def matches(series_raw: str, needle: str, mode: str) -> bool:
    if mode == "football":
        return football_match(series_raw)
    return pop_series_match(series_raw, needle)


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else "/tmp/funko_pop.csv"
    buckets: dict[str, list] = {name: [] for name, _, _ in CATEGORIES}
    art_rows: list = []

    with open(src, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            series_raw = row["series"]
            for filename, needle, mode in CATEGORIES:
                if filename == "art.json":
                    if pop_series_match(series_raw, "Pop! Art Series") or pop_series_match(
                        series_raw, "Pop! Artists"
                    ):
                        art_rows.append(
                            {
                                "handle": row["handle"],
                                "title": row["title"],
                                "imageUrl": row["imageName"],
                                "series": series_parts(series_raw),
                            }
                        )
                    continue
                if not matches(series_raw, needle, mode):
                    continue
                buckets[filename].append(
                    {
                        "handle": row["handle"],
                        "title": row["title"],
                        "imageUrl": row["imageName"],
                        "series": series_parts(series_raw),
                    }
                )

    buckets["art.json"] = art_rows

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, _, _ in CATEGORIES:
        rows = buckets[filename]
        path = OUT_DIR / filename
        path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Wrote {len(rows):4d} items → {path.name}")

    for filename in EMPTY:
        path = OUT_DIR / filename
        path.write_text("[]", encoding="utf-8")
        print(f"Wrote    0 items → {filename} (нет в CSV)")

    # Удалить устаревший общий каталог Sport
    legacy = OUT_DIR / "sport.json"
    if legacy.exists():
        legacy.unlink()
        print("Removed sport.json (legacy)")


if __name__ == "__main__":
    main()
