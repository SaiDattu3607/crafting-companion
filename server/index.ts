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

console.log('--- SERVER STARTING ---');
console.log('Node Version:', process.version);
console.log('CWD:', process.cwd());
console.log('PORT:', process.env.PORT);
console.log('VERCEL:', process.env.VERCEL);

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

import projectRoutes from './routes/projects.js';
import contributionRoutes from './routes/contributions.js';
import itemRoutes from './routes/items.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

app.use(cors({
  origin: true, // This reflects the Origin header back
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info'],
}));
app.use(express.json());

// ── Root ──────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: 'CraftChain API',
    version: '1.0.0',
    docs: 'API only — use the routes below. Frontend: run npm run dev',
    health: '/api/health',
    endpoints: {
      projects: '/api/projects',
      items: '/api/items',
      admin: '/api/admin',
    },
  });
});

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

// ── Static Files (Frontend) ───────────────────────────────────
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
// Note: Express 5 requires named parameters for wildcards
app.get('/:splat*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  console.log(`SPA Fallback: Serving index.html for ${req.path}`);
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Error Handler ──────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server (Only if not in Vercel) ────────────────────────
if (!process.env.VERCEL) {
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
}

export default app;
