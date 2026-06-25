INSERT INTO funko_categories (slug, name, sort_order)
SELECT v.slug, v.name, v.sort_order
FROM (VALUES
  ('game-of-thrones', 'Pop! Game of Thrones', 150),
  ('tv', 'Pop! Television', 160),
  ('house-of-the-dragon', 'Pop! House of the Dragon', 170),
  ('8-bit', 'Pop! 8-Bit', 180),
  ('album', 'Pop! Albums', 190),
  ('art', 'Pop! Art', 200),
  ('books', 'Pop! Books', 210),
  ('broadway', 'Pop! Broadway', 220),
  ('comedians', 'Pop! Comedians', 230),
  ('comic-covers', 'Pop! Comic Covers', 240),
  ('comics', 'Pop! Comics', 250),
  ('directors', 'Pop! Directors', 260),
  ('icons', 'Pop! Icons', 270),
  ('ad-icons', 'Pop! Ad Icons', 280),
  ('drag-queens', 'Pop! Drag Queens', 290),
  ('halo', 'Pop! Halo', 300),
  ('muppets', 'Pop! Muppets', 310),
  ('myths', 'Pop! Myths', 320),
  ('nooks', 'Pop! Nooks', 330),
  ('pets', 'Pop! Pets', 340),
  ('racing', 'Pop! Racing', 350),
  ('rides', 'Pop! Rides', 360),
  ('royals', 'Pop! Royals', 370),
  ('sesame-street', 'Pop! Sesame Street', 380),
  ('sci-fi', 'Pop! Sci-Fi', 390),
  ('south-park', 'Pop! South Park', 400),
  ('tokidoki', 'Pop! Tokidoki', 410),
  ('vhs-covers', 'Pop! VHS Covers', 420)
) AS v(slug, name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM funko_categories c WHERE c.slug = v.slug
);
