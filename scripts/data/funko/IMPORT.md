# Импорт Funko Pop из PDF «Funko Pops.pdf»

Источник: `scripts/data/funko/Funko-Pops.pdf` (копия личной таблицы).

## Страницы PDF

| Стр. | Содержимое |
|------|------------|
| 1 | Сводка по категориям (Animation = 368 и т.д.) |
| 2 | **Animation** — полная таблица коллекции (368 строк) |
| 3+ | Другие категории (Disney, Marvel, …) — пока не импортируются |

## Колонки (стр. 2)

1. **Галочка / цифра** — статус владения
2. **Номер Pop** — `#` фигурки
3. **Подсерия** — Dragon Ball Z, Naruto, …
4. **Фигурка** — название
5. **Особенности** — вариант, эксклюзив, состояние (бу, цвет и т.д.)

## Правила импорта

| Условие в PDF | Поле в дашборде |
|---------------|-----------------|
| Галочка ✓ (на жёлтой строке) | **Есть** (`owned = true`) |
| Строка в таблице без галочки | **В пути** (`in_transit = true`) |
| Вместо ✓ цифра **> 1** | Метка **«есть дубли»** (`has_duplicates = true`, `quantity = цифра`) |
| Текст в «Особенности» | **Комментарий** (`notes`) |

Жёлтая подсветка строки = строки коллекции Animation (все 368). Галочка всегда на жёлтом фоне.

## Команды

```bash
# 1. Пересобрать JSON из PDF (после обновления файла)
python3 scripts/extract-funko-pdf.py
# или указать путь:
python3 scripts/extract-funko-pdf.py "/path/to/Funko Pops.pdf"

# 2. Импорт в БД (заменяет категорию Animation)
set -a && source .env && set +a && npm run import-funko-collection

# Полный каталог hobbydb (~1150 шт.) — отдельно:
npm run import-funko
```

## Файлы

- `Funko-Pops.pdf` — эталонный PDF
- `collection-animation.json` — результат парсинга стр. 2
- `animations.json` — справочник hobbydb для подстановки фото

## API

`POST /api/funko/import-collection` — импорт из `collection-animation.json` (replace).
