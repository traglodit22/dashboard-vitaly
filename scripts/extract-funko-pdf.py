#!/usr/bin/env python3
"""
Извлекает коллекцию из «Funko Pops.pdf» по страницам.

Правила (см. scripts/data/funko/IMPORT.md):
  ✓                  → owned
  без галочки        → in_transit
  цифра > 1 вместо ✓ → has_duplicates (+ quantity)
  «Особенности»      → notes

Выход: scripts/data/funko/collection-{slug}.json
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent
DEFAULT_PDF = ROOT / "data/funko/Funko-Pops.pdf"
OUT_DIR = ROOT / "data/funko"

# PDF page index (0-based) → slug дашборда
PAGE_CATEGORY_MAP: list[tuple[int, str]] = [
    (1, "animation"),
    (2, "asia"),
    (3, "disney"),
    (4, "games"),
    (5, "gold"),
    (6, "harry-potter"),
    (7, "heroes"),
    (8, "marvel"),
    (9, "movies"),
    (10, "retro"),
    (11, "rocks"),
    (12, "sport"),
    (13, "soda"),
    (14, "starwars"),
    (15, "tv"),
    (16, "other"),
    (17, "game-of-thrones"),
]

CHECK_MARKS = ("✓", "✔")


def parse_pop_number(raw: str) -> int | None:
    raw = raw.strip()
    if not raw:
        return None
    if raw.isdigit():
        n = int(raw)
        return n if n > 0 else None
    m = re.search(r"\d+", raw)
    if m:
        n = int(m.group())
        return n if n > 0 else None
    return None


def build_title(subseries: str, name: str, pop_number: int | None) -> str:
    parts = [p for p in (subseries.strip(), name.strip()) if p]
    if parts:
        return " — ".join(parts) if len(parts) == 2 else parts[0]
    if pop_number is not None:
        return f"#{pop_number}"
    return "Без названия"


def yellow_ys(page: fitz.Page) -> set[int]:
    out: set[int] = set()
    for d in page.get_drawings():
        fill = d.get("fill")
        if not fill or len(fill) < 3:
            continue
        r, g, b = fill[:3]
        if r > 0.85 and g > 0.85 and b < 0.75:
            rect = fitz.Rect(d["rect"])
            out.add(round((rect.y0 + rect.y1) / 2))
    return out


def detect_columns(words: list) -> dict[str, float]:
    """X-координаты заголовков колонок."""
    cols: dict[str, float] = {}
    for w in words:
        token = w[4]
        if token == "Подсерия":
            cols["series"] = w[0]
        elif token == "Фигурка":
            cols["name"] = w[0]
        elif token == "Особенности":
            cols["feat"] = w[0]
    return cols


def col_bucket(x: float, cols: dict[str, float], starwars: bool = False) -> str:
    if x < 95:
        return "mark"
    if starwars:
        if "name" in cols and x < cols["name"] + 40:
            return "num"
        if "name" in cols and x < cols.get("feat", 9999) - 30:
            return "name"
        return "feat"
    if "series" in cols:
        if x < cols["series"] + 35:
            return "num"
        if "name" in cols and x < cols["name"] - 20:
            return "series"
        if "name" in cols and x < cols.get("feat", 9999) - 40:
            return "name"
        return "feat"
  # fallback
    if x < 160:
        return "num"
    if x < 370:
        return "series"
    if x < 690:
        return "name"
    return "feat"


def finalize_row(row: dict, index: int) -> dict:
    checked = bool(row.get("checked"))
    dup_count = row.get("dupCount")
    owned = checked
    in_transit = not owned
    has_duplicates = bool(dup_count and dup_count > 1)
    features = (row.get("features") or "").strip()
    notes = features
    if has_duplicates:
        dup_note = f"есть дубли (×{dup_count})"
        notes = f"{dup_note}; {features}" if features else dup_note

    subseries = row.get("subseries") or ""
    name = row.get("name") or ""
    pop_number = row.get("popNumber")

    return {
        "popNumber": pop_number,
        "subseries": subseries,
        "name": name,
        "title": build_title(subseries, name, pop_number),
        "features": features,
        "notes": notes or None,
        "owned": owned,
        "inTransit": in_transit,
        "hasDuplicates": has_duplicates,
        "quantity": dup_count if dup_count and dup_count > 1 else 0,
        "sortOrder": index,
    }


def parse_table_page(page: fitz.Page, *, starwars: bool = False) -> list[dict]:
    words = page.get_text("words")
    cols = detect_columns(words)
    if not starwars and "series" not in cols:
        raise ValueError("Нет колонки «Подсерия»")

    header_y = next(
        (w[1] for w in words if w[4] in ("Подсерия", "Фигурка")),
        0,
    )

    line_map: dict[int, list] = defaultdict(list)
    for w in words:
        if w[1] <= header_y + 5:
            continue
        line_map[round(w[1])].append(w)

    # Объединить соседние строки (галочка и данные часто на ±1–12px)
    merged_lines: list[list] = []
    for y in sorted(line_map.keys()):
        ws = line_map[y]
        if merged_lines:
            prev_y = round(sum(w[1] for w in merged_lines[-1]) / len(merged_lines[-1]))
            if y - prev_y <= 18:
                merged_lines[-1].extend(ws)
                continue
        merged_lines.append(ws)

    raw_rows: list[dict] = []
    pending: dict | None = None
    orphan_checks: list[int] = []

    for ws in merged_lines:
        y = round(sum(w[1] for w in ws) / len(ws))
        ws = sorted(ws, key=lambda w: w[0])
        coltext: dict[str, list[str]] = defaultdict(list)
        for w in ws:
            coltext[col_bucket(w[0], cols, starwars)].append(w[4])

        mark = " ".join(coltext["mark"]).strip()
        num = " ".join(coltext["num"]).strip()
        series = " ".join(coltext["series"]).strip()
        name = " ".join(coltext["name"]).strip()
        feat = " ".join(coltext["feat"]).strip()

        has_check = mark in CHECK_MARKS or any(t in CHECK_MARKS for t in mark.split())

        if has_check and not num and not series and not name:
            orphan_checks.append(y)
            continue

        dup: int | None = None
        if mark.isdigit():
            dup = int(mark)

        if pending is not None and (num or series or name):
            raw_rows.append(pending)
            pending = None

        if num or series or name or feat:
            pop = parse_pop_number(num)
            pending = {
                "popNumber": pop,
                "subseries": series,
                "name": name,
                "features": feat,
                "checked": has_check,
                "dupCount": dup,
                "y": y,
            }
        elif parse_pop_number(num) is not None:
            if pending is not None:
                raw_rows.append(pending)
            pending = {
                "popNumber": parse_pop_number(num),
                "subseries": "",
                "name": "",
                "features": feat,
                "checked": False,
                "dupCount": dup,
                "y": y,
            }

    if pending is not None:
        raw_rows.append(pending)

    # Привязать одиночные галочки к ближайшей строке (±18px)
    for cy in orphan_checks:
        if not raw_rows:
            continue
        best = min(raw_rows, key=lambda r: abs(r.get("y", 0) - cy))
        if abs(best.get("y", 0) - cy) <= 18:
            best["checked"] = True

    return [finalize_row(r, i) for i, r in enumerate(raw_rows)]


def route_other_row(row: dict) -> str:
    """Распределить строку со стр. Other по категориям."""
    text = f"{row.get('subseries', '')} {row.get('name', '')} {row.get('features', '')}".lower()
    if "game of thrones" in text or row.get("subseries", "").lower().startswith("of thrones"):
        return "game-of-thrones"
    if "south park" in text:
        return "south-park"
    if "sesame" in text:
        return "sesame-street"
    if "halo" in text:
        return "halo"
    if "muppet" in text:
        return "muppets"
    if "8-bit" in text or "8 bit" in text:
        return "8-bit"
    if "vhs" in text:
        return "vhs-covers"
    if "comic cover" in text:
        return "comic-covers"
    if "nightmare before christmas" in text or "tnbc" in text or "disney" in text:
        return "disney"
    if "art series" in text or text.startswith("art "):
        return "art"
    if "book" in text:
        return "books"
    if "drag queen" in text:
        return "drag-queens"
    if "director" in text:
        return "directors"
    if "ad icon" in text:
        return "ad-icons"
    if "icon" in text:
        return "icons"
    if "ride" in text:
        return "rides"
    if "royal" in text:
        return "royals"
    if "sci-fi" in text or "sci fi" in text:
        return "sci-fi"
    if "broadway" in text:
        return "broadway"
    if "comedian" in text:
        return "comedians"
    if "comics" in text and "cover" not in text:
        return "comics"
    # Музыкальные альбомы и рок-артисты
    album_hints = (
        "acdc", "queen", "ozzy", "iron maiden", "hendrix", "britney", "linkin park",
        "notorious", "mariah", "album", "vinyl", "metallica", "nirvana", "kiss",
        "elvis", "beatles", "michael jackson", "prince", "madonna",
    )
    if any(h in text for h in album_hints):
        return "album"
    if "rock" in row.get("subseries", "").lower() or row.get("subseries", "").lower() in (
        "acdc", "queen", "ozzy osbourne", "iron maiden", "hendrix",
    ):
        return "rocks" if "rocks" not in text else "rocks"
    return "tv"


def coalesce_starwars_rows(rows: list[dict]) -> list[dict]:
    """Склеить разорванные строки Star Wars (имя на соседней линии)."""
    out: list[dict] = []
    i = 0
    while i < len(rows):
        row = dict(rows[i])
        name = (row.get("name") or "").strip()
        if not name and i + 1 < len(rows):
            nxt = rows[i + 1]
            nxt_name = (nxt.get("name") or "").strip()
            if nxt_name:
                owned = bool(row.get("owned") or nxt.get("owned"))
                merged = {
                    **row,
                    "name": nxt_name,
                    "owned": owned,
                    "inTransit": not owned,
                    "features": (row.get("features") or nxt.get("features") or "").strip(),
                    "popNumber": row.get("popNumber") if row.get("popNumber") else nxt.get("popNumber"),
                    "subseries": "Star Wars",
                }
                merged["title"] = build_title("Star Wars", merged["name"], merged["popNumber"])
                out.append(merged)
                i += 2
                continue
        if name or row.get("popNumber"):
            row["subseries"] = row.get("subseries") or "Star Wars"
            row["title"] = build_title(row["subseries"], name, row.get("popNumber"))
            out.append(row)
        i += 1
    for idx, row in enumerate(out):
        row["sortOrder"] = idx
    return out


def parse_page(page: fitz.Page, slug: str) -> list[dict]:
    starwars = slug == "starwars"
    rows = parse_table_page(page, starwars=starwars)
    if starwars:
        return coalesce_starwars_rows(rows)
    return rows


def main() -> None:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf_path.is_file():
        raise SystemExit(f"PDF не найден: {pdf_path}")

    doc = fitz.open(pdf_path)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    buckets: dict[str, list[dict]] = defaultdict(list)

    for page_idx, slug in PAGE_CATEGORY_MAP:
        if page_idx >= doc.page_count:
            print(f"Skip p{page_idx + 1} ({slug}): нет страницы")
            continue
        try:
            rows = parse_page(doc[page_idx], slug)
        except Exception as exc:
            print(f"ERROR p{page_idx + 1} ({slug}): {exc}")
            continue

        if slug == "other":
            for row in rows:
                if not row.get("name") and not row.get("subseries"):
                    continue
                target = route_other_row(row)
                buckets[target].append(row)
        else:
            cleaned = []
            for row in rows:
                if not row.get("name") and not row.get("subseries"):
                    continue
                if slug == "soda" and not row.get("subseries"):
                    row["subseries"] = "Soda"
                    row["title"] = build_title("Soda", row.get("name") or "", row.get("popNumber"))
                cleaned.append(row)
            buckets[slug].extend(cleaned)
            rows = cleaned

        owned = sum(1 for r in rows if r["owned"])
        print(f"p{page_idx + 1} {slug}: {len(rows)} rows (есть {owned})")

    for slug, rows in sorted(buckets.items()):
        for i, row in enumerate(rows):
            row["sortOrder"] = i
        out = OUT_DIR / f"collection-{slug}.json"
        out.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        owned = sum(1 for r in rows if r["owned"])
        transit = sum(1 for r in rows if r["inTransit"])
        dupes = sum(1 for r in rows if r["hasDuplicates"])
        print(f"  → {out.name}: {len(rows)} (есть {owned}, в пути {transit}, дубли {dupes})")


if __name__ == "__main__":
    main()
