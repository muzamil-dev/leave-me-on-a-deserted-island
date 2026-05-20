import { Router } from 'express';
import db from '../db/client';

const router = Router();


router.get('/', (req, res) => {
  try {
    const results = db.prepare('SELECT * FROM discovered_profiles ORDER BY found_at DESC').all();
    res.json(results);
  } catch (error) {
    console.error('Error fetching discovered profiles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/', (req, res) => {
  const { broker_id, profile_url } = req.body;
  if (!broker_id || !profile_url) {
    return res.status(400).json({ error: 'Missing broker_id or profile_url' });
  }

  try {
    db.prepare('INSERT OR IGNORE INTO discovered_profiles (broker_id, profile_url) VALUES (?, ?)')
      .run(broker_id, profile_url);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving discovered profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM discovered_profiles WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
