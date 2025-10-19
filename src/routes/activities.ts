import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  await db.read();
  res.json(db.data.activities);
});

router.post('/:id/join', requireAuth, async (req, res) => {
  const id = req.params.id;
  await db.read();
  const activity = db.data.activities.find((a) => a.id === id);
  if (!activity) return res.status(404).json({ error: 'Activity not found' });
  activity.participants += 1;
  await db.write();
  res.json(activity);
});

export default router;
