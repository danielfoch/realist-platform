-- Migration 009: Normalize guides categories to SEO-approved taxonomy
-- Required categories: Analysis, Markets, Tax & Legal, Financing

UPDATE guides
SET category = CASE
  WHEN LOWER(TRIM(category)) = 'analysis' THEN 'Analysis'
  WHEN LOWER(TRIM(category)) = 'markets' THEN 'Markets'
  WHEN LOWER(TRIM(category)) IN ('tax-legal', 'tax & legal', 'tax and legal') THEN 'Tax & Legal'
  WHEN LOWER(TRIM(category)) = 'financing' THEN 'Financing'
  ELSE category
END
WHERE category IS NOT NULL;

ALTER TABLE guides
  DROP CONSTRAINT IF EXISTS guides_category_check;

ALTER TABLE guides
  ADD CONSTRAINT guides_category_check
  CHECK (category IS NULL OR category IN ('Analysis', 'Markets', 'Tax & Legal', 'Financing'));
