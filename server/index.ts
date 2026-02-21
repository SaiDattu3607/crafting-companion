/**
 * CraftChain Express Server
 * 
 * Main entry point for the backend API.
 * 
 * Start with: npx tsx server/index.ts
 * Or: npm run server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

import projectRoutes from './routes/projects.js';
import contributionRoutes from './routes/contributions.js';
import itemRoutes from './routes/items.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({
  origin: true,  // Allow any origin (for LAN access)
  credentials: true,
}));
app.use(express.json());

// ── Health Check ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/projects', projectRoutes);
app.use('/api/projects', contributionRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/admin', adminRoutes);

// ── Error Handler ──────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ───────────────────────────────────────────────
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║           ⛏  CraftChain API Server  ⛏          ║
║                                                  ║
║   Running on: http://localhost:${PORT}             ║
║   Health:     http://localhost:${PORT}/api/health   ║
║                                                  ║
║   Endpoints:                                     ║
║   GET    /api/projects                           ║
║   POST   /api/projects                           ║
║   GET    /api/projects/:id                       ║
║   DELETE /api/projects/:id                       ║
║   POST   /api/projects/:id/contribute            ║
║   POST   /api/projects/:id/members               ║
║   GET    /api/projects/:id/contributions         ║
║   GET    /api/projects/:id/leaderboard           ║
║   GET    /api/projects/:id/bottleneck            ║
║   GET    /api/projects/:id/progress              ║
║   GET    /api/items/search?q=...                 ║
║   GET    /api/items/:itemName                    ║
╚══════════════════════════════════════════════════╝
  `);
});

export default app;
