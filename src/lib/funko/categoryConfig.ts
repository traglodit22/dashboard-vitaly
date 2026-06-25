/** Описание линейки Funko Pop для импорта и UI. */
export interface FunkoCategoryDef {
  slug: string
  /** Полное имя в БД, совпадает с меткой серии в CSV. */
  name: string
  /** Короткая подпись во вкладках. */
  shortLabel: string
  /** Фильтр поля series в funko_pop.csv; null — нет данных в датасете. */
  seriesFilter: string | null
  catalogFile: string
  sortOrder: number
}

export const FUNKO_CATEGORY_DEFS: FunkoCategoryDef[] = [
  {
    slug: 'animation',
    name: 'Pop! Animation',
    shortLabel: 'Animation',
    seriesFilter: 'Pop! Animation',
    catalogFile: 'animations.json',
    sortOrder: 10,
  },
  {
    slug: 'asia',
    name: 'Pop! Asia',
    shortLabel: 'Asia',
    seriesFilter: 'Pop! Asia',
    catalogFile: 'asia.json',
    sortOrder: 20,
  },
  {
    slug: 'disney',
    name: 'Pop! Disney',
    shortLabel: 'Disney',
    seriesFilter: 'Pop! Disney',
    catalogFile: 'disney.json',
    sortOrder: 30,
  },
  {
    slug: 'games',
    name: 'Pop! Games',
    shortLabel: 'Games',
    seriesFilter: 'Pop! Games',
    catalogFile: 'games.json',
    sortOrder: 40,
  },
  {
    slug: 'gold',
    name: 'Pop! Gold',
    shortLabel: 'Gold',
    seriesFilter: null,
    catalogFile: 'gold.json',
    sortOrder: 50,
  },
  {
    slug: 'harry-potter',
    name: 'Pop! Harry Potter',
    shortLabel: 'Harry Potter',
    seriesFilter: 'Pop! Harry Potter',
    catalogFile: 'harry-potter.json',
    sortOrder: 60,
  },
  {
    slug: 'heroes',
    name: 'Pop! Heroes',
    shortLabel: 'Heroes',
    seriesFilter: 'Pop! Heroes',
    catalogFile: 'heroes.json',
    sortOrder: 70,
  },
  {
    slug: 'marvel',
    name: 'Pop! Marvel',
    shortLabel: 'Marvel',
    seriesFilter: 'Pop! Marvel',
    catalogFile: 'marvel.json',
    sortOrder: 80,
  },
  {
    slug: 'movies',
    name: 'Pop! Movies',
    shortLabel: 'Movies',
    seriesFilter: 'Pop! Movies',
    catalogFile: 'movies.json',
    sortOrder: 90,
  },
  {
    slug: 'retro',
    name: 'Pop! Retro',
    shortLabel: 'Retro',
    seriesFilter: 'Pop! Retro Toys',
    catalogFile: 'retro.json',
    sortOrder: 100,
  },
  {
    slug: 'rocks',
    name: 'Pop! Rocks',
    shortLabel: 'Rocks',
    seriesFilter: 'Pop! Rocks',
    catalogFile: 'rocks.json',
    sortOrder: 110,
  },
  {
    slug: 'sport',
    name: 'Pop! Sport',
    shortLabel: 'Sport',
    seriesFilter: 'Pop! Sports',
    catalogFile: 'sport.json',
    sortOrder: 120,
  },
  {
    slug: 'soda',
    name: 'Pop! Soda',
    shortLabel: 'Soda',
    seriesFilter: 'Soda Figures',
    catalogFile: 'soda.json',
    sortOrder: 130,
  },
  {
    slug: 'starwars',
    name: 'Pop! Star Wars',
    shortLabel: 'StarWars',
    seriesFilter: 'Pop! Star Wars',
    catalogFile: 'starwars.json',
    sortOrder: 140,
  },
]

export const DEFAULT_FUNKO_CATEGORY_SLUG = 'animation'

const bySlug = new Map(FUNKO_CATEGORY_DEFS.map((d) => [d.slug, d]))

export function getCategoryDef(slug: string): FunkoCategoryDef | undefined {
  return bySlug.get(slug)
}

export function getCategorySeriesLabel(slug: string): string {
  return getCategoryDef(slug)?.name ?? 'Pop! Animation'
}
