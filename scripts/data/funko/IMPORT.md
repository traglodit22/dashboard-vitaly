# Импорт Funko Pop из PDF «Funko Pops.pdf»

Источник: `scripts/data/funko/Funko-Pops.pdf` (копия личной таблицы).

## Страницы PDF

| Стр. | Категория |
|------|-----------|
| 1 | Сводка по категориям |
| 2 | Animation |
| 3 | Asia |
| 4 | Disney |
| 5 | Games |
| 6 | Gold |
| 7 | Harry Potter |
| 8 | Heroes |
| 9 | Marvel |
| 10 | Movies |
| 11 | Retro |
| 12 | Rocks |
| 13 | Sport |
| 14 | Soda |
| 15 | Star Wars |
| 16 | TV |
| 17 | Other (распределяется по категориям) |
| 18 | Game of Thrones |

## Правила импорта

| Условие в PDF | Поле в дашборде |
|---------------|-----------------|
| Галочка ✓ | **Есть** (`owned = true`) |
| Строка без галочки | **В пути** (`in_transit = true`) |
| Цифра **> 1** вместо ✓ | **Дубли** (`has_duplicates`, `quantity`) |
| «Особенности» | **Комментарий** (`notes`) |

## Команды

```bash
# 1. Пересобрать JSON из PDF
python3 scripts/extract-funko-pdf.py

# 2. Импорт всей коллекции (Animation — replace, остальные — merge с каталогом)
set -a && source .env && set +a && npm run import-funko-collection

# Одна категория:
npm run import-funko-collection -- disney
```

## Файлы

- `Funko-Pops.pdf` — эталонный PDF
- `collection-{slug}.json` — результат парсинга по категориям
- `{slug}.json` — справочник hobbydb для фото

## API

`POST /api/funko/import-collection` — `{ all: true }` или `{ categorySlug: "disney" }`
