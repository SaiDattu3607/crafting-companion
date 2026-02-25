/**
 * Item Search Routes (public, no project context needed)
 * 
 * Search for Minecraft items and look up recipe info.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { searchItems, lookupItem, getItemDetail, getEnchantmentData } from '../services/recipeParser.js';

const router = Router();

// Authentication required but no project membership needed
router.use(authMiddleware);

// ── GET /api/items/enchantment/:enchantmentName ────────────────
// Get full enchantment data from minecraft-data (for Enchanted Book Guide modal)
router.get('/enchantment/:enchantmentName', async (req: Request, res: Response) => {
  const data = getEnchantmentData(req.params.enchantmentName);
  if (!data) {
    res.status(404).json({ error: `Enchantment "${req.params.enchantmentName}" not found` });
    return;
  }
  res.json(data);
});

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

// ── GET /api/items/:itemName/detail ─────────────────────────────
// Get detailed item info including recipe grid, acquisition, drops
router.get('/:itemName/detail', async (req: Request, res: Response) => {
  const detail = getItemDetail(req.params.itemName as string);
  if (!detail) {
    res.status(404).json({ error: `Item "${req.params.itemName}" not found` });
    return;
  }
  res.json(detail);
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
