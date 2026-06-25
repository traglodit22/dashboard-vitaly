/** Описание линейки Funko Pop для импорта и UI. */
export interface FunkoCategoryDef {
  slug: string
  /** Полное имя в БД. */
  name: string
  /** Подпись в боковой панели. */
  shortLabel: string
  /** Фильтр(ы) поля series в funko_pop.csv; null — нет данных в датасете. */
  seriesFilter: string | string[] | null
  catalogFile: string
}

function def(
  slug: string,
  name: string,
  shortLabel: string,
  seriesFilter: string | string[] | null,
  catalogFile = `${slug}.json`,
): FunkoCategoryDef {
  return { slug, name, shortLabel, seriesFilter, catalogFile }
}

const RAW_FUNKO_CATEGORY_DEFS: FunkoCategoryDef[] = [
  def('8-bit', 'Pop! 8-Bit', '8-Bit', 'Pop! 8-Bit'),
  def('ad-icons', 'Pop! Ad Icons', 'Ad Icons', 'Pop! Ad Icons'),
  def('album', 'Pop! Albums', 'Album', 'Pop! Albums'),
  def('animation', 'Pop! Animation', 'Animation', 'Pop! Animation', 'animations.json'),
  def('art', 'Pop! Art', 'Art', ['Pop! Art Series', 'Pop! Artists']),
  def('asia', 'Pop! Asia', 'Asia', 'Pop! Asia'),
  def('basketball', 'Pop! Basketball', 'Basketball', 'Pop! Basketball'),
  def('books', 'Pop! Books', 'Books', 'Pop! Books'),
  def('boxing', 'Pop! Boxing', 'Boxing', null),
  def('broadway', 'Pop! Broadway', 'Broadway', null),
  def('comedians', 'Pop! Comedians', 'Comedians', 'Pop! Comedians'),
  def('comic-covers', 'Pop! Comic Covers', 'Comic Covers', null),
  def('comics', 'Pop! Comics', 'Comics', 'Pop! Comics'),
  def('directors', 'Pop! Directors', 'Directors', 'Pop! Directors'),
  def('disney', 'Pop! Disney', 'Disney', 'Pop! Disney'),
  def('drag-queens', 'Pop! Drag Queens', 'Drag Queens', 'Pop! Drag Queens'),
  def('football', 'Pop! Football', 'Football', 'Pop! Football'),
  def('game-of-thrones', 'Pop! Game of Thrones', 'Game of Thrones', 'Pop! Game Of Thrones'),
  def('games', 'Pop! Games', 'Games', 'Pop! Games'),
  def('gold', 'Pop! Gold', 'Gold', null),
  def('halo', 'Pop! Halo', 'Halo', 'Pop! Halo'),
  def('harry-potter', 'Pop! Harry Potter', 'Harry Potter', 'Pop! Harry Potter'),
  def('heroes', 'Pop! Heroes', 'Heroes', 'Pop! Heroes'),
  def('hockey', 'Pop! Hockey', 'Hockey', 'Pop! Hockey'),
  def('house-of-the-dragon', 'Pop! House of the Dragon', 'House of the Dragon', null),
  def('icons', 'Pop! Icons', 'Icons', 'Pop! Icons'),
  def('marvel', 'Pop! Marvel', 'Marvel', 'Pop! Marvel'),
  def('mlb', 'Pop! MLB', 'MLB', 'Pop! MLB'),
  def('movies', 'Pop! Movies', 'Movies', 'Pop! Movies'),
  def('muppets', 'Pop! Muppets', 'Muppets', 'Pop! Muppets'),
  def('myths', 'Pop! Myths', 'Myths', 'Pop! Myths'),
  def('nba-mascots', 'Pop! NBA Mascots', 'NBA Mascots', null),
  def('nooks', 'Pop! Nooks', 'Nooks', null),
  def('pets', 'Pop! Pets', 'Pets', 'Pop! Pets'),
  def('racing', 'Pop! Racing', 'Racing', null),
  def('retro', 'Pop! Retro', 'Retro', 'Pop! Retro Toys', 'retro.json'),
  def('rides', 'Pop! Rides', 'Rides', 'Pop! Rides'),
  def('rocks', 'Pop! Rocks', 'Rocks', 'Pop! Rocks'),
  def('royals', 'Pop! Royals', 'Royals', 'Pop! Royals'),
  def('sci-fi', 'Pop! Sci-Fi', 'Sci-Fi', 'Pop! Sci-Fi'),
  def('sesame-street', 'Pop! Sesame Street', 'Sesame Street', 'Pop! Sesame Street'),
  def('snl', 'Pop! SNL', 'SNL', 'Pop! SNL'),
  def('soda', 'Pop! Soda', 'Soda', 'Soda Figures', 'soda.json'),
  def('south-park', 'Pop! South Park', 'South Park', 'Pop! South Park'),
  def('sports-legends', 'Pop! Sports Legends', 'Sports Legends', 'Pop! Sports Legends'),
  def('starwars', 'Pop! Star Wars', 'StarWars', 'Pop! Star Wars'),
  def('tv', 'Pop! Television', 'TV', 'Pop! Television'),
  def('tennis', 'Pop! Tennis', 'Tennis', 'Pop! Tennis'),
  def('tokidoki', 'Pop! Tokidoki', 'Tokidoki', null),
  def('ufc', 'Pop! UFC', 'UFC', 'Pop! UFC'),
  def('vhs-covers', 'Pop! VHS Covers', 'VHS Covers', null),
  def('wwe', 'Pop! WWE', 'WWE', 'Pop! WWE'),
]

/** Категории по алфавиту (shortLabel). */
export const FUNKO_CATEGORY_DEFS: FunkoCategoryDef[] = [...RAW_FUNKO_CATEGORY_DEFS].sort((a, b) =>
  a.shortLabel.localeCompare(b.shortLabel, 'en', { sensitivity: 'base' }),
)

export const DEFAULT_FUNKO_CATEGORY_SLUG = 'animation'

/** Виртуальная категория: все фигурки без фильтра по линейке. */
export const ALL_FUNKO_CATEGORY_SLUG = 'all'

export function isAllFunkoCategorySlug(slug: string): boolean {
  return slug === ALL_FUNKO_CATEGORY_SLUG
}

export function getFunkoCategoryDisplayName(slug: string): string {
  if (isAllFunkoCategorySlug(slug)) return 'Все категории'
  return getCategoryDef(slug)?.name ?? 'Pop! Animation'
}

/** Порядок категорий по умолчанию (до пользовательской сортировки). */
export const DEFAULT_FUNKO_CATEGORY_ORDER = FUNKO_CATEGORY_DEFS.map((d) => d.slug)

const bySlug = new Map(FUNKO_CATEGORY_DEFS.map((d) => [d.slug, d]))

export function getCategoryDef(slug: string): FunkoCategoryDef | undefined {
  return bySlug.get(slug)
}

export function getCategorySeriesLabel(slug: string): string {
  return getCategoryDef(slug)?.name ?? 'Pop! Animation'
}

export function categorySeriesFilters(def: FunkoCategoryDef): string[] {
  if (!def.seriesFilter) return []
  return Array.isArray(def.seriesFilter) ? def.seriesFilter : [def.seriesFilter]
}

export function hasCatalogSource(def: FunkoCategoryDef): boolean {
  return categorySeriesFilters(def).length > 0
}
