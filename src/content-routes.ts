/**
 * Express API routes for SEO Content (Blog Posts & Guides)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { QueryResultRow } from 'pg';
import { db as defaultDb } from './db';
import { isDemoMode, getDemoBlogPosts, getDemoBlogPostBySlug, demoGuides, demoBlogPosts } from './demo-data';

// API key authentication middleware
const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  // In demo mode, allow all requests
  if (isDemoMode()) {
    return next();
  }
  
  // Check if API key matches the rent API key (or a dedicated content API key)
  const validApiKey = process.env.CONTENT_API_KEY || process.env.RENT_API_KEY;
  
  if (!validApiKey) {
    console.warn('No CONTENT_API_KEY or RENT_API_KEY set in environment');
    return res.status(401).json({ success: false, error: 'API key not configured' });
  }
  
  if (apiKey !== validApiKey) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }
  
  next();
};

interface DatabaseAdapter {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]) => Promise<{ rows: T[] }>;
}

export function createContentRouter(database: DatabaseAdapter = defaultDb): Router {
  const router = Router();

  const GUIDE_CATEGORIES = ['Analysis', 'Markets', 'Tax & Legal', 'Financing'] as const;
  const normalizeGuideCategory = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    const map: Record<string, string> = {
      analysis: 'Analysis',
      markets: 'Markets',
      'tax & legal': 'Tax & Legal',
      'tax-legal': 'Tax & Legal',
      'tax and legal': 'Tax & Legal',
      financing: 'Financing',
    };
    return map[normalized] ?? null;
  };

  // ==================== BLOG POSTS ====================
  
  // GET /api/blog - List all published blog posts
  router.get('/blog', async (req: Request, res: Response) => {
    try {
      const { category, limit = 10, offset = 0 } = req.query;
      
      // Demo mode - return demo blog posts
      if (isDemoMode()) {
        let posts = getDemoBlogPosts();
        if (category) {
          posts = posts.filter(p => p.category === category);
        }
        const start = Number(offset);
        const end = start + Number(limit);
        return res.json({
          success: true,
          data: posts.slice(start, end),
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: posts.length
          }
        });
      }
      
      let query = `
        SELECT id, title, slug, excerpt, featured_image, author, published_at, 
               category, tags, meta_title, meta_description, view_count, featured
        FROM blog_posts 
        WHERE status = 'published'
      `;
      
      const params: unknown[] = [];
      
      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }
      
      query += ` ORDER BY published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(Number(limit), Number(offset));
      
      const result = await database.query(query, params);
      
      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch blog posts' });
    }
  });

  // GET /api/blog/:slug - Get single blog post by slug
  router.get('/blog/:slug', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Demo mode - return demo blog post
      if (isDemoMode()) {
        const post = getDemoBlogPostBySlug(slug);
        if (!post) {
          return res.status(404).json({ success: false, error: 'Blog post not found' });
        }
        return res.json({
          success: true,
          data: post
        });
      }
      
      // First get the post
      const result = await database.query(
        `SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published'`,
        [slug]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Blog post not found' });
      }
      
      const post = result.rows[0];
      
      // Increment view count
      await database.query(
        `UPDATE blog_posts SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
        [post.id]
      );
      
      // Update post with incremented view count
      post.view_count = (post.view_count || 0) + 1;
      
      res.json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Error fetching blog post:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch blog post' });
    }
  });

  // POST /api/blog - Create new blog post (admin only)
  router.post('/blog', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { 
        title, slug, excerpt, content, featured_image, author,
        meta_title, meta_description, canonical_url,
        status, category, tags, featured
      } = req.body;
      
      if (!title || !slug || !content) {
        return res.status(400).json({ 
          success: false, 
          error: 'Title, slug, and content are required' 
        });
      }
      const result = await database.query(
        `INSERT INTO blog_posts 
         (title, slug, excerpt, content, featured_image, author, meta_title, meta_description, canonical_url, status, category, tags, featured, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          title, slug, excerpt, content, featured_image, author,
          meta_title, meta_description, canonical_url,
          status || 'draft', category, tags, featured || false,
          status === 'published' ? new Date() : null
        ]
      );
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: unknown) {
      console.error('Error creating blog post:', error);
      if (error instanceof Error && error.message.includes('unique')) {
        return res.status(400).json({ success: false, error: 'A post with this slug already exists' });
      }
      res.status(500).json({ success: false, error: 'Failed to create blog post' });
    }
  });

  // PUT /api/blog/:id - Update blog post (admin only)
  router.put('/blog/:id', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        title, slug, excerpt, content, featured_image, author,
        meta_title, meta_description, canonical_url,
        status, category, tags, featured
      } = req.body;
      
      const result = await database.query(
        `UPDATE blog_posts 
         SET title = COALESCE($1, title),
             slug = COALESCE($2, slug),
             excerpt = COALESCE($3, excerpt),
             content = COALESCE($4, content),
             featured_image = COALESCE($5, featured_image),
             author = COALESCE($6, author),
             meta_title = COALESCE($7, meta_title),
             meta_description = COALESCE($8, meta_description),
             canonical_url = COALESCE($9, canonical_url),
             status = COALESCE($10, status),
             category = COALESCE($11, category),
             tags = COALESCE($12, tags),
             featured = COALESCE($13, featured),
             updated_at = CURRENT_TIMESTAMP,
             published_at = CASE WHEN $10 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END
         WHERE id = $14
         RETURNING *`,
        [title, slug, excerpt, content, featured_image, author,
         meta_title, meta_description, canonical_url,
         status, category, tags, featured, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Blog post not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating blog post:', error);
      res.status(500).json({ success: false, error: 'Failed to update blog post' });
    }
  });

  // DELETE /api/blog/:id - Delete blog post (admin only)
  router.delete('/blog/:id', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await database.query(
        'DELETE FROM blog_posts WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Blog post not found' });
      }
      
      res.json({ success: true, message: 'Blog post deleted' });
    } catch (error) {
      console.error('Error deleting blog post:', error);
      res.status(500).json({ success: false, error: 'Failed to delete blog post' });
    }
  });

  // ==================== GUIDES ====================

  // GET /api/guides - List all published guides
  router.get('/guides', async (req: Request, res: Response) => {
    try {
      const { category, difficulty, limit = 10, offset = 0 } = req.query;
      
      // Demo mode - return demo guides
      if (isDemoMode()) {
        let guides = [...demoGuides];
        if (category) {
          guides = guides.filter(g => g.category === category);
        }
        if (difficulty) {
          guides = guides.filter(g => g.difficulty === difficulty);
        }
        const start = Number(offset);
        const end = start + Number(limit);
        return res.json({
          success: true,
          data: guides.slice(start, end),
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: guides.length
          }
        });
      }
      
      let query = `
        SELECT id, title, slug, excerpt, featured_image, author, published_at, 
               category, difficulty, estimated_read_time_minutes, meta_title, meta_description, view_count, featured
        FROM guides 
        WHERE status = 'published'
      `;
      
      const params: unknown[] = [];
      
      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }
      
      if (difficulty) {
        params.push(difficulty);
        query += ` AND difficulty = $${params.length}`;
      }
      
      query += ` ORDER BY published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(Number(limit), Number(offset));
      
      const result = await database.query(query, params);
      
      res.json({
        success: true,
        data: result.rows,
        pagination: {
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      console.error('Error fetching guides:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch guides' });
    }
  });

  // GET /api/guides/:slug - Get single guide by slug
  router.get('/guides/:slug', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      
      // Demo mode - return demo guide
      if (isDemoMode()) {
        const guide = demoGuides.find(g => g.slug === slug);
        if (!guide) {
          return res.status(404).json({ success: false, error: 'Guide not found' });
        }
        return res.json({
          success: true,
          data: guide
        });
      }
      
      // First get the guide
      const result = await database.query(
        `SELECT * FROM guides WHERE slug = $1 AND status = 'published'`,
        [slug]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Guide not found' });
      }
      
      const guide = result.rows[0];
      
      // Increment view count
      await database.query(
        `UPDATE guides SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
        [guide.id]
      );
      
      // Update guide with incremented view count
      guide.view_count = (guide.view_count || 0) + 1;
      
      res.json({
        success: true,
        data: guide
      });
    } catch (error) {
      console.error('Error fetching guide:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch guide' });
    }
  });

  // POST /api/guides - Create new guide (admin only)
  router.post('/guides', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { 
        title, slug, excerpt, content, featured_image, author,
        meta_title, meta_description, canonical_url,
        status, category, difficulty, estimated_read_time_minutes, featured
      } = req.body;
      const normalizedCategory = normalizeGuideCategory(category);
      
      if (!title || !slug || !content) {
        return res.status(400).json({ 
          success: false, 
          error: 'Title, slug, and content are required' 
        });
      }

      if (category && !normalizedCategory) {
        return res.status(400).json({
          success: false,
          error: `Invalid guide category. Allowed: ${GUIDE_CATEGORIES.join(', ')}`,
        });
      }
      
      const result = await database.query(
        `INSERT INTO guides 
         (title, slug, excerpt, content, featured_image, author, meta_title, meta_description, canonical_url, status, category, difficulty, estimated_read_time_minutes, featured, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          title, slug, excerpt, content, featured_image, author,
          meta_title, meta_description, canonical_url,
          status || 'draft', normalizedCategory, difficulty, estimated_read_time_minutes, featured || false,
          status === 'published' ? new Date() : null
        ]
      );
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error: unknown) {
      console.error('Error creating guide:', error);
      if (error instanceof Error && error.message.includes('unique')) {
        return res.status(400).json({ success: false, error: 'A guide with this slug already exists' });
      }
      res.status(500).json({ success: false, error: 'Failed to create guide' });
    }
  });

  // PUT /api/guides/:id - Update guide (admin only)
  router.put('/guides/:id', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        title, slug, excerpt, content, featured_image, author,
        meta_title, meta_description, canonical_url,
        status, category, difficulty, estimated_read_time_minutes, featured
      } = req.body;
      const normalizedCategory = category === undefined ? undefined : normalizeGuideCategory(category);

      if (category !== undefined && !normalizedCategory) {
        return res.status(400).json({
          success: false,
          error: `Invalid guide category. Allowed: ${GUIDE_CATEGORIES.join(', ')}`,
        });
      }
      
      const result = await database.query(
        `UPDATE guides 
         SET title = COALESCE($1, title),
             slug = COALESCE($2, slug),
             excerpt = COALESCE($3, excerpt),
             content = COALESCE($4, content),
             featured_image = COALESCE($5, featured_image),
             author = COALESCE($6, author),
             meta_title = COALESCE($7, meta_title),
             meta_description = COALESCE($8, meta_description),
             canonical_url = COALESCE($9, canonical_url),
             status = COALESCE($10, status),
             category = COALESCE($11, category),
             difficulty = COALESCE($12, difficulty),
             estimated_read_time_minutes = COALESCE($13, estimated_read_time_minutes),
             featured = COALESCE($14, featured),
             updated_at = CURRENT_TIMESTAMP,
             published_at = CASE WHEN $10 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END
         WHERE id = $15
         RETURNING *`,
        [title, slug, excerpt, content, featured_image, author,
         meta_title, meta_description, canonical_url,
         status, normalizedCategory, difficulty, estimated_read_time_minutes, featured, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Guide not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating guide:', error);
      res.status(500).json({ success: false, error: 'Failed to update guide' });
    }
  });

  // DELETE /api/guides/:id - Delete guide (admin only)
  router.delete('/guides/:id', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await database.query(
        'DELETE FROM guides WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Guide not found' });
      }
      
      res.json({ success: true, message: 'Guide deleted' });
    } catch (error) {
      console.error('Error deleting guide:', error);
      res.status(500).json({ success: false, error: 'Failed to delete guide' });
    }
  });

  // ==================== CONTENT CATEGORIES ====================

  // GET /api/content/categories - Get available categories for blog and guides
  router.get('/content/categories', async (req: Request, res: Response) => {
    try {
      const blogCategories = await database.query(
        `SELECT DISTINCT category FROM blog_posts WHERE status = 'published' AND category IS NOT NULL`
      );
      
      const guideCategories = await database.query(
        `SELECT DISTINCT category FROM guides WHERE status = 'published' AND category IS NOT NULL`
      );
      
      res.json({
        success: true,
        data: {
          blog: blogCategories.rows.map(r => r.category),
          guides: guideCategories.rows.map(r => r.category)
        }
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
  });

  // ==================== CITY YIELD RANKINGS ====================

  // GET /api/content/city-yields - Get city-level rent/yield rankings for SEO content
  router.get('/content/city-yields', async (req: Request, res: Response) => {
    try {
      const { limit = 10, province } = req.query;
      
      // Demo mode - return sample city yield data
      if (isDemoMode()) {
        const demoCityYields = [
          { city: 'Windsor', province: 'ON', median_rent: 1650, sample_size: 450, yield_estimate: 8.2 },
          { city: 'Saint John', province: 'NB', median_rent: 1200, sample_size: 280, yield_estimate: 7.8 },
          { city: 'Trois-Rivières', province: 'QC', median_rent: 1050, sample_size: 320, yield_estimate: 7.5 },
          { city: 'Saskatoon', province: 'SK', median_rent: 1400, sample_size: 510, yield_estimate: 6.9 },
          { city: 'London', province: 'ON', median_rent: 1850, sample_size: 890, yield_estimate: 6.4 },
          { city: 'Kingston', province: 'ON', median_rent: 1700, sample_size: 420, yield_estimate: 6.1 },
          { city: 'St. Catharines', province: 'ON', median_rent: 1600, sample_size: 380, yield_estimate: 5.8 },
          { city: 'Oshawa', province: 'ON', median_rent: 1900, sample_size: 540, yield_estimate: 5.5 },
          { city: 'Kitchener', province: 'ON', median_rent: 1950, sample_size: 670, yield_estimate: 5.2 },
          { city: 'Hamilton', province: 'ON', median_rent: 2000, sample_size: 780, yield_estimate: 5.0 },
        ];
        
        let filtered = demoCityYields;
        if (province) {
          filtered = demoCityYields.filter(c => c.province === province);
        }
        
        return res.json({
          success: true,
          data: filtered.slice(0, Number(limit)),
          meta: {
            source: 'Realist Rent Pulse',
            updated_at: new Date().toISOString(),
            note: 'Yield estimates based on average rental rates vs. median property prices'
          }
        });
      }
      
      // Production mode - query rent_pulse table
      let query = `
        SELECT 
          city,
          province,
          AVG(median_rent) as median_rent,
          SUM(sample_size) as sample_size,
          COUNT(*) as data_points
        FROM rent_pulse
        WHERE bedrooms = 'all'
      `;
      
      const params: unknown[] = [];
      
      if (province) {
        params.push(province);
        query += ` AND province = $${params.length}`;
      }
      
      query += ` GROUP BY city, province ORDER BY median_rent DESC LIMIT $${params.length + 1}`;
      params.push(Number(limit));
      
      const result = await database.query(query, params);
      
      // Add yield estimates (rough calculation based on typical price-to-rent ratio)
      const cityYields = result.rows.map(row => ({
        ...row,
        median_rent: row.median_rent / 100, // Convert from cents to dollars
        yield_estimate: Math.round((row.median_rent * 12 / 300000) * 100) / 100 // Rough cap rate estimate
      }));
      
      res.json({
        success: true,
        data: cityYields,
        meta: {
          source: 'Realist Rent Pulse',
          updated_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching city yields:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch city yields' });
    }
  });

  // ==================== FEATURED CONTENT ====================

  // GET /api/content/featured - Get featured blog posts and guides
  router.get('/content/featured', async (req: Request, res: Response) => {
    try {
      const { type = 'all', limit = 5 } = req.query;
      
      if (isDemoMode()) {
        const featuredPosts = demoBlogPosts.filter(p => p.featured).slice(0, Number(limit));
        const featuredGuides = demoGuides.filter(g => g.featured).slice(0, Number(limit));
        
        if (type === 'blog') {
          return res.json({ success: true, data: featuredPosts });
        }
        if (type === 'guides') {
          return res.json({ success: true, data: featuredGuides });
        }
        return res.json({ 
          success: true, 
          data: {
            blog: featuredPosts,
            guides: featuredGuides
          }
        });
      }
      
      const blogQuery = type !== 'guides' 
        ? await database.query(
            `SELECT id, title, slug, excerpt, featured_image, author, published_at, category, view_count, 'blog' as type
             FROM blog_posts WHERE status = 'published' AND featured = true
             ORDER BY published_at DESC LIMIT $1`,
            [Number(limit)]
          )
        : { rows: [] };
      
      const guidesQuery = type !== 'blog'
        ? await database.query(
            `SELECT id, title, slug, excerpt, featured_image, author, published_at, category, difficulty, view_count, 'guide' as type
             FROM guides WHERE status = 'published' AND featured = true
             ORDER BY published_at DESC LIMIT $1`,
            [Number(limit)]
          )
        : { rows: [] };
      
      if (type === 'blog') {
        return res.json({ success: true, data: blogQuery.rows });
      }
      if (type === 'guides') {
        return res.json({ success: true, data: guidesQuery.rows });
      }
      
      res.json({
        success: true,
        data: {
          blog: blogQuery.rows,
          guides: guidesQuery.rows
        }
      });
    } catch (error) {
      console.error('Error fetching featured content:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch featured content' });
    }
  });

  // ==================== CONTENT SEARCH ====================

  // GET /api/content/search - Search blog posts and guides
  router.get('/content/search', async (req: Request, res: Response) => {
    try {
      const { q, type, limit = 10 } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ success: false, error: 'Search query required' });
      }
      
      if (isDemoMode()) {
        const searchLower = q.toLowerCase();
        let blogResults: typeof demoBlogPosts = [];
        let guideResults: typeof demoGuides = [];
        
        if (type !== 'guides') {
          blogResults = demoBlogPosts.filter(p => 
            p.title.toLowerCase().includes(searchLower) ||
            p.excerpt.toLowerCase().includes(searchLower) ||
            p.content.toLowerCase().includes(searchLower)
          ).slice(0, Number(limit));
        }
        
        if (type !== 'blog') {
          guideResults = demoGuides.filter(g =>
            g.title.toLowerCase().includes(searchLower) ||
            g.excerpt.toLowerCase().includes(searchLower) ||
            g.content.toLowerCase().includes(searchLower)
          ).slice(0, Number(limit));
        }
        
        return res.json({
          success: true,
          data: {
            query: q,
            blog: blogResults,
            guides: guideResults,
            total: blogResults.length + guideResults.length
          }
        });
      }
      
      let blogResults = { rows: [] as QueryResultRow[] };
      let guideResults = { rows: [] as QueryResultRow[] };
      
      if (type !== 'guides') {
        blogResults = await database.query(
          `SELECT id, title, slug, excerpt, 'blog' as type, published_at
           FROM blog_posts 
           WHERE status = 'published' AND (title ILIKE $1 OR excerpt ILIKE $1 OR content ILIKE $1)
           ORDER BY published_at DESC
           LIMIT $2`,
          [`%${q}%`, Number(limit)]
        );
      }
      
      if (type !== 'blog') {
        guideResults = await database.query(
          `SELECT id, title, slug, excerpt, 'guide' as type, published_at
           FROM guides 
           WHERE status = 'published' AND (title ILIKE $1 OR excerpt ILIKE $1 OR content ILIKE $1)
           ORDER BY published_at DESC
           LIMIT $2`,
          [`%${q}%`, Number(limit)]
        );
      }
      
      res.json({
        success: true,
        data: {
          query: q,
          blog: blogResults.rows,
          guides: guideResults.rows,
          total: blogResults.rows.length + guideResults.rows.length
        }
      });
    } catch (error) {
      console.error('Error searching content:', error);
      res.status(500).json({ success: false, error: 'Failed to search content' });
    }
  });

  // ==================== SITEMAP DATA ====================

  // GET /api/content/sitemap - Get all published content for sitemap generation
  router.get('/content/sitemap', async (req: Request, res: Response) => {
    try {
      if (isDemoMode()) {
        const blogUrls = demoBlogPosts
          .filter(p => p.status === 'published')
          .map(p => ({
            url: `/insights/blog/${p.slug}`,
            lastmod: p.published_at,
            priority: '0.8',
            changefreq: 'weekly'
          }));
        
        const guideUrls = demoGuides
          .filter(g => g.status === 'published')
          .map(g => ({
            url: `/insights/guides/${g.slug}`,
            lastmod: g.published_at,
            priority: '0.7',
            changefreq: 'monthly'
          }));
        
        return res.json({
          success: true,
          data: {
            blog: blogUrls,
            guides: guideUrls
          }
        });
      }
      
      const blogResult = await database.query(
        `SELECT slug, published_at as lastmod, 'blog' as type
         FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC`
      );
      
      const guideResult = await database.query(
        `SELECT slug, published_at as lastmod, 'guide' as type
         FROM guides WHERE status = 'published' ORDER BY published_at DESC`
      );
      
      const blogUrls = blogResult.rows.map(r => ({
        url: `/insights/blog/${r.slug}`,
        lastmod: r.lastmod,
        priority: '0.8',
        changefreq: 'weekly'
      }));
      
      const guideUrls = guideResult.rows.map(r => ({
        url: `/insights/guides/${r.slug}`,
        lastmod: r.lastmod,
        priority: '0.7',
        changefreq: 'monthly'
      }));
      
      res.json({
        success: true,
        data: {
          blog: blogUrls,
          guides: guideUrls
        }
      });
    } catch (error) {
      console.error('Error fetching sitemap data:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sitemap data' });
    }
  });

  return router;
}
