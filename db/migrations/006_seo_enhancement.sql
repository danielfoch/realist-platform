-- Migration 006: SEO Content Enhancement
-- Adds category filtering and featured posts functionality

-- Add indexes for better performance on content queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_guides_featured ON guides(featured) WHERE featured = true;

-- Add tags column to blog_posts if it doesn't exist (for compatibility)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add search vector for full-text search (optional enhancement)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
CREATE INDEX IF NOT EXISTS idx_blog_posts_search ON blog_posts USING GIN(search_vector);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_blog_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.excerpt, '') || ' ' || COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update search vector
DROP TRIGGER IF EXISTS blog_posts_search_vector_trigger ON blog_posts;
CREATE TRIGGER blog_posts_search_vector_trigger
BEFORE INSERT OR UPDATE ON blog_posts
FOR EACH ROW EXECUTE FUNCTION update_blog_search_vector();

-- Update existing posts with search vectors
UPDATE blog_posts SET search_vector = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(content, '')) WHERE search_vector IS NULL;

-- Similar for guides
ALTER TABLE guides ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
CREATE INDEX IF NOT EXISTS idx_guides_search ON guides USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_guide_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.excerpt, '') || ' ' || COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guides_search_vector_trigger ON guides;
CREATE TRIGGER guides_search_vector_trigger
BEFORE INSERT OR UPDATE ON guides
FOR EACH ROW EXECUTE FUNCTION update_guide_search_vector();

UPDATE guides SET search_vector = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(content, '')) WHERE search_vector IS NULL;

-- Add view for content dashboard
CREATE OR REPLACE VIEW content_stats AS
SELECT 
  'blog' as content_type,
  COUNT(*) as total_posts,
  COUNT(*) FILTER (WHERE status = 'published') as published,
  COUNT(*) FILTER (WHERE featured = true) as featured,
  MAX(published_at) as latest_published
FROM blog_posts
UNION ALL
SELECT 
  'guide' as content_type,
  COUNT(*) as total_posts,
  COUNT(*) FILTER (WHERE status = 'published') as published,
  COUNT(*) FILTER (WHERE featured = true) as featured,
  MAX(published_at) as latest_published
FROM guides;