/**
 * Item Search Routes (public, no project context needed)
 * 
 * Search for Minecraft items and look up recipe info.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { searchItems, lookupItem } from '../services/recipeParser.js';

const router = Router();

// Authentication required but no project membership needed
router.use(authMiddleware);

// ── GET /api/items/search?q=... ────────────────────────────────
// Search Minecraft items by partial name
router.get('/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (query.length < 2) {
    res.json({ items: [] });
    return;
  }
  const items = searchItems(query, 20);
  res.json({ items });
});

// ── GET /api/items/:itemName ───────────────────────────────────
// Look up a specific Minecraft item by name
router.get('/:itemName', async (req: Request, res: Response) => {
  const item = lookupItem(req.params.itemName as string);
  if (!item) {
    res.status(404).json({ error: `Item "${req.params.itemName}" not found` });
    return;
  }
  res.json(item);
});

export default router;
