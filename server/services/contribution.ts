/**
 * CraftChain Contribution Service
 * 
 * Handles the logic for contributing items to a project.
 * Implements the "Contribution Guard" — if the item being crafted
 * is NOT a raw resource, all its child nodes must be completed first.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ContributeRequest {
  projectId: string;
  nodeId: string;
  userId: string;
  quantity: number;
  action: 'collected' | 'crafted';
}

export interface ContributeResult {
  success: boolean;
  error?: string;
  node?: {
    id: string;
    item_name: string;
    display_name: string;
    collected_qty: number;
    required_qty: number;
    status: string;
  };
  contribution?: {
    id: string;
    quantity: number;
    action: string;
  };
}

/**
 * The Contribution Guard + Execution
 *
 * 1. Checks if the user is a member of the project (done in middleware)
 * 2. Fetches the target node
 * 3. If the node is NOT a raw resource, verifies all children are complete
 * 4. Updates collected_qty and status
 * 5. Records the contribution
 */
export async function contribute(req: ContributeRequest, supabase: SupabaseClient): Promise<ContributeResult> {
  const { projectId, nodeId, userId, quantity, action } = req;

  if (quantity <= 0) {
    return { success: false, error: 'Quantity must be positive' };
  }

  // 1. Fetch the target node
  const { data: node, error: nodeError } = await supabase
    .from('crafting_nodes')
    .select('*')
    .eq('id', nodeId)
    .eq('project_id', projectId)
    .single();

  if (nodeError || !node) {
    return { success: false, error: 'Node not found in this project' };
  }

  // 2. Check if already completed
  if (node.collected_qty >= node.required_qty) {
    return { success: false, error: `"${node.display_name}" is already completed` };
  }

  // 3. CONTRIBUTION GUARD: If not a raw resource, verify children
  if (!node.is_resource) {
    const { data: children, error: childError } = await supabase
      .from('crafting_nodes')
      .select('id, item_name, display_name, required_qty, collected_qty')
      .eq('parent_id', nodeId);

    if (childError) {
      return { success: false, error: 'Failed to check child dependencies' };
    }

    if (children && children.length > 0) {
      const incompleteChildren = children.filter(
        (c: any) => c.collected_qty < c.required_qty
      );

      if (incompleteChildren.length > 0) {
        const missing = incompleteChildren
          .map((c: any) => `${c.display_name} (${c.collected_qty}/${c.required_qty})`)
          .join(', ');
        return {
          success: false,
          error: `Cannot craft "${node.display_name}" — incomplete dependencies: ${missing}`,
        };
      }
    }
  }

  // 4. Update the node's collected_qty
  const newCollectedQty = Math.min(node.collected_qty + quantity, node.required_qty);
  const newStatus = newCollectedQty >= node.required_qty ? 'completed' : 'in_progress';

  const { error: updateError } = await supabase
    .from('crafting_nodes')
    .update({
      collected_qty: newCollectedQty,
      status: newStatus,
    })
    .eq('id', nodeId);

  if (updateError) {
    return { success: false, error: `Failed to update node: ${updateError.message}` };
  }

  // 5. Record the contribution
  const { data: contribution, error: contribError } = await supabase
    .from('contributions')
    .insert({
      project_id: projectId,
      node_id: nodeId,
      user_id: userId,
      quantity,
      action,
    })
    .select('id, quantity, action')
    .single();

  if (contribError) {
    return { success: false, error: `Contribution saved but log failed: ${contribError.message}` };
  }

  // 5.b Record Milestone if completed
  if (newStatus === 'completed') {
    const { error: milestoneError } = await supabase
      .from('contributions')
      .insert({
        project_id: projectId,
        node_id: nodeId,
        user_id: userId,
        quantity: node.required_qty,
        action: 'milestone',
      });

    if (milestoneError) {
      console.error('[Milestone] Error logging milestone:', milestoneError.message);
    }
  }

  // 6. Check if parent can now be auto-unlocked (optional status change)
  if (node.parent_id && newStatus === 'completed') {
    await checkAndUpdateParentStatus(node.parent_id, supabase);
  }

  // 7. Auto-complete enchanting table + lapis when all enchanted books are collected.
  //    Once all books are done, the player only needs the anvil to apply them,
  //    so the enchanting station items become unnecessary.
  if (node.item_name === 'enchanted_book' && newStatus === 'completed' && node.parent_id) {
    await autoCompleteEnchantingDeps(projectId, node.parent_id, userId, supabase);
  }

  return {
    success: true,
    node: {
      id: nodeId,
      item_name: node.item_name,
      display_name: node.display_name,
      collected_qty: newCollectedQty,
      required_qty: node.required_qty,
      status: newStatus,
    },
    contribution: contribution || undefined,
  };
}

