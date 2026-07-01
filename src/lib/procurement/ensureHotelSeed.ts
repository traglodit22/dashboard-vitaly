import { pool } from '@/lib/db/index'
import { ensureBesedkaProcurement } from '@/lib/procurement/ensureBesedkaSeed'
import { ensureKlubProcurement } from '@/lib/procurement/ensureKlubSeed'
import { ensurePhotoHubProcurement } from '@/lib/procurement/ensurePhotoHubSeed'

const PROCUREMENT_DDL = `
CREATE TABLE IF NOT EXISTS procurement_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID NOT NULL REFERENCES procurement_categories(id) ON DELETE CASCADE,
  group_name     TEXT,
  name           TEXT NOT NULL,
  need_qty       INTEGER NOT NULL DEFAULT 0,
  have_qty       INTEGER NOT NULL DEFAULT 0,
  in_transit_qty INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  link           TEXT,
  link_label     TEXT,
  image_mime     TEXT,
  image_updated_at TIMESTAMPTZ,
  highlight_color TEXT,
  row_type       TEXT NOT NULL DEFAULT 'item',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS procurement_items_category_idx
  ON procurement_items (category_id, sort_order);
`

const HOTEL_SEED_SQL = `
INSERT INTO procurement_categories (name, sort_order)
SELECT 'Отель', 0
WHERE NOT EXISTS (SELECT 1 FROM procurement_categories WHERE name = 'Отель');

INSERT INTO procurement_items (category_id, group_name, name, need_qty, have_qty, in_transit_qty, notes, link, sort_order)
SELECT c.id, v.group_name, v.name, v.need_qty, v.have_qty, v.in_transit_qty, v.notes, v.link, v.sort_order
FROM procurement_categories c
CROSS JOIN (VALUES
  ('Постельное и текстиль', 'Постельное полуторное', 100, 0, 10, NULL, NULL, 10),
  ('Постельное и текстиль', 'Постельное двуспальное', 100, 0, 0, NULL, NULL, 20),
  ('Постельное и текстиль', 'Доп. наволочки', 200, 0, 10, NULL, NULL, 30),
  ('Постельное и текстиль', 'Пододеяльники для зимы', 0, 0, 0, NULL, NULL, 40),
  ('Постельное и текстиль', 'Полотенца 40×80 cm, 180g', 200, 100, 0, NULL, NULL, 50),
  ('Постельное и текстиль', 'Полотенца 80×160 cm, 800g', 200, 100, 0, NULL, NULL, 60),
  ('Постельное и текстиль', 'Полотенца 30×30 cm, 60g', 200, 200, 0, NULL, NULL, 70),
  ('Постельное и текстиль', 'Полотенца на пол', 100, 0, 50, NULL, NULL, 80),
  ('Постельное и текстиль', 'Халат', 100, 0, 50, NULL, NULL, 90),
  ('Климат', 'Термостат отопления', 46, 2, 44, NULL, NULL, 100),
  ('Климат', 'Термостат фанкойла', 26, 0, 1, NULL, NULL, 110),
  ('Двери и мебель', 'Двери межкомнатные', 46, 0, 0, 'Ширина 600–900, глубина проёма 100–250, чёрный, запил сверху', 'https://дверная-линия.бел/flat/', 120),
  ('Двери и мебель', 'Ручки на тумбочки 96 мм', 76, 20, 0, 'Куплено 20; докупить 76', NULL, 130),
  ('Двери и мебель', 'Ручки на шкафы 128 мм', 122, 20, 0, 'Куплено 20; докупить 122', NULL, 140),
  ('Кухни и техника', 'Шкафы 1200 и 600 (высота 2700)', 18, 0, 0, 'EGGER H1385 или Kronospan K086 / K021', NULL, 195),
  ('Кухни и техника', 'Мини-кухни (тест)', 17, 0, 1, '954×620, высота 2700', NULL, 200),
  ('Кухни и техника', 'Мини-холодильники', 18, 0, 0, 'Учесть размер при проектировании кухонек', NULL, 210),
  ('Кухни и техника', 'Мини-плита (2 или 1 конфорка)', 18, 1, 6, 'НОРМ, везём', 'https://mobile.yangkeduo.com/goods.html?goods_id=621269375828', 220),
  ('Кухни и техника', 'Микроволновка', 18, 0, 0, 'Учесть размер кухонек', 'https://mobile.yangkeduo.com/goods.html?goods_id=694494721256', 230),
  ('Кухни и техника', 'Сейф', 18, 0, 1, 'Тест', 'https://item.taobao.com/item.htm?id=838174112211', 240),
  ('Кухни и техника', 'Чайник', 18, 0, 1, 'Не уверена насчёт реплики', 'https://mobile.yangkeduo.com/goods.html?goods_id=885933224799', 250),
  ('Кухни и техника', 'Кофемашина Xiaomi N1', 18, 0, 1, 'Зависит от капсул', 'https://mobile.yangkeduo.com/goods.html?goods_id=927161668071', 260),
  ('Электроника', 'ТВ OLED 4K 55"', 20, 1, 5, 'Тест', NULL, 300),
  ('Шторы и декор', 'Карнизы двойные 3 м', 26, 0, 22, '26 шт по 3 м', 'https://mobile.yangkeduo.com/goods2.html?goods_id=503815760614', 310),
  ('Шторы и декор', 'Шторы (пары)', 26, 0, 1, '3×2,8 м, белые/светло-серые', 'https://detail.1688.com/offer/994396755875.html', 320),
  ('Шторы и декор', 'Тюли', 26, 0, 3, '3×2,8 м, белые', 'https://detail.1688.com/offer/634000441443.html', 330),
  ('Шторы и декор', 'Пуф', 20, 0, 12, NULL, 'https://item.taobao.com/item.htm?id=850162161634', 340),
  ('Шторы и декор', 'Ковёр в гостиной 2×3 м', 6, 0, 1, 'Тест', 'https://mobile.yangkeduo.com/goods.html?goods_id=725049605668', 350),
  ('Шторы и декор', 'Столики журнальные', 6, 0, 1, '6 пар', 'https://mobile.yangkeduo.com/goods.html?goods_id=884231120691', 360),
  ('Мебель', 'Диваны', 6, 0, 0, 'Clarins 900, светло-серый', 'https://www.divan.by/product/divan-laronso-bucle-white', 400),
  ('Мебель', 'Стол (подстолье) D款', 13, 0, 6, '13 без постирочной', 'https://detail.1688.com/offer/926922923837.html', 410),
  ('Мебель', 'Столешница Ø900', 6, 0, 0, 'Slim Line K552 или K551', NULL, 420),
  ('Мебель', 'Столешница Ø700', 8, 0, 0, NULL, NULL, 430),
  ('Мебель', 'Стулья', 34, 0, 27, 'Светлое дерево; едут 24+3', 'https://detail.1688.com/offer/1040300912591.html', 440),
  ('Мебель', 'Большая ваза на стол', 14, 0, 2, NULL, 'https://mobile.yangkeduo.com/goods.html?goods_id=719796441876', 450),
  ('Мебель', 'Табуретки', 3, 0, 0, 'Для коридора', 'https://mobile.yangkeduo.com/goods.html?goods_id=785165853840', 460),
  ('Мебель', 'Держатель для салфеток', 18, 0, 3, 'Декор', 'https://mobile.yangkeduo.com/goods.html?goods_id=764550791386', 470),
  ('Мебель', 'Скульптура (камни)', 12, 0, 2, 'Лунные камни', 'https://detail.1688.com/offer/979580639975.html', 480),
  ('Мебель', 'Скульптура доп. (чёрная, крупная)', 2, 0, 0, 'Для разнообразия', 'https://detail.1688.com/offer/776230784645.html', 485),
  ('Мебель', 'Свет над скульптурой', 12, 0, 12, NULL, 'https://mobile.yangkeduo.com/goods2.html?goods_id=928028488748', 490),
  ('Спальня', 'Кровать 800 (одинарная)', 24, 2, 0, '20 + 4 уборщ', NULL, 500),
  ('Спальня', 'Кровать 1600 (двойная)', 8, 0, 0, NULL, NULL, 510),
  ('Спальня', 'Матрасы (комплекты)', 40, 0, 0, '20 комплектов', NULL, 520),
  ('Спальня', 'Изголовье', 40, 0, 0, 'Заказали на тест', 'https://mobile.yangkeduo.com/goods.html?goods_id=650221934775', 530),
  ('Спальня', 'Направляющая для изголовья', 40, 0, 0, 'Латунные трубки', NULL, 535),
  ('Спальня', 'Столики для еды в кровати', 16, 0, 1, 'Белые, круглые', 'https://detail.1688.com/offer/1044359877730.html', 540),
  ('Спальня', 'Зеркало 80×180', 18, 0, 0, '17 без постирочной', 'https://detail.1688.com/offer/861933269998.html', 550),
  ('Спальня', 'Прикроватные коврики 70×150', 38, 0, 1, NULL, 'https://mobile.yangkeduo.com/goods.html?goods_id=905217390897', 560),
  ('Спальня', 'Ножки для тумбочек', 150, 0, 0, NULL, NULL, 565),
  ('Спальня', 'Тумбочки', 36, 18, 0, NULL, NULL, 570),
  ('Спальня', 'Торшер', 46, 0, 0, NULL, 'https://detail.1688.com/offer/553251502242.html', 580),
  ('Санузел', 'Умывальник (склад 4)', 4, 0, 0, NULL, NULL, 600),
  ('Санузел', 'Умывальник (склад 14)', 14, 0, 0, NULL, NULL, 610),
  ('Санузел', 'Смеситель низкий', 4, 0, 4, NULL, NULL, 620),
  ('Санузел', 'Смеситель высокий', 14, 0, 8, NULL, NULL, 630),
  ('Санузел', 'Душевая лейка', 18, 0, 0, 'Склад', NULL, 640),
  ('Санузел', 'Унитаз', 18, 0, 0, 'Склад', NULL, 650),
  ('Санузел', 'Гигиенический душ', 18, 0, 0, 'Установлены', NULL, 660),
  ('Санузел', 'Душевой трап', 18, 0, 0, NULL, NULL, 670),
  ('Санузел', 'Душевые карнизы', 18, 16, 2, NULL, NULL, 680),
  ('Санузел', 'Фен', 18, 0, 1, '2 разных на тест', NULL, 690),
  ('Санузел', 'Шторка в душевую 2,5×2,2', 18, 0, 0, 'Можно в два слоя', 'https://detail.1688.com/offer/726226856989.html', 700),
  ('Санузел', 'Зеркало в ванной', 18, 0, 0, NULL, 'https://mobile.yangkeduo.com/goods.html?goods_id=897173787191', 710),
  ('Санузел', 'Держатель для полотенец', 18, 0, 0, 'Тест', NULL, 720),
  ('Санузел', 'Крючки для полотенец', 18, 0, 0, 'Мин. 6 шт в ванной', NULL, 730),
  ('Санузел', 'Держатели туал. бумаги', 18, 0, 0, 'Тест', NULL, 740),
  ('Санузел', 'Ёршики', 18, 0, 0, 'Тест', NULL, 750),
  ('Санузел', 'Полочки для шампуней', 36, 0, 0, '36 в душевых + 8 в санузлах', NULL, 760),
  ('Санузел', 'Баночки для мыла/шампуня', 16, 0, 16, NULL, NULL, 770),
  ('Электрика', 'Розетки и выключатели', 0, 0, 0, 'На пробу', 'https://detail.1688.com/offer/1021381992785.html', 780),
  ('Освещение', 'Трековые светильники', 16, 0, 16, '14 + 2 на лестнице', NULL, 800),
  ('Освещение', 'Бра у дверей в комнаты', 18, 0, 0, 'CountryBlue print', NULL, 810),
  ('Освещение', 'Потолочный светильник 500 мм (наклонный, тип B)', 14, 0, 0, 'Склад', NULL, 820),
  ('Освещение', 'Потолочный светильник 350 мм (наклонный, тип B)', 14, 0, 0, 'Склад', NULL, 830),
  ('Освещение', 'Свет на лестнице', 4, 0, 0, 'Склад', NULL, 840),
  ('Освещение', 'Люстра', 26, 0, 0, 'Склад', NULL, 850),
  ('Освещение', 'Люстра над зеркалом', 4, 0, 0, 'Склад', NULL, 860),
  ('Коридор', 'Кресла на коридоре', 8, 0, 0, NULL, 'https://detail.1688.com/offer/813117140812.html', 900),
  ('Коридор', 'Диванчик на коридоре', 1, 0, 0, NULL, 'https://www.divan.by/product/kushetka-olten-textile-forest', 910),
  ('Коридор', 'Растения в горшках (оливки)', 12, 0, 0, 'Повыше, разные', 'https://detail.1688.com/offer/657764402749.html', 920),
  ('Коридор', 'Горшки', 12, 0, 0, NULL, 'https://mobile.yangkeduo.com/goods1.html?goods_id=869297501574', 930),
  ('Декор', 'Декоративный молдинг на потолке', 200, 0, 0, '≈200 м', 'https://www.21vek.by/mouldings/cx106_orac_decor.html', 950),
  ('Декор', 'Зеркало 1200 (с ¼ луной)', 4, 0, 0, NULL, 'https://www.21vek.by/mirrors/120_belux_08.html', 960),
  ('Декор', 'Зеркало 1200 (без луны)', 4, 0, 0, NULL, 'https://www.21vek.by/mirrors/120_belux_08.html', 970)
) AS v(group_name, name, need_qty, have_qty, in_transit_qty, notes, link, sort_order)
WHERE c.name = 'Отель';
`

