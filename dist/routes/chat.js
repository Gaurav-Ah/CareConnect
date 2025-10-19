import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
const router = Router();
router.get('/rooms/:room/messages', async (req, res) => {
    const room = req.params.room;
    await db.read();
    const messages = db.data.chatMessages.filter((m) => m.room === room).slice(-100);
    res.json(messages);
});
const sendSchema = z.object({
    room: z.string().min(1),
    content: z.string().min(1),
});
router.post('/messages', requireAuth, async (req, res) => {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const now = new Date();
    const msg = {
        id: nanoid(),
        room: parsed.data.room,
        user: req.user.name,
        content: parsed.data.content,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    await db.read();
    db.data.chatMessages.push(msg);
    await db.write();
    res.status(201).json(msg);
});
export default router;
