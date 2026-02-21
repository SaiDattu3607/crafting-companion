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
