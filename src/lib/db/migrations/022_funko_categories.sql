INSERT INTO funko_categories (slug, name, sort_order)
SELECT v.slug, v.name, v.sort_order
FROM (VALUES
  ('asia', 'Pop! Asia', 20),
  ('disney', 'Pop! Disney', 30),
  ('games', 'Pop! Games', 40),
  ('gold', 'Pop! Gold', 50),
  ('harry-potter', 'Pop! Harry Potter', 60),
  ('heroes', 'Pop! Heroes', 70),
  ('marvel', 'Pop! Marvel', 80),
  ('movies', 'Pop! Movies', 90),
  ('retro', 'Pop! Retro', 100),
  ('rocks', 'Pop! Rocks', 110),
  ('sport', 'Pop! Sport', 120),
  ('soda', 'Pop! Soda', 130),
  ('starwars', 'Pop! Star Wars', 140)
) AS v(slug, name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM funko_categories c WHERE c.slug = v.slug
);
