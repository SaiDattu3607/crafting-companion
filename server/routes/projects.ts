/**
 * Project Routes
 * 
 * CRUD for projects, recipe parsing, and member management.
 */

import { Router, Request, Response } from 'express';
import { supabaseForUser } from '../config/supabase.js';
import { authMiddleware, projectMemberGuard } from '../middleware/auth.js';
import { parseRecipeTree, searchItems, lookupItem, getEnchantmentMaxLevel, getEnchantmentMinLevel, mcData } from '../services/recipeParser.js';

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
    type TargetItem = { itemName: string; quantity: number; enchantments: { name: string; level: number }[] | null; variant: string | null };
    let targets: TargetItem[] = [];

    if (Array.isArray(items) && items.length > 0) {
      targets = items.map((it: any) => ({
        itemName: it.itemName,
        quantity: it.quantity || 1,
        enchantments: it.enchantments || null,
        variant: it.variant || null,
      }));
    } else if (rootItemName) {
      targets = [{ itemName: rootItemName, quantity, enchantments, variant: req.body.variant || null }];
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
      const parseResult = await parseRecipeTree(project.id, t.itemName, t.quantity, sb, t.enchantments, t.variant);
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

// ═══════════════════════════════════════════════════════════════
//  INVITE ROUTES (must be before /:projectId to avoid catch-all)
// ═══════════════════════════════════════════════════════════════

// ── GET /api/projects/invites/pending ──────────────────────────
// Get all pending invites for the current user
router.get('/invites/pending', async (req: Request, res: Response) => {
  try {
    const sb = supabaseForUser(req.accessToken!);

    const { data, error } = await sb
      .from('project_invites')
      .select(`
        id,
        project_id,
        inviter_id,
        role,
        message,
        status,
        created_at,
        projects ( id, name, description ),
        inviter:profiles!project_invites_inviter_id_fkey ( id, full_name, email, avatar_url )
      `)
      .eq('invitee_id', req.userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ invites: data || [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/projects/invites/:inviteId/accept ────────────────
router.post('/invites/:inviteId/accept', async (req: Request, res: Response) => {
  try {
    const { inviteId } = req.params;
    const sb = supabaseForUser(req.accessToken!);

    const { data: invite, error: fetchErr } = await sb
      .from('project_invites')
      .select('id, project_id, invitee_id, role, status')
      .eq('id', inviteId)
      .single();

    if (fetchErr || !invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    if (invite.invitee_id !== req.userId) {
      res.status(403).json({ error: 'This invite is not for you' });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(400).json({ error: `Invite has already been ${invite.status}` });
      return;
    }

    const { error: memberErr } = await sb
      .from('project_members')
      .insert({
        project_id: invite.project_id,
        user_id: req.userId,
        role: invite.role,
      });

    if (memberErr && memberErr.code !== '23505') {
      res.status(500).json({ error: memberErr.message });
      return;
    }

    const { error: updateErr } = await sb
      .from('project_invites')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }

    res.json({ success: true, projectId: invite.project_id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/projects/invites/:inviteId/decline ───────────────
router.post('/invites/:inviteId/decline', async (req: Request, res: Response) => {
  try {
    const { inviteId } = req.params;
    const sb = supabaseForUser(req.accessToken!);

    const { data: invite, error: fetchErr } = await sb
      .from('project_invites')
      .select('id, invitee_id, status')
      .eq('id', inviteId)
      .single();

    if (fetchErr || !invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    if (invite.invitee_id !== req.userId) {
      res.status(403).json({ error: 'This invite is not for you' });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(400).json({ error: `Invite has already been ${invite.status}` });
      return;
    }

    const { error: updateErr } = await sb
      .from('project_invites')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }

    res.json({ success: true });
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
        profiles!inner (full_name, email, avatar_url, last_active_at, minecraft_level)
      `)
      .eq('project_id', projectId);

    // Fetch snapshot count
    const { count: snapshotCount } = await sb
      .from('plan_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    res.json({
      project,
      nodes: (nodes || []).map((n: any) => ({
        ...n,
        is_block: n.is_block ?? !!(mcData.blocksByName[n.item_name])
      })),
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

// ── POST /api/projects/:projectId/items ────────────────────────
// Add a new target item to an existing project
router.post('/:projectId/items', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { itemName, quantity = 1, enchantments = null, variant = null } = req.body;

    if (!itemName) {
      res.status(400).json({ error: 'itemName is required' });
      return;
    }

    const item = lookupItem(itemName);
    if (!item) {
      res.status(400).json({ error: `Unknown Minecraft item: "${itemName}"` });
      return;
    }

    const sb = supabaseForUser(req.accessToken!);

    // Verify project exists
    const { data: project } = await sb
      .from('projects')
      .select('id, owner_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Parse and insert the new item's recipe tree
    const parseResult = await parseRecipeTree(projectId, itemName as string, quantity, sb, enchantments, variant);

    res.status(201).json({
      success: true,
      tree: parseResult,
    });
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
// Update a member's role
router.patch('/:projectId/members/:userId/role', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    const sb = supabaseForUser(req.accessToken!);

    // Verify the caller is the project owner OR changing their own role
    const { data: project } = await sb
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const isProjectOwner = project.owner_id === req.userId;
    const isSelf = userId === req.userId;

    if (!isProjectOwner && !isSelf) {
      res.status(403).json({ error: 'Only the project owner or yourself can update roles' });
      return;
    }

    // Owner can change their own role (for task specialization)
    // RLS policy now allows owners to update any member & members to update self
    const { error } = await sb
      .from('project_members')
      .update({ role })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Role] Update error:', error.message);
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

    // Role-specific tasks: each role sees ONLY their relevant tasks
    // 'member' and 'owner' see a general mix (fallback)
    if (role === 'miner') {
      // Miners: focus on raw resources only
      const resources = incomplete
        .filter((n: any) => n.is_resource)
        .sort((a: any, b: any) => (b.required_qty - b.collected_qty) - (a.required_qty - a.collected_qty));

      for (const r of resources.slice(0, 10)) {
        const remaining = r.required_qty - r.collected_qty;
        tasks.push({
          id: r.id,
          action: 'collect',
          item: r.item_name,
          displayName: r.display_name,
          qty: remaining,
          priority: remaining > 32 ? 'high' : remaining > 8 ? 'medium' : 'low',
          reason: `Mine/collect ${remaining} more ${r.display_name}`,
        });
      }
    } else if (role === 'builder') {
      // Builders: focus on craftable items whose children are done
      const craftable = incomplete.filter((n: any) => {
        if (n.is_resource) return false;
        const children = nodes.filter((c: any) => c.parent_id === n.id);
        return children.length > 0 && children.every((c: any) => c.collected_qty >= c.required_qty);
      });

      for (const c of craftable.slice(0, 8)) {
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
    } else if (role === 'planner') {
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

      // Flag heavy-demand resources for planning
      const heavyResources = incomplete
        .filter((n: any) => n.is_resource && (n.required_qty - n.collected_qty) > 16)
        .sort((a: any, b: any) => (b.required_qty - b.collected_qty) - (a.required_qty - a.collected_qty))
        .slice(0, 5);

      for (const r of heavyResources) {
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

      // Also flag items that are close to being craftable (almost ready)
      const almostReady = incomplete.filter((n: any) => {
        if (n.is_resource) return false;
        const children = nodes.filter((c: any) => c.parent_id === n.id);
        if (children.length === 0) return false;
        const doneCount = children.filter((c: any) => c.collected_qty >= c.required_qty).length;
        return doneCount > 0 && doneCount < children.length; // partially done
      }).slice(0, 4);

      for (const a of almostReady) {
        const children = nodes.filter((c: any) => c.parent_id === a.id);
        const doneCount = children.filter((c: any) => c.collected_qty >= c.required_qty).length;
        tasks.push({
          id: a.id,
          action: 'review',
          item: a.item_name,
          displayName: a.display_name,
          qty: a.required_qty - a.collected_qty,
          priority: 'medium',
          reason: `${doneCount}/${children.length} ingredients ready — coordinate remaining`,
        });
      }
    } else {
      // 'member' or 'owner' (hasn't picked a specialization) — show a general mix
      const resources = incomplete
        .filter((n: any) => n.is_resource)
        .sort((a: any, b: any) => (b.required_qty - b.collected_qty) - (a.required_qty - a.collected_qty));

      for (const r of resources.slice(0, 5)) {
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

      const craftable = incomplete.filter((n: any) => {
        if (n.is_resource) return false;
        const children = nodes.filter((c: any) => c.parent_id === n.id);
        return children.length > 0 && children.every((c: any) => c.collected_qty >= c.required_qty);
      });

      for (const c of craftable.slice(0, 4)) {
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

    // Log a "saved" activity entry in the feed
    const rootNode = (nodes || []).find((n: any) => n.depth === 0);
    if (rootNode) {
      await sb.from('contributions').insert({
        project_id: projectId,
        node_id: rootNode.id,
        user_id: req.userId!,
        quantity: newVersion,
        action: 'saved',
      });
    }

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
// Restore uses the authenticated user's client — RLS policies allow owners to
// DELETE nodes, INSERT nodes/contributions, and UPDATE member roles.
router.post('/:projectId/snapshots/:version/restore', projectMemberGuard, async (req: Request, res: Response) => {
  try {
    const { projectId, version } = req.params;
    const sb = supabaseForUser(req.accessToken!);

    // Verify ownership (via user's client for proper RLS)
    const { data: project } = await sb
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (!project || project.owner_id !== req.userId) {
      res.status(403).json({ error: 'Only the project owner can restore snapshots' });
      return;
    }

    // Get snapshot — try user client first (has RLS read access), fall back to admin
    let snapshot: any = null;
    const { data: snapData, error: snapErr1 } = await sb
      .from('plan_snapshots')
      .select('snapshot')
      .eq('project_id', projectId)
      .eq('version', Number(version))
      .maybeSingle();

    if (snapErr1 || !snapData) {
      console.error('[Restore] Snapshot not found:', snapErr1?.message);
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }
    snapshot = snapData;

    // Handle both old format (plain array) and new format ({ nodes, members, contributions })
    const rawSnapshot = snapshot.snapshot as any;
    const isOldFormat = Array.isArray(rawSnapshot);
    const snapshotNodes: any[] = isOldFormat ? rawSnapshot : (rawSnapshot.nodes || []);
    const snapshotMembers: any[] = isOldFormat ? [] : (rawSnapshot.members || []);
    const snapshotContributions: any[] = isOldFormat ? [] : (rawSnapshot.contributions || []);

    console.log(`[Restore] Project ${projectId} → v${version}: ${snapshotNodes.length} nodes, ${snapshotMembers.length} members, ${snapshotContributions.length} contributions`);

    // ─── 1. Delete current nodes (cascades contributions via FK) ───
    // RLS policy now allows project owners to delete nodes
    const { error: deleteErr } = await sb
      .from('crafting_nodes')
      .delete()
      .eq('project_id', projectId);

    if (deleteErr) {
      console.error('[Restore] Delete nodes error:', deleteErr.message);
      res.status(500).json({ error: `Failed to clear current nodes: ${deleteErr.message}` });
      return;
    }

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
        console.error(`[Restore] Insert nodes depth ${d} error:`, error.message);
        res.status(500).json({ error: `Restore failed at depth ${d}: ${error.message}` });
        return;
      }

      if (inserted) {
        atDepth.forEach((n: any, i: number) => {
          oldIdToNew.set(n.id, inserted[i].id);
        });
      }
    }

    console.log(`[Restore] Inserted ${oldIdToNew.size} nodes`);

    // ─── 3. Restore contributions with remapped node_ids ───────────
    // RLS policy now allows project owners to insert contributions for any user
    if (snapshotContributions.length > 0) {
      const contribRows = snapshotContributions
        .filter((c: any) => c.action !== 'restored') // skip old restore markers
        .map((c: any) => {
          const newNodeId = oldIdToNew.get(c.node_id);
          if (!newNodeId) return null;
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
        const BATCH = 200;
        for (let i = 0; i < contribRows.length; i += BATCH) {
          const batch = contribRows.slice(i, i + BATCH);
          const { error: contribErr } = await sb.from('contributions').insert(batch);
          if (contribErr) {
            console.error('[Restore] Insert contributions error:', contribErr.message);
          }
        }
      }
      console.log(`[Restore] Restored ${contribRows.length} contributions`);
    }

    // ─── 4. Add a "restored" activity entry ────────────────────────
    const rootNodeOldId = snapshotNodes.find((n: any) => n.depth === 0)?.id;
    const rootNodeNewId = rootNodeOldId ? oldIdToNew.get(rootNodeOldId) : null;
    if (rootNodeNewId) {
      const { error: restoreLogErr } = await sb.from('contributions').insert({
        project_id: projectId,
        node_id: rootNodeNewId,
        user_id: req.userId!,
        quantity: Number(version),
        action: 'restored',
      });
      if (restoreLogErr) {
        console.error('[Restore] Log restore event error:', restoreLogErr.message);
      }
    }

    // ─── 5. Restore member roles ───────────────────────────────────
    // RLS policy allows project owners to update any member's role
    if (snapshotMembers.length > 0) {
      for (const m of snapshotMembers) {
        if (m.role === 'owner') continue;
        const { error: roleErr } = await sb
          .from('project_members')
          .update({ role: m.role })
          .eq('project_id', projectId)
          .eq('user_id', m.user_id);
        if (roleErr) {
          console.error(`[Restore] Role update error for ${m.user_id}:`, roleErr.message);
        }
      }
      console.log(`[Restore] Restored ${snapshotMembers.length} member roles`);
    }

    console.log(`[Restore] ✓ Complete — v${version} restored for project ${projectId}`);

    res.json({
      success: true,
      restoredVersion: Number(version),
      nodesRestored: snapshotNodes.length,
      contributionsRestored: snapshotContributions.length,
      membersRestored: snapshotMembers.length,
    });
  } catch (err) {
    console.error('[Restore] Uncaught error:', (err as Error).message);
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
      const maxLevel = getEnchantmentMaxLevel(e.name);
      if (maxLevel && e.level > maxLevel) {
        res.status(400).json({ error: `${e.name.replace(/_/g, ' ')} has a max level of ${maxLevel}`, maxLevel, enchantment: e.name });
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

// ═══════════════════════════════════════════════════════════════
//  INVITE SYSTEM
// ═══════════════════════════════════════════════════════════════

// ── POST /api/projects/:projectId/invite ───────────────────────
// Send an invite to a user (owner only). Creates a pending invite row.
router.post('/:projectId/invite', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { email, role = 'member', message = '' } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    const sb = supabaseForUser(req.accessToken!);

    // Verify ownership
    const { data: project } = await sb
      .from('projects')
      .select('owner_id, name')
      .eq('id', projectId)
      .single();

    if (!project || project.owner_id !== req.userId) {
      res.status(403).json({ error: 'Only the project owner can send invites' });
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

    if (profile.id === req.userId) {
      res.status(400).json({ error: 'You cannot invite yourself' });
      return;
    }

    // Check if already a member
    const { data: existingMember } = await sb
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', profile.id)
      .single();

    if (existingMember) {
      res.status(409).json({ error: 'User is already a member of this project' });
      return;
    }

    // Check for existing pending invite
    const { data: existingInvite } = await sb
      .from('project_invites')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('invitee_id', profile.id)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      res.status(409).json({ error: 'An invite is already pending for this user' });
      return;
    }

    // Create the invite
    const { data: invite, error } = await sb
      .from('project_invites')
      .insert({
        project_id: projectId,
        inviter_id: req.userId,
        invitee_id: profile.id,
        role,
        message: message || null,
      })
      .select('id, role, message, created_at')
      .single();

    if (error) {
      // unique constraint violation — delete the old declined invite and re-create
      if (error.code === '23505') {
        await sb
          .from('project_invites')
          .delete()
          .eq('project_id', projectId)
          .eq('invitee_id', profile.id);

        const { error: retryErr } = await sb
          .from('project_invites')
          .insert({
            project_id: projectId,
            inviter_id: req.userId,
            invitee_id: profile.id,
            role,
            message: message || null,
          });

        if (retryErr) {
          res.status(500).json({ error: retryErr.message });
          return;
        }
        res.status(201).json({ success: true, reinvited: true });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ success: true, invite });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── PATCH /api/profile ─────────────────────────────────────────
// Update the authenticated user's profile (e.g. minecraft_level)
router.patch('/profile', async (req: Request, res: Response) => {
  try {
    const { minecraft_level } = req.body;
    const updates: Record<string, any> = {};
    if (typeof minecraft_level === 'number' && minecraft_level >= 0) {
      updates.minecraft_level = Math.floor(minecraft_level);
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }
    const sb = supabaseForUser(req.accessToken!);
    const { data, error } = await sb
      .from('profiles')
      .update(updates)
      .eq('id', req.userId!)
      .select('id, minecraft_level')
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/profile ───────────────────────────────────────────
// Get the authenticated user's profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const sb = supabaseForUser(req.accessToken!);
    const { data, error } = await sb
      .from('profiles')
      .select('id, full_name, email, avatar_url, minecraft_level')
      .eq('id', req.userId!)
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/enchantment-levels ────────────────────────────────
// Get XP level requirements for all enchantments
router.get('/enchantment-levels', async (_req: Request, res: Response) => {
  const enchantmentsArray: any[] = (require('minecraft-data') as any)('1.20').enchantmentsArray || [];
  const result: Record<string, { maxLevel: number; levelRequirements: number[] }> = {};
  for (const e of enchantmentsArray) {
    const reqs: number[] = [];
    for (let i = 1; i <= (e.maxLevel || 1); i++) {
      reqs.push(getEnchantmentMinLevel(e.name, i));
    }
    result[e.name] = { maxLevel: e.maxLevel || 1, levelRequirements: reqs };
  }
  res.json(result);
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
