/**
 * Project Routes
 * 
 * CRUD for projects, recipe parsing, and member management.
 */

import { Router, Request, Response } from 'express';
import { supabaseForUser } from '../config/supabase.js';
import { authMiddleware, projectMemberGuard } from '../middleware/auth.js';
import { parseRecipeTree, searchItems, lookupItem } from '../services/recipeParser.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ── GET /api/projects ──────────────────────────────────────────
// List all projects for the authenticated user
router.get('/', async (req: Request, res: Response) => {
  try {
    const sb = supabaseForUser(req.accessToken!);
    const { data, error } = await sb
      .from('project_members')
      .select(`
        project_id,
        role,
        projects!inner (
          id, name, description, root_item_name, owner_id, status, created_at, updated_at
        )
      `)
      .eq('user_id', req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const projects = (data || []).map((m: any) => ({
      ...m.projects,
      role: m.role,
    }));

    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/projects ─────────────────────────────────────────
// Create a new project and parse the recipe tree
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, rootItemName, quantity = 1, enchantments = null } = req.body;

    if (!name || !rootItemName) {
      res.status(400).json({ error: 'name and rootItemName are required' });
      return;
    }

    // Validate the item exists
    const item = lookupItem(rootItemName);
    if (!item) {
      res.status(400).json({ error: `Unknown Minecraft item: "${rootItemName}"` });
      return;
    }

    // Create the project
    const sb = supabaseForUser(req.accessToken!);
    const { data: project, error: projError } = await sb
      .from('projects')
      .insert({
        name,
        description: description || `Crafting project for ${item.displayName}`,
        root_item_name: rootItemName,
        owner_id: req.userId!,
      })
      .select()
      .single();

    if (projError || !project) {
      res.status(500).json({ error: `Failed to create project: ${projError?.message}` });
      return;
    }

    // Parse the recipe tree and populate crafting_nodes
    const parseResult = await parseRecipeTree(project.id, rootItemName, quantity, sb, enchantments);

    res.status(201).json({
      project,
      tree: parseResult,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/projects/:projectId ───────────────────────────────
// Get project details with full crafting tree
router.get('/:projectId', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Fetch project
    const sb = supabaseForUser(req.accessToken!);
    const { data: project, error: projError } = await sb
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projError || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Fetch crafting tree
    const { data: nodes, error: nodesError } = await sb
      .from('crafting_nodes')
      .select('*')
      .eq('project_id', projectId)
      .order('depth', { ascending: true });

    if (nodesError) {
      res.status(500).json({ error: nodesError.message });
      return;
    }

    // Fetch members
    const { data: members } = await sb
      .from('project_members')
      .select(`
        user_id, role, joined_at,
        profiles!inner (full_name, email, avatar_url)
      `)
      .eq('project_id', projectId);

    res.json({
      project,
      nodes: nodes || [],
      members: members || [],
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── DELETE /api/projects/:projectId ────────────────────────────
// Delete a project (owner only)
router.delete('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const sb = supabaseForUser(req.accessToken!);
    const { error } = await sb
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('owner_id', req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/projects/:projectId/members ──────────────────────
// Add a member to the project (owner only)
router.post('/:projectId/members', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    // Verify ownership
    const sb = supabaseForUser(req.accessToken!);
    const { data: project } = await sb
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (!project || project.owner_id !== req.userId) {
      res.status(403).json({ error: 'Only the project owner can add members' });
      return;
    }

    // Find user by email
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      res.status(404).json({ error: 'User not found with that email' });
      return;
    }

    // Add member
    const { error } = await sb
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: profile.id,
        role: 'member',
      });

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'User is already a member' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ success: true, userId: profile.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/items/search?q=... ────────────────────────────────
// Search Minecraft items by name
router.get('/items/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (query.length < 2) {
    res.json({ items: [] });
    return;
  }
  const items = searchItems(query);
  res.json({ items });
});

// ── GET /api/items/:itemName ───────────────────────────────────
// Look up a specific Minecraft item
router.get('/items/:itemName', async (req: Request, res: Response) => {
  const item = lookupItem(req.params.itemName as string);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json(item);
});

export default router;
