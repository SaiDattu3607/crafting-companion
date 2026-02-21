/**
 * Contribution Routes
 * 
 * POST /contribute — with Contribution Guard
 * GET  /contributions — history
 * GET  /leaderboard — contribution ranking
 * GET  /bottleneck — blocking resources
 * GET  /progress — overall project progress
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin, supabaseForUser } from '../config/supabase.js';
import { authMiddleware, projectMemberGuard } from '../middleware/auth.js';
import { contribute, getProjectContributions, getContributionLeaderboard } from '../services/contribution.js';
import { findBottleneck, getProjectProgress } from '../services/bottleneck.js';

const router = Router();



// All routes require authentication
router.use(authMiddleware);

// ── POST /api/projects/:projectId/contribute ───────────────────
// Contribute items to a crafting node (with Contribution Guard)
router.post('/:projectId/contribute', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const { nodeId, quantity = 1, action = 'collected' } = req.body;

    if (!nodeId) {
      res.status(400).json({ error: 'nodeId is required' });
      return;
    }

    if (!['collected', 'crafted'].includes(action)) {
      res.status(400).json({ error: 'action must be "collected" or "crafted"' });
      return;
    }

    const result = await contribute({
      projectId,
      nodeId,
      userId: req.userId!,
      quantity: Math.max(1, Number(quantity)),
      action,
    }, supabaseForUser(req.accessToken!));

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/projects/:projectId/contributions ──────────────────
// Get contribution history for a project
router.get('/:projectId/contributions', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const contributions = await getProjectContributions(req.params.projectId as string, supabaseForUser(req.accessToken!));
    res.json({ contributions });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/projects/:projectId/leaderboard ────────────────────
// Get contribution leaderboard
router.get('/:projectId/leaderboard', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const leaderboard = await getContributionLeaderboard(req.params.projectId as string, supabaseForUser(req.accessToken!));
    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/projects/:projectId/bottleneck ─────────────────────
// Find which raw resources are blocking the most progress
router.get('/:projectId/bottleneck', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const bottlenecks = await findBottleneck(req.params.projectId as string, supabaseForUser(req.accessToken!));
    res.json({ bottlenecks });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/projects/:projectId/progress ───────────────────────
// Get overall project progress
router.get('/:projectId/progress', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const progress = await getProjectProgress(req.params.projectId as string, supabaseForUser(req.accessToken!));
    res.json({ progress });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});


export default router;
