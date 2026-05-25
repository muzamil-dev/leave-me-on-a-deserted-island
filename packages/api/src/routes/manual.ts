import { Router } from 'express';
import db from '../db/client';

const router = Router();

router.get('/', (req, res) => {
  const items = db.prepare(`
    SELECT id, broker_id, reason, opt_out_url, instructions, resolved, created_at
    FROM manual_queue
    ORDER BY resolved ASC, created_at DESC
  `).all();
  res.json(items);
});

router.patch('/:id/resolve', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE manual_queue SET resolved = 1 WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
