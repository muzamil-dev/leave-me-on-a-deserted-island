import { Router } from 'express';

const router = Router();
let logs: string[] = [];


router.get('/', (req, res) => {
  res.json(logs.slice(-100)); 
});


router.post('/', (req, res) => {
  const { message } = req.body;
  if (message) {
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${message}`);
    
    console.log(`[ENGINE] ${message}`);
  }
  res.json({ success: true });
});

export default router;