/**
 * When a child is completed, check if all siblings are complete.
 * If so, mark the parent as "in_progress" (ready to craft).
 */
async function checkAndUpdateParentStatus(parentId: string, supabase: SupabaseClient) {
  const { data: siblings, error } = await supabase
    .from('crafting_nodes')
    .select('id, collected_qty, required_qty')
    .eq('parent_id', parentId);

  if (error || !siblings) return;

  const allComplete = siblings.every((s: any) => s.collected_qty >= s.required_qty);

  if (allComplete) {
    // All children are done — mark parent as "in_progress" (ready to craft)
    await supabase
      .from('crafting_nodes')
      .update({ status: 'in_progress' })
      .eq('id', parentId)
      .eq('status', 'pending'); // only if it was still pending
  }
}

/**
 * When all enchanted book siblings under a parent are collected,
 * DELETE the enchanting table + lapis lazuli nodes (and their children),
 * then INSERT an anvil node with its crafting sub-tree.
 */
async function autoCompleteEnchantingDeps(
  projectId: string,
  parentId: string,
  userId: string,
  supabase: SupabaseClient
) {
  // 1. Get all siblings under this parent
  const { data: siblings, error } = await supabase
    .from('crafting_nodes')
    .select('id, item_name, collected_qty, required_qty, depth')
    .eq('parent_id', parentId)
    .eq('project_id', projectId);

  if (error || !siblings) return;

  // 2. Check if ALL enchanted book siblings are fully collected
  const bookNodes = siblings.filter((s: any) => s.item_name === 'enchanted_book');
  if (bookNodes.length === 0) return;
  const allBooksCollected = bookNodes.every((b: any) => b.collected_qty >= b.required_qty);
  if (!allBooksCollected) return;

  // 3. Check if anvil already exists (avoid duplicates on repeat calls)
  const anvilExists = siblings.some((s: any) => s.item_name === 'anvil');
  if (anvilExists) return;

  // 4. Find enchanting_table and lapis_lazuli nodes to delete
  const enchantingItems = ['enchanting_table', 'lapis_lazuli'];
  const toDelete = siblings.filter(
    (s: any) => enchantingItems.includes(s.item_name)
  );

  console.log(`[EnchantSwap] All books collected — removing enchanting table/lapis, adding anvil`);

  // 5. Delete enchanting table + lapis nodes and ALL their descendants
  for (const node of toDelete) {
    await deleteNodeTree(projectId, node.id, supabase);
  }

  // 6. Get the parent node's depth for the anvil
  const parentDepth = (siblings[0]?.depth ?? 1); // siblings are at parentDepth, anvil goes at same level
  const anvilDepth = parentDepth;

  // 7. Insert anvil node with its crafting sub-tree
  //    Anvil recipe: 3 iron_block + 4 iron_ingot
  //    iron_block recipe: 9 iron_ingot each → 3 × 9 = 27 iron_ingot
  //    Total iron_ingot: 27 + 4 = 31

  // Insert the anvil node (craftable, not resource)
  const { data: anvilNode, error: anvilErr } = await supabase
    .from('crafting_nodes')
    .insert({
      project_id: projectId,
      parent_id: parentId,
      item_name: 'anvil',
      display_name: 'Anvil',
      required_qty: 1,
      collected_qty: 0,
      is_resource: false,
      is_block: true,
      depth: anvilDepth,
      status: 'pending',
    })
    .select('id')
    .single();

  if (anvilErr || !anvilNode) {
    console.error('[EnchantSwap] Failed to insert anvil node:', anvilErr?.message);
    return;
  }

  const anvilId = anvilNode.id;
  const childDepth = anvilDepth + 1;

  // Insert iron_block node (craftable, 3 needed)
  const { data: ironBlockNode, error: ibErr } = await supabase
    .from('crafting_nodes')
    .insert({
      project_id: projectId,
      parent_id: anvilId,
      item_name: 'iron_block',
      display_name: 'Iron Block',
      required_qty: 3,
      collected_qty: 0,
      is_resource: false,
      is_block: true,
      depth: childDepth,
      status: 'pending',
    })
    .select('id')
    .single();

  if (!ibErr && ironBlockNode) {
    // Insert iron_ingot for iron blocks (9 per block × 3 = 27)
    await supabase
      .from('crafting_nodes')
      .insert({
        project_id: projectId,
        parent_id: ironBlockNode.id,
        item_name: 'iron_ingot',
        display_name: 'Iron Ingot',
        required_qty: 27,
        collected_qty: 0,
        is_resource: true,
        is_block: false,
        depth: childDepth + 1,
        status: 'pending',
      });
  }

  // Insert iron_ingot node for anvil directly (4 needed)
  await supabase
    .from('crafting_nodes')
    .insert({
      project_id: projectId,
      parent_id: anvilId,
      item_name: 'iron_ingot',
      display_name: 'Iron Ingot',
      required_qty: 4,
      collected_qty: 0,
      is_resource: true,
      is_block: false,
      depth: childDepth,
      status: 'pending',
    });
}

