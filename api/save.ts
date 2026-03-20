// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VercelRequest  = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VercelResponse = any;
import { sql } from '@vercel/postgres';

/**
 * GET  /api/save?userId=xxx  — load save data
 * POST /api/save             — create or update save data
 * Body: { userId: string, saveData: object }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ensure table exists (idempotent)
  await sql`
    CREATE TABLE IF NOT EXISTS saves (
      user_id  VARCHAR(36)  PRIMARY KEY,
      save_data JSONB       NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  if (req.method === 'GET') {
    const userId = req.query['userId'];
    if (!userId || typeof userId !== 'string' || !isValidUUID(userId)) {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }

    const result = await sql`
      SELECT save_data, updated_at FROM saves WHERE user_id = ${userId}
    `;

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No save found' });
    }

    return res.status(200).json({
      saveData: result.rows[0]['save_data'],
      updatedAt: result.rows[0]['updated_at'],
    });
  }

  if (req.method === 'POST') {
    const body = req.body as { userId?: unknown; saveData?: unknown };
    const userId = body.userId;
    const saveData = body.saveData;

    if (!userId || typeof userId !== 'string' || !isValidUUID(userId)) {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }
    if (!saveData || typeof saveData !== 'object') {
      return res.status(400).json({ error: 'Missing saveData' });
    }

    const saveJson = JSON.stringify(saveData);

    await sql`
      INSERT INTO saves (user_id, save_data, updated_at)
      VALUES (${userId}, ${saveJson}::jsonb, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET save_data = ${saveJson}::jsonb, updated_at = NOW()
    `;

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const userId = req.query['userId'];
    if (!userId || typeof userId !== 'string' || !isValidUUID(userId)) {
      return res.status(400).json({ error: 'Missing or invalid userId' });
    }

    await sql`DELETE FROM saves WHERE user_id = ${userId}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/** Basic UUID v4 format validation to prevent SQL injection via format check */
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
