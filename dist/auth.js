import jwt from 'jsonwebtoken';
import { db } from './db.js';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export function signToken(user) {
    return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
        expiresIn: '7d',
    });
}
export async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or invalid Authorization header' });
            return;
        }
        const token = header.slice('Bearer '.length);
        const payload = jwt.verify(token, JWT_SECRET);
        await db.read();
        const user = db.data.users.find((u) => u.id === payload.sub);
        if (!user) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        req.user = user;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Unauthorized' });
    }
}
