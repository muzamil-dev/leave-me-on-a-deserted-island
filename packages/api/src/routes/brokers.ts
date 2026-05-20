import { Router } from 'express';
import path from 'path';
import db from '../db/client';
import { loadBrokers } from '../utils/parser';

const router = Router();


router.get('/', (req, res) => {
  try {
    const brokersPath = '/app/broker-definitions';
    const brokers = loadBrokers(brokersPath);
    
    
    const latestResults = db.prepare(`
      SELECT broker_id, status, submitted_at, confirmed_at, next_recheck_at
      FROM opt_out_results
      WHERE id IN (SELECT MAX(id) FROM opt_out_results GROUP BY broker_id)
    `).all() as any[];

    const resultsMap = new Map(latestResults.map(r => [r.broker_id, r]));

    res.json(brokers.map(b => ({
      id: b.id,
      name: b.name,
      method: b.method,
      recheck_days: b.recheck_days,
      requires_id: b.requires_id_verification,
      status: resultsMap.get(b.id)?.status || 'pending',
      last_run: resultsMap.get(b.id)?.submitted_at || null
    })));
  } catch (error) {
    console.error('Error fetching brokers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
