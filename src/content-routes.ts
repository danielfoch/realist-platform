/**
 * Express API routes for SEO Content (Blog Posts & Guides)
 */

import { Router, Request, Response } from 'express';
import { QueryResultRow } from 'pg';
import { db as defaultDb } from './db';

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

  return router;
}
