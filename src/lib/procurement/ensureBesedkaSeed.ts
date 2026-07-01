import { runCategorySeedOnce } from '@/lib/procurement/ensureProcurementSeedState'

const BESEDKA_CATEGORY = 'Беседки'

const BESEDKA_SEED_SQL = `
INSERT INTO procurement_categories (name, sort_order)
SELECT 'Беседки', 10
WHERE NOT EXISTS (SELECT 1 FROM procurement_categories WHERE name = 'Беседки');

INSERT INTO procurement_items (category_id, group_name, name, need_qty, have_qty, in_transit_qty, notes, link, row_type, sort_order)
SELECT c.id, v.group_name, v.name, v.need_qty, v.have_qty, v.in_transit_qty, v.notes, v.link, v.row_type, v.sort_order
FROM procurement_categories c
CROSS JOIN (VALUES
  (NULL::text, 'Освещение', 0, 0, 0, NULL::text, NULL::text, 'type', 10),
  (NULL::text, 'Светильники шары', 0, 0, 0, 'По всей территории, так что их надо будет много', 'https://detail.1688.com/offer/730051065326.html', 'item', 20),
  (NULL::text, 'Уличные светильники', 0, 0, 0, 'Уже взяли на пробу разных', 'https://detail.1688.com/offer/1046391438208.html', 'item', 30),
  (NULL::text, 'Ландшафт', 0, 0, 0, NULL::text, NULL::text, 'type', 40),
  (NULL::text, 'Камни как декор', 0, 0, 0, 'Более мелкие — машинами, крупные по кг; без пометки «ландшафтные». Альт: https://kamnegrad.by/katalog/kamen-dlya-landshafta/landshaftnye-valuny-i-glyby', 'https://pesok-dostavim-minsk.by/g11359812-butovyj-kamen', 'item', 50),
  (NULL::text, 'Дорожка из пошаговых плит', 0, 0, 0, 'Небольшого размера, примерно 600×300', 'https://lansi.by/p208833901-plita-ploskaya-poshagovaya.html', 'item', 60),
  (NULL::text, 'Гравий', 0, 0, 0, 'На засыпку вокруг, покрупнее', 'https://pesok-dostavim-minsk.by/p61223174-gravij-seyannyjmytyj-dostavkoj.html', 'item', 70),
  (NULL::text, 'Текстиль', 0, 0, 0, NULL::text, NULL::text, 'type', 80),
  (NULL::text, 'Шторы уличные', 15, 0, 0, 'Высота 2600, ширина 2 м; по 5 шт на беседку. Без встроенных колец. Альт: https://detail.1688.com/offer/844442218876.html, https://detail.tmall.com/item.htm?id=964006438741, https://detail.1688.com/offer/790648092249.html, https://detail.1688.com/offer/789375033439.html, https://detail.1688.com/offer/628620600600.html', 'https://detail.1688.com/offer/925251512511.html', 'item', 90),
  (NULL::text, 'Мебель', 0, 0, 0, NULL::text, NULL::text, 'type', 100),
  (NULL::text, 'Люстра над столом', 9, 0, 0, '50×40; по 3 на каждую беседку', 'https://detail.1688.com/offer/753105626077.html', 'item', 110),
  (NULL::text, 'Стол', 3, 0, 0, 'Длина 160; можно доп. маленькие для больших компаний', 'https://detail.1688.com/offer/896573899542.html', 'item', 120),
  (NULL::text, 'Стулья', 24, 0, 0, 'По 8 шт на беседку; отдельно +52 шт для отеля', NULL::text, 'item', 130),
  (NULL::text, 'Столики для отеля', 15, 0, 0, 'В чёрном цвете', 'https://detail.1688.com/offer/1052993272409.html', 'item', 140),
  (NULL::text, 'Кресло', 3, 0, 0, 'Чёрное 80×58×60', 'https://detail.1688.com/offer/1051002451428.html', 'item', 150),
  (NULL::text, 'Кухня', 3, 0, 0, NULL::text, 'https://item.taobao.com/item.htm?id=1056962750047', 'item', 160),
  (NULL::text, 'Полка над кухней', 3, 0, 0, 'ЛДСП или дерево; крепления верхние, незаметные. Длина 1700, глубина 250', NULL::text, 'item', 170),
  (NULL::text, 'Светильники над кухней', 24, 0, 0, 'Блестящий 20–22; по 8 шт на каждую беседку', 'https://detail.1688.com/offer/889098045742.html', 'item', 180),
  (NULL::text, 'Вазы на столе', 9, 0, 0, 'По 3 на беседку. Альт: https://detail.1688.com/offer/1037327695790.html, https://detail.1688.com/offer/1058674892232.html', 'https://detail.1688.com/offer/811098675205.html', 'item', 190),
  (NULL::text, 'Декор и техника', 0, 0, 0, NULL::text, NULL::text, 'type', 200),
  (NULL::text, 'Подсветка фасадов', 12, 0, 0, '4 шт на каждую беседку', 'https://detail.1688.com/offer/580516286901.html', 'item', 210),
  (NULL::text, 'Охладитель напитков', 3, 0, 0, 'Ледогенератор в здании + ёмкости. Альт: https://detail.1688.com/offer/634035434312.html', 'https://detail.1688.com/offer/951689850852.html', 'item', 220),
  (NULL::text, 'Декор на столе', 0, 0, 0, NULL::text, NULL::text, 'item', 230),
  (NULL::text, 'Строительство', 0, 0, 0, NULL::text, NULL::text, 'type', 240),
  (NULL::text, 'Стены', 0, 0, 0, 'Блок шириной 200 и длиной 500; под них делали размеры', NULL::text, 'item', 250),
  (NULL::text, 'Штукатурка стен', 0, 0, 0, 'Бетонный эффект, не шершавая — максимально гладкая', NULL::text, 'item', 260),
  (NULL::text, 'Бруски', 0, 0, 0, '80×80 и 100×100 — конструктивные и декоративные элементы', NULL::text, 'item', 270),
  (NULL::text, 'Потолок', 0, 0, 0, 'Как стены', NULL::text, 'item', 280),
  (NULL::text, 'Крыша', 0, 0, 0, 'Не видна снаружи; главное — влага при небольшом уклоне', NULL::text, 'item', 290),
  (NULL::text, 'Торцевая планка кровли', 0, 0, 0, 'Готовые высотой 350 мм или сборная', NULL::text, 'item', 300),
  (NULL::text, 'Террасная доска', 0, 0, 0, 'Лучше натуральное дерево, можно пластик', NULL::text, 'item', 310),
  (NULL::text, 'Плитка на фартуке', 21, 0, 0, 'Кратер K-2212, 21 м² без запаса (≈6,8 м² на одну)', NULL::text, 'item', 320)
) AS v(group_name, name, need_qty, have_qty, in_transit_qty, notes, link, row_type, sort_order)
WHERE c.name = 'Беседки';
`

/** Заливает категорию «Беседки» из ведомости PDF — один раз, если пусто. */
export async function ensureBesedkaProcurement(): Promise<void> {
  await runCategorySeedOnce(BESEDKA_CATEGORY, BESEDKA_SEED_SQL)
}
