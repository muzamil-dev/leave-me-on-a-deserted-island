import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/client';

const router = Router();


router.get('/', (req, res) => {
  try {
    const runs = db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT 50').all();
    res.json(runs);
  } catch (error) {
    console.error('Error fetching runs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/:id/results', (req, res) => {
  try {
    const results = db.prepare('SELECT * FROM opt_out_results WHERE run_id = ?').all(req.params.id);
    res.json(results);
  } catch (error) {
    console.error('Error fetching run results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

undefined
router.post('/start', (req, res) => {
  console.log('Received request to start a new scan');
  try {
    const activeRun = db.prepare('SELECT id FROM runs WHERE status IN (?, ?)').get('running', 'queued');

    if (activeRun) {
      console.log('Rejected: A scan is already active or queued');
      return res.status(400).json({ error: 'A run is already active or queued.' });
    }

    const runId = uuidv4();
    db.prepare('INSERT INTO runs (id, status, started_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run(runId, 'queued');

    console.log(`Successfully queued new run: ${runId}`);
    res.json({ id: runId, status: 'queued' });
  } catch (error) {
    console.error('Error starting run:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


export default router;
