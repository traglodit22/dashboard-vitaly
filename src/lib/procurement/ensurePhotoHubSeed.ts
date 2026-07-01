import { runCategorySeedOnce } from '@/lib/procurement/ensureProcurementSeedState'

const PHOTOHUB_CATEGORY = 'PhotoHub'

const PHOTOHUB_SEED_SQL = `
INSERT INTO procurement_categories (name, sort_order)
SELECT 'PhotoHub', 20
WHERE NOT EXISTS (SELECT 1 FROM procurement_categories WHERE name = 'PhotoHub');

INSERT INTO procurement_items (category_id, group_name, name, need_qty, have_qty, in_transit_qty, notes, link, row_type, sort_order)
SELECT c.id, v.group_name, v.name, v.need_qty, v.have_qty, v.in_transit_qty, v.notes, v.link, v.row_type, v.sort_order
FROM procurement_categories c
CROSS JOIN (VALUES
  (NULL::text, 'Homepod Mini', 60, 2, 13, 'Надо ~60?; подставки под колонки — 20 (10б + 10ч)', NULL::text, 'item', 10),
  (NULL::text, 'godox sl300 bi', 100, 0, 1, NULL::text, NULL::text, 'item', 20),
  (NULL::text, 'штатив 380', 100, 7, 0, NULL::text, NULL::text, 'item', 30),
  (NULL::text, 'соты', 100, 5, 0, NULL::text, NULL::text, 'item', 40),
  (NULL::text, 'колеса', 100, 0, 7, NULL::text, NULL::text, 'item', 50),
  (NULL::text, 'ЗАМКИ', 80, 1, 54, NULL::text, NULL::text, 'item', 60),
  (NULL::text, 'Хабы для замков', 10, 2, 10, 'Надо ~10?', NULL::text, 'item', 70),
  (NULL::text, 'Карточки', 300, 50, 200, NULL::text, NULL::text, 'item', 80),
  (NULL::text, 'Пылесосы', 9, 2, 5, 'Есть: 1 + 1?; куплено/едут: 5', NULL::text, 'item', 90)
) AS v(group_name, name, need_qty, have_qty, in_transit_qty, notes, link, row_type, sort_order)
WHERE c.name = 'PhotoHub';
`

export async function ensurePhotoHubProcurement(): Promise<void> {
  await runCategorySeedOnce(PHOTOHUB_CATEGORY, PHOTOHUB_SEED_SQL)
}
