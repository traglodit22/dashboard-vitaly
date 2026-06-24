#!/usr/bin/env python3
"""Извлекает позиции и картинки из PDF «Клуб.pdf» → scripts/data/klub/."""
from __future__ import annotations

import json
import re
from pathlib import Path

import fitz

PDF_PATH = Path("/Users/trag/Documents/Клуб.pdf")
OUT_DIR = Path(__file__).resolve().parent / "data" / "klub"
IMAGES_DIR = OUT_DIR / "images"

# Порядок строк = порядок картинок в PDF (page, y), сверху вниз.
KLUB_ROWS: list[dict] = [
    {"row_type": "type", "name": "Оформление", "sort": 10},
    {
        "name": "Стены",
        "need_qty": 0,
        "link": "https://ru.pinterest.com/pin/11892386512557145/",
        "notes": "Стиль Wabi-Sabi; можно оставлять неровности. Делаем пробу и выкрас обязательно!",
        "sort": 20,
    },
    {
        "name": "Стена за ресепшеном",
        "need_qty": 0,
        "notes": "Белый, полоски как в сказке. Бежевой с вертикальными линиями-углублениями (как в реальной кухне, но достать профиль!)",
        "sort": 30,
    },
    {
        "name": "Плитка на полу",
        "need_qty": 400,
        "link": "https://kerranova.ru/catalog/monochrom/monochrom_k_2062/",
        "notes": "Около 400 м². Маша: Монохром серый",
        "sort": 40,
    },
    {
        "name": "Потолок",
        "need_qty": 0,
        "notes": "Белый, гладкий",
        "sort": 50,
    },
    {
        "name": "Потолок (дерево)",
        "need_qty": 0,
        "link": "https://derevo.by/product/planken-listven-sib-20x90x4000-norma-/",
        "notes": "Планкен. Ширина досок до 100",
        "sort": 60,
    },
    {"row_type": "type", "name": "Освещение", "sort": 100},
    {
        "name": "Светильник 1 (для ресторана)",
        "need_qty": 6,
        "link": "https://aliexpress.ru/item/1005007876992694.html",
        "notes": "A2 белый 370/1130. Перед заказом перепроверить ссылку — цены скачут",
        "sort": 110,
    },
    {
        "name": "Светильник 2 (для ресторана)",
        "need_qty": 6,
        "link": "https://aliexpress.ru/item/1005007876992694.html",
        "notes": "A3 белый 370/1930",
        "sort": 120,
    },
    {
        "name": "Светильник 3 (для ресторана)",
        "need_qty": 6,
        "link": "https://aliexpress.ru/item/1005007876992694.html",
        "notes": "B3 белый 830/1930",
        "sort": 130,
    },
    {
        "name": "Светильник 4 (для ресторана)",
        "need_qty": 6,
        "notes": "белый 1200/1130",
        "sort": 140,
    },
    {
        "name": "Светильник 1 (клуб)",
        "need_qty": 9,
        "link": "https://aliexpress.ru/item/1005007876992694.html",
        "notes": "Зелёные 830/1100 (ссылка иногда пропадает)",
        "sort": 150,
    },
    {
        "name": "Светильник 1 (клуб туалеты)",
        "need_qty": 2,
        "link": "https://aliexpress.ru/item/1005007876992694.html",
        "notes": "Красные (коричневые)",
        "sort": 160,
    },
    {
        "name": "Светильник 2 (клуб)",
        "need_qty": 3,
        "link": "https://aliexpress.ru/item/1005007876992694.html",
        "notes": "Зелёные 830/1910 (ссылка иногда пропадает)",
        "sort": 170,
    },
    {"row_type": "type", "name": "Ресепшен", "sort": 200},
    {
        "name": "Стойка ресепшен",
        "need_qty": 0,
        "notes": "Супер матовые SU или SM",
        "sort": 210,
    },
    {
        "name": "Кресла",
        "need_qty": 2,
        "link": "https://www.21vek.by/office_chairs/charm_tetchair_03.html",
        "notes": "Красивые, для ресепшена",
        "sort": 220,
    },
    {
        "name": "Люстра",
        "need_qty": 1,
        "link": "https://aliexpress.ru/item/1005006305745913.html",
        "notes": "Ширина 2000. Альт: https://aliexpress.ru/item/1005006022579321.html — интересная; https://aliexpress.ru/item/1005006301311605.html — на рендере, но скучновата",
        "sort": 230,
    },
    {
        "name": "Надпись",
        "need_qty": 1,
        "notes": "Высота букв 120. Полностью светящаяся",
        "sort": 240,
    },
    {
        "name": "Вазон",
        "need_qty": 1,
        "link": "https://www.wildberries.ru/catalog/171669282/detail.aspx",
        "notes": "Высота 600",
        "sort": 250,
    },
    {
        "name": "Олива",
        "need_qty": 1,
        "notes": "Высота 180",
        "sort": 260,
    },
    {"row_type": "type", "name": "Мебель", "sort": 300},
    {
        "name": "Диван",
        "need_qty": 4,
        "link": "https://www.divan.by/product/kushetka-olten-textile-forest",
        "sort": 310,
    },
    {
        "name": "Пуфы 1",
        "need_qty": 3,
        "link": "https://www.divan.by/product/puf-dzen-1-velvet-beige",
        "sort": 320,
    },
    {
        "name": "Пуфы 2",
        "need_qty": 1,
        "link": "https://www.divan.by/product/puf-dzen-2-velvet-beige",
        "sort": 330,
    },
    {
        "name": "Зеркала",
        "need_qty": 2,
        "link": "https://www.21vek.by/",
        "notes": "Такого плана, другой размер, на заказ. 2000×800",
        "sort": 340,
    },
    {
        "name": "Вешалки",
        "need_qty": 0,
        "notes": "Столбики 40×40, перекладины 30×30. Высота перекладин 1800 и 3000",
        "sort": 350,
    },
    {
        "name": "Шторы",
        "need_qty": 0,
        "notes": "Натуральная текстура, плотные (льняные, не велюр), может не чисто белые",
        "sort": 360,
        "image": False,
    },
    {
        "name": "Тюль",
        "need_qty": 0,
        "notes": "Лёгкие, чуть молочные, не обязательно чисто белые",
        "sort": 370,
        "image": False,
    },
    {"row_type": "type", "name": "Санузлы", "sort": 400},
    {
        "name": "Надпись WC",
        "need_qty": 5,
        "notes": "Высота букв 180, чёрные, шрифт a_RubricaXtCn",
        "sort": 410,
    },
    {
        "name": "Люстра (санузлы)",
        "need_qty": 1,
        "notes": "Уже есть",
        "sort": 420,
    },
    {
        "name": "Унитаз",
        "need_qty": 5,
        "notes": "3 для посетителей, 2 для персонала (запасные)",
        "sort": 430,
    },
    {
        "name": "Держатель для туал. бумаги",
        "need_qty": 5,
        "link": "https://www.wildberries.ru/catalog/301585345/detail.aspx",
        "notes": "Такого плана",
        "sort": 440,
    },
    {
        "name": "Умывальник",
        "need_qty": 4,
        "link": "https://www.21vek.by/washbasins/helmimini24t50303_teymi_8814964.html",
        "notes": "2 для посетителей, 2 для персонала",
        "sort": 450,
    },
    {
        "name": "Тумба под умывальник",
        "need_qty": 4,
        "sort": 460,
    },
    {
        "name": "Смеситель",
        "need_qty": 4,
        "link": "https://www.21vek.by/faucets/l71103_ledeme.html",
        "sort": 470,
    },
    {
        "name": "Умывальник (большой санузел)",
        "need_qty": 1,
        "link": "https://santehart.by/catalog/napolnye-umyvalniki/napolnaya-akrilovaya-rakovina-/",
        "notes": "Для большого санузла",
        "sort": 480,
    },
    {
        "name": "Полка для мыла",
        "need_qty": 1,
        "link": "https://www.wildberries.ru/catalog/168910918/detail.aspx",
        "notes": "Такого плана",
        "sort": 490,
    },
    {
        "name": "Дозатор полотенец",
        "need_qty": 5,
        "link": "https://www.wildberries.ru/catalog/233249457/detail.aspx",
        "sort": 500,
    },
    {
        "name": "Мусорки",
        "need_qty": 5,
        "link": "https://www.wildberries.ru/catalog/178439107/detail.aspx",
        "sort": 510,
    },
    {
        "name": "Крючки для сумки",
        "need_qty": 10,
        "link": "https://www.wildberries.ru/catalog/151546253/detail.aspx",
        "sort": 520,
    },
    {"row_type": "type", "name": "Ресторан", "sort": 600},
    {
        "name": "Зеркала (ресторан, 3 шт)",
        "need_qty": 3,
        "link": "https://www.21vek.by/mirrors/061_almaz_luks_8599590.html",
        "sort": 610,
    },
    {
        "name": "Зеркала (ресторан, 5 шт)",
        "need_qty": 5,
        "link": "https://www.21vek.by/mirrors/060_almaz_luks.html",
        "sort": 620,
    },
    {
        "name": "Гипсовые панели",
        "need_qty": 0,
        "notes": "Нужно сделать, договоримся с артпанель",
        "sort": 630,
    },
    {
        "name": "Стены (ресторан)",
        "need_qty": 0,
        "sort": 640,
        "image": False,
    },
]


