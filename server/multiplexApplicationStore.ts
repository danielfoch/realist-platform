import { pool } from "./db";
import type { MultiplexApplication } from "./multiplexApplications";

// A dedicated private intake ledger. No application is exposed by a public GET.
export async function initializeMultiplexApplications() {
  await pool.query(`CREATE TABLE IF NOT EXISTS multiplex_applications (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
}
export async function saveMultiplexApplication(data: MultiplexApplication) {
  const { website: _honeypot, ...payload } = data;
  const result = await pool.query(
    `INSERT INTO multiplex_applications (id, name, email, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [data.submissionId, data.name, data.email, JSON.stringify({...payload, source: "multiplexes-toronto-2026", consentVersion: "application-contact-v1"})],
  );
  if (!result.rowCount) {
    const existing = await pool.query("SELECT email FROM multiplex_applications WHERE id = $1", [data.submissionId]);
    if (existing.rows[0]?.email !== data.email) throw new Error("Submission conflict");
  }
}
