import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.CREA_DB_PATH || path.join(__dirname, '../../data/mls-xml/crea.db');
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
  }
  return db;
}

const router = Router();

// List available markets
router.get('/markets', (_req: Request, res: Response) => {
  try {
    const d = getDb();
    const rows = d.prepare("SELECT DISTINCT geography FROM crea_stats ORDER BY geography").all() as { geography: string }[];
    res.json({ markets: rows.map(r => r.geography), count: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List available measures
router.get('/measures', (_req: Request, res: Response) => {
  try {
    const d = getDb();
    const rows = d.prepare("SELECT DISTINCT measure FROM crea_stats ORDER BY measure").all() as { measure: string }[];
    res.json({ measures: rows.map(r => r.measure) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Query stats
router.get('/stats', (req: Request, res: Response) => {
  try {
    const d = getDb();
    const { geography, measure, from, to, last, property_type, time_aggregation } = req.query;

    let sql = 'SELECT * FROM crea_stats WHERE 1=1';
    const params: any[] = [];

    if (geography) { sql += ' AND geography = ?'; params.push(geography); }
    if (measure) { sql += ' AND measure = ?'; params.push(measure); }
    if (property_type) { sql += ' AND property_type = ?'; params.push(property_type); }
    if (time_aggregation) { sql += ' AND time_aggregation = ?'; params.push(time_aggregation); }
    if (from) { sql += ' AND month >= ?'; params.push(from as string); }
    if (to) { sql += ' AND month <= ?'; params.push(to as string); }

    sql += ' ORDER BY month';

    let rows = d.prepare(sql).all(...params) as any[];

    if (last) {
      const n = parseInt(last as string, 10);
      rows = rows.slice(-n);
    }

    res.json({ data: rows, count: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Compare markets
router.get('/compare', (req: Request, res: Response) => {
  try {
    const d = getDb();
    const { markets, measure, from, to, last, property_type } = req.query;

    if (!markets) return res.status(400).json({ error: 'markets param required (comma-separated)' });

    const marketList = (markets as string).split(',').map(m => m.trim());

    const placeholders = marketList.map(() => '?').join(',');
    let sql = `SELECT * FROM crea_stats WHERE geography IN (${placeholders})`;
    const params: any[] = [...marketList];

    if (measure) { sql += ' AND measure = ?'; params.push(measure); }
    if (property_type) { sql += ' AND property_type = ?'; params.push(property_type); }
    if (from) { sql += ' AND month >= ?'; params.push(from as string); }
    if (to) { sql += ' AND month <= ?'; params.push(to as string); }

    sql += ' ORDER BY geography, month';

    let rows = d.prepare(sql).all(...params) as any[];

    if (last) {
      // Get last N per geography
      const n = parseInt(last as string, 10);
      const byGeo: Record<string, any[]> = {};
      for (const row of rows) {
        if (!byGeo[row.geography]) byGeo[row.geography] = [];
        byGeo[row.geography].push(row);
      }
      rows = Object.values(byGeo).flatMap(arr => arr.slice(-n));
      rows.sort((a, b) => a.month.localeCompare(b.month));
    }

    res.json({ data: rows, count: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Property types
router.get('/property-types', (_req: Request, res: Response) => {
  try {
    const d = getDb();
    const rows = d.prepare("SELECT DISTINCT property_type FROM crea_stats ORDER BY property_type").all() as { property_type: string }[];
    res.json({ property_types: rows.map(r => r.property_type) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;