def collect_images(doc: fitz.Document) -> list[tuple[int, fitz.Rect, int]]:
    out: list[tuple[int, fitz.Rect, int]] = []
    for pi in range(doc.page_count):
        page = doc[pi]
        for b in page.get_text("dict")["blocks"]:
            if b["type"] != 1:
                continue
            w, h = b["width"], b["height"]
            if w < 80 or h < 80:
                continue
            if b["bbox"][0] > 350:
                continue
            out.append((pi, fitz.Rect(b["bbox"]), b.get("number", 0)))
    out.sort(key=lambda t: (t[0], t[1].y0, t[1].x0))
    return out


def main() -> None:
    if not PDF_PATH.is_file():
        raise SystemExit(f"PDF не найден: {PDF_PATH}")

    doc = fitz.open(PDF_PATH)
    images_meta = collect_images(doc)
    image_items = [r for r in KLUB_ROWS if r.get("row_type") != "type" and r.get("image", True)]

    if len(images_meta) < len(image_items):
        print(f"WARN: картинок {len(images_meta)}, позиций с фото {len(image_items)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    img_idx = 0
    export_rows: list[dict] = []

    for row in KLUB_ROWS:
        entry = {
            "row_type": row.get("row_type", "item"),
            "name": row["name"],
            "group_name": None,
            "need_qty": int(row.get("need_qty", 0)),
            "have_qty": 0,
            "in_transit_qty": 0,
            "notes": row.get("notes"),
            "link": row.get("link"),
            "sort_order": row["sort"],
            "image_file": None,
        }
        if entry["row_type"] == "type":
            export_rows.append(entry)
            continue

        if row.get("image", True) and img_idx < len(images_meta):
            pi, rect, _num = images_meta[img_idx]
            page = doc[pi]
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect, alpha=False)
            fname = f"{row['sort']:04d}.png"
            pix.save(IMAGES_DIR / fname)
            entry["image_file"] = fname
            img_idx += 1

        export_rows.append(entry)

    (OUT_DIR / "items.json").write_text(
        json.dumps(export_rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"OK: {len(export_rows)} строк, {img_idx} картинок → {OUT_DIR}")


if __name__ == "__main__":
    main()