import { ensureAllCategoryStatuses } from '@/lib/procurement/ensureProcurementStatuses'
import { backfillProcurementStores } from '@/lib/procurement/ensureProcurementStore'
import {
  backfillProcurementSeedState,
  runCategorySeedOnce,
} from '@/lib/procurement/ensureProcurementSeedState'

const HOTEL_CATEGORY = 'Отель'

/** Схема и справочники — безопасно на каждом запросе к API закупок. */
export async function ensureProcurementReady(): Promise<void> {
  await ensureProcurementSchema()
  await ensureAllCategoryStatuses()
  await backfillProcurementStores()
  await backfillProcurementSeedState()
}

/** Схема + одноразовый seed пустых категорий (только при старте / migrate-db). */
export async function ensureHotelProcurement(): Promise<void> {
  await ensureProcurementReady()
  await ensureHotelSeedOnly()
  await ensureBesedkaProcurement()
  await ensurePhotoHubProcurement()
  await ensureKlubProcurement()
}

async function ensureProcurementSchema(): Promise<void> {
  await pool.query(PROCUREMENT_DDL)
  await pool.query(
    'ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS highlight_color TEXT',
  )
  await pool.query(
    "ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS row_type TEXT NOT NULL DEFAULT 'item'",
  )
  await pool.query(
    "UPDATE procurement_items SET row_type = 'item' WHERE row_type IS NULL",
  )
  await pool.query(
    'ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS link_label TEXT',
  )
  await pool.query(
    'ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS image_mime TEXT',
  )
  await pool.query(
    'ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMPTZ',
  )
  await pool.query('ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS store TEXT')
}

async function ensureHotelSeedOnly(): Promise<void> {
  await runCategorySeedOnce(HOTEL_CATEGORY, HOTEL_SEED_SQL)
}
