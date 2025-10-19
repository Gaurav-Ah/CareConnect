import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
const router = Router();
router.use(requireAuth);
router.get('/', async (req, res) => {
    await db.read();
    const sessions = db.data.therapySessions.filter((s) => s.userId === req.user.id);
    res.json(sessions);
});
const createSchema = z.object({
    therapist: z.string().min(1),
    date: z.string().datetime().or(z.string()), // accept ISO
});
router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const session = {
        id: nanoid(),
        userId: req.user.id,
        therapist: parsed.data.therapist,
        date: new Date(parsed.data.date).toISOString(),
    };
    await db.read();
    db.data.therapySessions.push(session);
    await db.write();
    res.status(201).json(session);
});
export default router;
