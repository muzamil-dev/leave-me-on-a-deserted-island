import { Router } from 'express';
import { z } from 'zod';
import db from '../db/client';

const router = Router();

const ProfileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  dob_month: z.number().nullable().optional(),
  dob_year: z.number().nullable().optional(),
  aliases: z.array(z.string()).nullable().optional(),
  address_history: z.array(z.string()).nullable().optional(),
  imap_host: z.string().nullable().optional(),
  imap_user: z.string().nullable().optional(),
  imap_pass: z.string().nullable().optional(),
  captcha_api_key: z.string().nullable().optional(),
  captcha_provider: z.enum(['2captcha', 'capsolver']).nullable().optional(),
});


router.get('/', (req, res) => {
  try {
    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() as any;
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    
    const redacted = { ...profile };
    if (redacted.imap_pass) redacted.imap_pass = '********';
    if (redacted.captcha_api_key) redacted.captcha_api_key = '********';
    
    
    redacted.aliases = profile.aliases ? JSON.parse(profile.aliases) : [];
    redacted.address_history = profile.address_history ? JSON.parse(profile.address_history) : [];

    res.json(redacted);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/', (req, res) => {
  try {
    const validatedData = ProfileSchema.parse(req.body);

    const data = {
      ...validatedData,
      aliases: JSON.stringify(validatedData.aliases || []),
      address_history: JSON.stringify(validatedData.address_history || []),
    };

    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    
    db.prepare(`
      INSERT INTO profile (id, ${columns})
      VALUES (1, ${placeholders})
      ON CONFLICT(id) DO UPDATE SET
        ${Object.keys(data).map(col => `${col} = excluded.${col}`).join(', ')},
        updated_at = CURRENT_TIMESTAMP
    `).run(...values);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
