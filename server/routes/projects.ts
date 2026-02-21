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
// Create a new project and parse the recipe tree(s)
// Supports single item (rootItemName) or multiple items (items array)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, rootItemName, quantity = 1, enchantments = null, items } = req.body;

    // Build the list of target items
    type TargetItem = { itemName: string; quantity: number; enchantments: { name: string; level: number }[] | null };
    let targets: TargetItem[] = [];

    if (Array.isArray(items) && items.length > 0) {
      targets = items.map((it: any) => ({
        itemName: it.itemName,
        quantity: it.quantity || 1,
        enchantments: it.enchantments || null,
      }));
    } else if (rootItemName) {
      targets = [{ itemName: rootItemName, quantity, enchantments }];
    }

    if (!name || targets.length === 0) {
      res.status(400).json({ error: 'name and at least one target item are required' });
      return;
    }

    // Validate all items exist
    for (const t of targets) {
      const item = lookupItem(t.itemName);
      if (!item) {
        res.status(400).json({ error: `Unknown Minecraft item: "${t.itemName}"` });
        return;
      }
    }

    const primaryItem = lookupItem(targets[0].itemName)!;

    // Create the project (root_item_name = first item for display)
    const sb = supabaseForUser(req.accessToken!);
    const { data: project, error: projError } = await sb
      .from('projects')
      .insert({
        name,
        description: description || (targets.length === 1
          ? `Crafting project for ${primaryItem.displayName}`
          : `Crafting project for ${targets.length} items`),
        root_item_name: targets[0].itemName,
        owner_id: req.userId!,
      })
      .select()
      .single();

    if (projError || !project) {
      res.status(500).json({ error: `Failed to create project: ${projError?.message}` });
      return;
    }

    // Parse recipe trees for all target items
    const trees = [];
    for (const t of targets) {
      const parseResult = await parseRecipeTree(project.id, t.itemName, t.quantity, sb, t.enchantments);
      trees.push(parseResult);
    }

    res.status(201).json({
      project,
      tree: trees[0],
      trees,
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

    // Fetch snapshot count
    const { count: snapshotCount } = await sb
      .from('plan_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    res.json({
      project,
      nodes: nodes || [],
      members: members || [],
      snapshotCount: snapshotCount || 0,
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

// ── PATCH /api/projects/:projectId/status ──────────────────────
// Update project status (owner only)
router.patch('/:projectId/status', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'completed', 'archived'].includes(status)) {
      res.status(400).json({ error: 'status must be active, completed, or archived' });
      return;
    }

    const sb = supabaseForUser(req.accessToken!);
    const { error } = await sb
      .from('projects')
      .update({ status, updated_at: new Date().toISOString() })
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
// Accepts { email, role? } — role defaults to 'member'
const VALID_ROLES = ['member', 'miner', 'builder', 'planner'] as const;

router.post('/:projectId/members', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { email, role = 'member' } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
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

    // Add member with chosen role
    const { error } = await sb
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: profile.id,
        role,
      });

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'User is already a member' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ success: true, userId: profile.id, role });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── PATCH /api/projects/:projectId/members/:userId/role ────────
// Update a member's role (owner only)
router.patch('/:projectId/members/:userId/role', async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    const sb = supabaseForUser(req.accessToken!);

    // Verify ownership
    const { data: project } = await sb
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (!project || project.owner_id !== req.userId) {
      res.status(403).json({ error: 'Only the project owner can update roles' });
      return;
    }

    // Can't change owner's role
    if (userId === project.owner_id) {
      res.status(400).json({ error: 'Cannot change the owner\'s role' });
      return;
    }

    const { error } = await sb
      .from('project_members')
      .update({ role })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/projects/:projectId/tasks ─────────────────────────
// Get suggested tasks for the current user based on their role
router.get('/:projectId/tasks', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const sb = supabaseForUser(req.accessToken!);

    // Get user's role
    const { data: membership } = await sb
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', req.userId!)
      .single();

    const role = membership?.role || 'member';

    // Get all nodes
    const { data: nodes } = await sb
      .from('crafting_nodes')
      .select('*')
      .eq('project_id', projectId)
      .order('depth', { ascending: true });

    if (!nodes || nodes.length === 0) {
      res.json({ role, tasks: [] });
      return;
    }

    // Build task suggestions based on role
    const incomplete = nodes.filter((n: any) => n.collected_qty < n.required_qty);
    const tasks: { id: string; action: string; item: string; displayName: string; qty: number; priority: 'high' | 'medium' | 'low'; reason: string }[] = [];

    if (role === 'miner' || role === 'member' || role === 'owner') {
      // Miners: focus on raw resources
      const resources = incomplete
        .filter((n: any) => n.is_resource)
        .sort((a: any, b: any) => (b.required_qty - b.collected_qty) - (a.required_qty - a.collected_qty));

      for (const r of resources.slice(0, 8)) {
        const remaining = r.required_qty - r.collected_qty;
        tasks.push({
          id: r.id,
          action: 'collect',
          item: r.item_name,
          displayName: r.display_name,
          qty: remaining,
          priority: remaining > 32 ? 'high' : remaining > 8 ? 'medium' : 'low',
          reason: `Need ${remaining} more ${r.display_name}`,
        });
      }
    }

    if (role === 'builder' || role === 'member' || role === 'owner') {
      // Builders: focus on craftable items whose children are done
      const craftable = incomplete.filter((n: any) => {
        if (n.is_resource) return false;
        const children = nodes.filter((c: any) => c.parent_id === n.id);
        return children.length > 0 && children.every((c: any) => c.collected_qty >= c.required_qty);
      });

      for (const c of craftable.slice(0, 6)) {
        const remaining = c.required_qty - c.collected_qty;
        tasks.push({
          id: c.id,
          action: 'craft',
          item: c.item_name,
          displayName: c.display_name,
          qty: remaining,
          priority: c.depth === 0 ? 'high' : c.depth <= 2 ? 'medium' : 'low',
          reason: `All ingredients ready — craft ${remaining}× ${c.display_name}`,
        });
      }
    }

    if (role === 'planner' || role === 'member' || role === 'owner') {
      // Planners: highlight bottlenecks and enchantment requirements
      const enchanted = nodes.filter((n: any) => n.enchantments && n.enchantments.length > 0 && n.collected_qty < n.required_qty);
      for (const e of enchanted.slice(0, 3)) {
        const enchLabels = (e.enchantments || []).map((en: any) => en.name.replace(/_/g, ' ')).join(', ');
        tasks.push({
          id: e.id,
          action: 'plan',
          item: e.item_name,
          displayName: e.display_name,
          qty: e.required_qty - e.collected_qty,
          priority: 'medium',
          reason: `Needs enchantments: ${enchLabels}`,
        });
      }

      // Also flag heavy-demand resources
      const heavyResources = incomplete
        .filter((n: any) => n.is_resource && (n.required_qty - n.collected_qty) > 16)
        .sort((a: any, b: any) => (b.required_qty - b.collected_qty) - (a.required_qty - a.collected_qty))
        .slice(0, 3);

      for (const r of heavyResources) {
        const already = tasks.find(t => t.id === r.id);
        if (!already) {
          tasks.push({
            id: r.id,
            action: 'review',
            item: r.item_name,
            displayName: r.display_name,
            qty: r.required_qty - r.collected_qty,
            priority: 'low',
            reason: `High-demand resource: ${r.required_qty - r.collected_qty} needed`,
          });
        }
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    res.json({ role, tasks });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/projects/:projectId/snapshots ────────────────────
// Save a snapshot of the current crafting plan (nodes + members + contributions)
router.post('/:projectId/snapshots', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { label } = req.body;
    const sb = supabaseForUser(req.accessToken!);

    // Get current project + nodes + members + contributions
    const [{ data: project }, { data: nodes }, { data: members }, { data: contributions }] = await Promise.all([
      sb.from('projects').select('plan_version').eq('id', projectId).single(),
      sb.from('crafting_nodes').select('id, project_id, parent_id, item_name, display_name, required_qty, collected_qty, is_resource, depth, status, enchantments').eq('project_id', projectId).order('depth'),
      sb.from('project_members').select('user_id, role').eq('project_id', projectId),
      sb.from('contributions').select('node_id, user_id, quantity, action, created_at').eq('project_id', projectId).order('created_at'),
    ]);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const newVersion = (project.plan_version || 0) + 1;

    // Build rich snapshot with nodes, members, and contributions
    const snapshotData = {
      nodes: (nodes || []).map((n: any) => ({
        ...n,
        // Ensure enchantments are stored as a proper object, not a string
        enchantments: typeof n.enchantments === 'string'
          ? (() => { try { return JSON.parse(n.enchantments); } catch { return null; } })()
          : n.enchantments || null,
      })),
      members: (members || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
      })),
      contributions: (contributions || []).map((c: any) => ({
        node_id: c.node_id,
        user_id: c.user_id,
        quantity: c.quantity,
        action: c.action,
        created_at: c.created_at,
      })),
    };

    // Save snapshot
    const { error: snapError } = await sb
      .from('plan_snapshots')
      .insert({
        project_id: projectId,
        version: newVersion,
        label: label || `Version ${newVersion}`,
        snapshot: snapshotData,
        created_by: req.userId!,
      });

    if (snapError) {
      res.status(500).json({ error: snapError.message });
      return;
    }

    // Bump project version
    await sb
      .from('projects')
      .update({ plan_version: newVersion })
      .eq('id', projectId);

    res.status(201).json({ success: true, version: newVersion });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/projects/:projectId/snapshots ─────────────────────
// List all plan snapshots
router.get('/:projectId/snapshots', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const sb = supabaseForUser(req.accessToken!);

    const { data, error } = await sb
      .from('plan_snapshots')
      .select('id, version, label, created_at, created_by')
      .eq('project_id', projectId)
      .order('version', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ snapshots: data || [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/projects/:projectId/snapshots/:version/restore ───
// Restore a previous plan snapshot (nodes, contributions, member roles)
router.post('/:projectId/snapshots/:version/restore', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const { projectId, version } = req.params;
    const sb = supabaseForUser(req.accessToken!);

    // Verify ownership
    const { data: project } = await sb
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (!project || project.owner_id !== req.userId) {
      res.status(403).json({ error: 'Only the project owner can restore snapshots' });
      return;
    }

    // Get snapshot
    const { data: snapshot } = await sb
      .from('plan_snapshots')
      .select('snapshot')
      .eq('project_id', projectId)
      .eq('version', Number(version))
      .single();

    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    // Handle both old format (plain array) and new format ({ nodes, members, contributions })
    const rawSnapshot = snapshot.snapshot as any;
    const isOldFormat = Array.isArray(rawSnapshot);
    const snapshotNodes: any[] = isOldFormat ? rawSnapshot : (rawSnapshot.nodes || []);
    const snapshotMembers: any[] = isOldFormat ? [] : (rawSnapshot.members || []);
    const snapshotContributions: any[] = isOldFormat ? [] : (rawSnapshot.contributions || []);

    // ─── 1. Delete current nodes (cascades contributions via FK) ───
    await sb
      .from('crafting_nodes')
      .delete()
      .eq('project_id', projectId);

    // ─── 2. Re-insert nodes level by level ─────────────────────────
    const oldIdToNew = new Map<string, string>();

    const maxDepth = snapshotNodes.length > 0
      ? Math.max(0, ...snapshotNodes.map((n: any) => n.depth))
      : 0;

    for (let d = 0; d <= maxDepth; d++) {
      const atDepth = snapshotNodes.filter((n: any) => n.depth === d);
      if (atDepth.length === 0) continue;

      const rows = atDepth.map((n: any) => {
        // Parse enchantments safely — avoid double-encoding
        let enchantments = n.enchantments;
        if (typeof enchantments === 'string') {
          try { enchantments = JSON.parse(enchantments); } catch { enchantments = null; }
        }
        // Ensure it's an array or null, not nested array
        if (Array.isArray(enchantments) && enchantments.length > 0 && Array.isArray(enchantments[0])) {
          enchantments = enchantments[0]; // unwrap accidental double-wrap
        }

        return {
          project_id: projectId,
          parent_id: n.parent_id ? oldIdToNew.get(n.parent_id) || null : null,
          item_name: n.item_name,
          display_name: n.display_name,
          required_qty: n.required_qty,
          collected_qty: n.collected_qty,
          is_resource: n.is_resource,
          depth: n.depth,
          status: n.status,
          enchantments: enchantments || null,
        };
      });

      const { data: inserted, error } = await sb
        .from('crafting_nodes')
        .insert(rows)
        .select('id');

      if (error) {
        res.status(500).json({ error: `Restore failed at depth ${d}: ${error.message}` });
        return;
      }

      if (inserted) {
        atDepth.forEach((n: any, i: number) => {
          oldIdToNew.set(n.id, inserted[i].id);
        });
      }
    }

    // ─── 3. Restore contributions with remapped node_ids ───────────
    if (snapshotContributions.length > 0) {
      // Build contribution rows with updated node_ids
      const contribRows = snapshotContributions
        .filter((c: any) => c.action !== 'restored') // skip old restore markers
        .map((c: any) => {
          const newNodeId = oldIdToNew.get(c.node_id);
          if (!newNodeId) return null; // skip if node wasn't in snapshot
          return {
            project_id: projectId,
            node_id: newNodeId,
            user_id: c.user_id,
            quantity: c.quantity,
            action: c.action,
            created_at: c.created_at,
          };
        })
        .filter(Boolean);

      if (contribRows.length > 0) {
        // Insert in batches to avoid payload limits
        const BATCH = 200;
        for (let i = 0; i < contribRows.length; i += BATCH) {
          const batch = contribRows.slice(i, i + BATCH);
          await sb.from('contributions').insert(batch);
        }
      }
    }

    // ─── 4. Add a "restored" activity entry ────────────────────────
    // Find a root node to attach the restore event to
    const rootNodeOldId = snapshotNodes.find((n: any) => n.depth === 0)?.id;
    const rootNodeNewId = rootNodeOldId ? oldIdToNew.get(rootNodeOldId) : null;
    if (rootNodeNewId) {
      await sb.from('contributions').insert({
        project_id: projectId,
        node_id: rootNodeNewId,
        user_id: req.userId!,
        quantity: Number(version),
        action: 'restored',
      });
    }

    // ─── 5. Restore member roles ───────────────────────────────────
    if (snapshotMembers.length > 0) {
      for (const m of snapshotMembers) {
        // Don't change owner role
        if (m.role === 'owner') continue;
        await sb
          .from('project_members')
          .update({ role: m.role })
          .eq('project_id', projectId)
          .eq('user_id', m.user_id);
      }
    }

    res.json({
      success: true,
      restoredVersion: Number(version),
      nodesRestored: snapshotNodes.length,
      contributionsRestored: snapshotContributions.length,
      membersRestored: snapshotMembers.length,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── PATCH /api/projects/:projectId/nodes/:nodeId/enchantments ──
// Update enchantment levels on a crafting node
router.patch('/:projectId/nodes/:nodeId/enchantments', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const { projectId, nodeId } = req.params;
    const { enchantments } = req.body;

    if (!Array.isArray(enchantments)) {
      res.status(400).json({ error: 'enchantments must be an array of { name, level }' });
      return;
    }

    // Validate each enchantment has name and level
    for (const e of enchantments) {
      if (!e.name || typeof e.level !== 'number' || e.level < 1) {
        res.status(400).json({ error: `Invalid enchantment: ${JSON.stringify(e)}` });
        return;
      }
    }

    const sb = supabaseForUser(req.accessToken!);

    // Verify the node belongs to this project
    const { data: node, error: nodeError } = await sb
      .from('crafting_nodes')
      .select('id, enchantments')
      .eq('id', nodeId)
      .eq('project_id', projectId)
      .single();

    if (nodeError || !node) {
      res.status(404).json({ error: 'Node not found in this project' });
      return;
    }

    // Update enchantments
    const { error: updateError } = await sb
      .from('crafting_nodes')
      .update({ enchantments })
      .eq('id', nodeId);

    if (updateError) {
      res.status(500).json({ error: `Failed to update enchantments: ${updateError.message}` });
      return;
    }

    res.json({ success: true, enchantments });
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
