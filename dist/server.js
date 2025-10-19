import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import { seedIfEmpty } from './seed.js';
import authRoutes from './routes/auth.js';
import activitiesRoutes from './routes/activities.js';
import journalRoutes from './routes/journal.js';
import moodRoutes from './routes/mood.js';
import therapyRoutes from './routes/therapy.js';
import chatRoutes from './routes/chat.js';
dotenv.config();
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
// API routes
app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/therapy', therapyRoutes);
app.use('/api/chat', chatRoutes);
// Serve static frontend from workspace root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..');
app.use('/', express.static(publicDir));
// Fallback to index.html if exists
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/'))
        return next();
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
        if (err)
            next();
    });
});
const PORT = process.env.PORT || 3000;
async function start() {
    await initDb();
    await seedIfEmpty();
    app.listen(PORT, () => {
        console.log(`CareConnect backend listening on http://localhost:${PORT}`);
    });
}
start();
