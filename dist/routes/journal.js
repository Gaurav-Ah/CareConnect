import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
const router = Router();
router.use(requireAuth);
router.get('/', async (req, res) => {
    await db.read();
    const entries = db.data.journals.filter((j) => j.userId === req.user.id);
    res.json(entries);
});
const createSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
});
router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const entry = {
        id: nanoid(),
        userId: req.user.id,
        title: parsed.data.title,
        content: parsed.data.content,
        date: new Date().toISOString(),
    };
    await db.read();
    db.data.journals.push(entry);
    await db.write();
    res.status(201).json(entry);
});
export default router;
