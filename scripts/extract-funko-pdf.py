#!/usr/bin/env python3
"""
Извлекает коллекцию Animation со 2-й страницы «Funko Pops.pdf».

Правила (см. scripts/data/funko/IMPORT.md):
  ✓ + жёлтая строка  → owned
  без галочки         → in_transit
  цифра > 1 вместо ✓  → has_duplicates (+ quantity)
  «Особенности»       → notes

Выход: scripts/data/funko/collection-animation.json
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent
DEFAULT_PDF = ROOT / "data/funko/Funko-Pops.pdf"
OUT_JSON = ROOT / "data/funko/collection-animation.json"
PAGE_INDEX = 1  # 2-я страница PDF (Animation)


def col_of(x: float) -> str:
    if x < 95:
        return "mark"
    if x < 160:
        return "num"
    if x < 370:
        return "series"
    if x < 690:
        return "name"
    return "feat"


def build_title(subseries: str, name: str, pop_number: int | None) -> str:
    parts = [p for p in (subseries.strip(), name.strip()) if p]
    if parts:
        return " — ".join(parts) if len(parts) == 2 else parts[0]
    if pop_number is not None:
        return f"#{pop_number}"
    return "Без названия"


def parse_animation_page(page: fitz.Page) -> list[dict]:
    drawings = page.get_drawings()
    yellow_ys: set[int] = set()
    for d in drawings:
        fill = d.get("fill")
        if not fill or len(fill) < 3:
            continue
        r, g, b = fill[:3]
        if r > 0.85 and g > 0.85 and b < 0.75:
            rect = fitz.Rect(d["rect"])
            yellow_ys.add(round((rect.y0 + rect.y1) / 2))

    words = page.get_text("words")
    header_y = next(w[1] for w in words if w[4] == "Подсерия")

    line_map: dict[int, list] = defaultdict(list)
    for w in words:
        if w[1] <= header_y + 5:
            continue
        line_map[round(w[1])].append(w)

    raw_rows: list[dict] = []
    pending: dict | None = None

    for y in sorted(line_map.keys()):
        ws = sorted(line_map[y], key=lambda w: w[0])
        cols: dict[str, list[str]] = defaultdict(list)
        for w in ws:
            cols[col_of(w[0])].append(w[4])

        mark = " ".join(cols["mark"]).strip()
        num = " ".join(cols["num"]).strip()
        series = " ".join(cols["series"]).strip()
        name = " ".join(cols["name"]).strip()
        feat = " ".join(cols["feat"]).strip()

        if mark in ("✓", "✔") and not num and not series and not name:
            if pending is not None:
                pending["checked"] = True
            continue

        dup: int | None = None
        if mark.isdigit():
            dup = int(mark)

        if pending is not None and (num or series or name):
            raw_rows.append(pending)

        if num or series or name or feat:
            pop = int(num) if num.isdigit() else None
            pending = {
                "popNumber": pop,
                "subseries": series,
                "name": name,
                "features": feat,
                "checked": False,
                "dupCount": dup,
                "yellow": any(abs(y - yy) < 15 for yy in yellow_ys),
            }
        elif num.isdigit():
            if pending is not None:
                raw_rows.append(pending)
            pending = {
                "popNumber": int(num),
                "subseries": "",
                "name": "",
                "features": feat,
                "checked": False,
                "dupCount": dup,
                "yellow": any(abs(y - yy) < 15 for yy in yellow_ys),
            }

    if pending is not None:
        raw_rows.append(pending)

    out: list[dict] = []
    for i, row in enumerate(raw_rows):
        checked = bool(row.get("checked"))
        dup_count = row.get("dupCount")
        owned = checked and bool(row.get("yellow", True))
        # Все галочки в PDF на жёлтых строках; owned = галочка
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

        out.append(
            {
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
                "sortOrder": i,
            }
        )

    return out


def main() -> None:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf_path.is_file():
        raise SystemExit(f"PDF не найден: {pdf_path}")

    doc = fitz.open(pdf_path)
    if doc.page_count <= PAGE_INDEX:
        raise SystemExit(f"В PDF меньше {PAGE_INDEX + 1} страниц")

    rows = parse_animation_page(doc[PAGE_INDEX])
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    owned = sum(1 for r in rows if r["owned"])
    transit = sum(1 for r in rows if r["inTransit"])
    dupes = sum(1 for r in rows if r["hasDuplicates"])
    print(f"Wrote {len(rows)} rows → {OUT_JSON}")
    print(f"  Есть: {owned}, В пути: {transit}, Дубли: {dupes}")


if __name__ == "__main__":
    main()
