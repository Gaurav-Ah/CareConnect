import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
const router = Router();
router.use(requireAuth);
router.get('/', async (req, res) => {
    await db.read();
    const moods = db.data.moods.filter((m) => m.userId === req.user.id);
    res.json(moods);
});
const createSchema = z.object({
    mood: z.enum(['happy', 'sad', 'anxious', 'angry', 'tired', 'neutral']),
    intensity: z.number().min(1).max(10),
});
router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const entry = {
        id: nanoid(),
        userId: req.user.id,
        mood: parsed.data.mood,
        intensity: parsed.data.intensity,
        date: new Date().toISOString(),
    };
    await db.read();
    db.data.moods.push(entry);
    await db.write();
    res.status(201).json(entry);
});
export default router;