/**
 * Recursively delete a node and all its descendants from the database.
 */
async function deleteNodeTree(
  projectId: string,
  nodeId: string,
  supabase: SupabaseClient
) {
  // First, find and delete all children recursively
  const { data: children } = await supabase
    .from('crafting_nodes')
    .select('id')
    .eq('parent_id', nodeId)
    .eq('project_id', projectId);

  if (children) {
    for (const child of children) {
      await deleteNodeTree(projectId, child.id, supabase);
    }
  }

  // Then delete this node
  await supabase
    .from('crafting_nodes')
    .delete()
    .eq('id', nodeId)
    .eq('project_id', projectId);
}

/**
 * Get the full contribution history for a project
 */
export async function getProjectContributions(projectId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('contributions')
    .select(`
      id,
      quantity,
      action,
      created_at,
      user_id,
      node_id,
      crafting_nodes!inner (
        item_name,
        display_name
      ),
      profiles!inner (
        full_name,
        email
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch contributions: ${error.message}`);
  }

  return data;
}

/**
 * Get contribution leaderboard for a project
 */
export async function getContributionLeaderboard(projectId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('contributions')
    .select(`
      user_id,
      quantity,
      profiles!inner (
        full_name,
        email,
        avatar_url
      )
    `)
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }

  // Aggregate by user
  const userMap = new Map<string, { full_name: string; email: string; avatar_url: string | null; total_contributions: number }>();

  for (const row of data || []) {
    const existing = userMap.get(row.user_id);
    const profile = row.profiles as any;
    if (existing) {
      existing.total_contributions += row.quantity;
    } else {
      userMap.set(row.user_id, {
        full_name: profile.full_name || profile.email,
        email: profile.email,
        avatar_url: profile.avatar_url,
        total_contributions: row.quantity,
      });
    }
  }

  return Array.from(userMap.entries())
    .map(([userId, info]) => ({ userId, ...info }))
    .sort((a, b) => b.total_contributions - a.total_contributions);
}
