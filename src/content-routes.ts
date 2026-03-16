/**
 * Express API routes for SEO Content (Blog Posts & Guides)
 */

import { Router, Request, Response } from 'express';
import { QueryResultRow } from 'pg';
import { db as defaultDb } from './db';
import { isDemoMode, getDemoBlogPosts, getDemoGuideBySlug, getDemoBlogPostBySlug, demoGuides } from './demo-data';

interface DatabaseAdapter {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: readonly unknown[]) => Promise<{ rows: T[] }>;
}

export function createContentRouter(database: DatabaseAdapter = defaultDb): Router {
  const router = Router();

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
               category, tags, meta_title, meta_description
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
      
      const result = await database.query(
        `SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published'`,
        [slug]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Blog post not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching blog post:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch blog post' });
    }
  });

  // POST /api/blog - Create new blog post (admin only - no auth for demo)
  router.post('/blog', async (req: Request, res: Response) => {
    try {
      const { 
        title, slug, excerpt, content, featured_image, author,
        meta_title, meta_description, canonical_url,
        status, category, tags
      } = req.body;
      
      if (!title || !slug || !content) {
        return res.status(400).json({ 
          success: false, 
          error: 'Title, slug, and content are required' 
        });
      }
      
      const result = await database.query(
        `INSERT INTO blog_posts 
         (title, slug, excerpt, content, featured_image, author, meta_title, meta_description, canonical_url, status, category, tags, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          title, slug, excerpt, content, featured_image, author,
          meta_title, meta_description, canonical_url,
          status || 'draft', category, tags,
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
  router.put('/blog/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        title, slug, excerpt, content, featured_image, author,
        meta_title, meta_description, canonical_url,
        status, category, tags
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
             updated_at = CURRENT_TIMESTAMP,
             published_at = CASE WHEN $10 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END
         WHERE id = $13
         RETURNING *`,
        [title, slug, excerpt, content, featured_image, author,
         meta_title, meta_description, canonical_url,
         status, category, tags, id]
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
  router.delete('/blog/:id', async (req: Request, res: Response) => {
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
               category, difficulty, estimated_read_time_minutes, meta_title, meta_description
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
      
      const result = await database.query(
        `SELECT * FROM guides WHERE slug = $1 AND status = 'published'`,
        [slug]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Guide not found' });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching guide:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch guide' });
    }
  });

  // POST /api/guides - Create new guide (admin only)
  router.post('/guides', async (req: Request, res: Response) => {
    try {
      const { 
        title, slug, excerpt, content, featured_image, author,
        meta_title, meta_description, canonical_url,
        status, category, difficulty, estimated_read_time_minutes
      } = req.body;
      
      if (!title || !slug || !content) {
        return res.status(400).json({ 
          success: false, 
          error: 'Title, slug, and content are required' 
        });
      }
      
      const result = await database.query(
        `INSERT INTO guides 
         (title, slug, excerpt, content, featured_image, author, meta_title, meta_description, canonical_url, status, category, difficulty, estimated_read_time_minutes, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          title, slug, excerpt, content, featured_image, author,
          meta_title, meta_description, canonical_url,
          status || 'draft', category, difficulty, estimated_read_time_minutes,
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
  router.put('/guides/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { 
        title, slug, excerpt, content, featured_image, author,
        meta_title, meta_description, canonical_url,
        status, category, difficulty, estimated_read_time_minutes
      } = req.body;
      
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
             updated_at = CURRENT_TIMESTAMP,
             published_at = CASE WHEN $10 = 'published' AND published_at IS NULL THEN CURRENT_TIMESTAMP ELSE published_at END
         WHERE id = $14
         RETURNING *`,
        [title, slug, excerpt, content, featured_image, author,
         meta_title, meta_description, canonical_url,
         status, category, difficulty, estimated_read_time_minutes, id]
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
  router.delete('/guides/:id', async (req: Request, res: Response) => {
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

  return router;
}
