/**
 * CraftChain Bottleneck Service
 * 
 * Identifies which raw resources are currently blocking the most progress.
 * Uses the Supabase RPC function find_bottleneck() defined in the migration.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface BottleneckItem {
  node_id: string;
  item_name: string;
  display_name: string;
  required_qty: number;
  collected_qty: number;
  remaining_qty: number;
  blocked_ancestors: number;
}

/**
 * Calls the find_bottleneck RPC function in Supabase.
 * Returns the top blocking raw resources for a project.
 */
export async function findBottleneck(projectId: string, supabase: SupabaseClient): Promise<BottleneckItem[]> {
  const { data, error } = await supabase
    .rpc('find_bottleneck', { p_project_id: projectId });

  if (error) {
    // Fallback: compute bottleneck in JS if RPC not yet deployed
    console.warn('RPC find_bottleneck failed, using JS fallback:', error.message);
    return findBottleneckFallback(projectId, supabase);
  }

  return data || [];
}

/**
 * JavaScript fallback for bottleneck finding (if the SQL RPC isn't deployed yet).
 * Walks the tree in-memory.
 */
async function findBottleneckFallback(projectId: string, supabase: SupabaseClient): Promise<BottleneckItem[]> {
  // Fetch all nodes for this project
  const { data: nodes, error } = await supabase
    .from('crafting_nodes')
    .select('*')
    .eq('project_id', projectId);

  if (error || !nodes) {
    throw new Error(`Failed to fetch nodes: ${error?.message}`);
  }

  // Find incomplete resources
  const incompleteResources = nodes.filter(
    (n: any) => n.is_resource && n.collected_qty < n.required_qty
  );

  // For each incomplete resource, count how many ancestors are blocked
  const results: BottleneckItem[] = [];

  for (const resource of incompleteResources) {
    let blockedCount = 0;
    let currentId = resource.parent_id;

    // Walk up the tree
    const visited = new Set<string>();
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const parent = nodes.find((n: any) => n.id === currentId);
      if (!parent || parent.status === 'completed') break;

      blockedCount++;
      currentId = parent.parent_id;
    }

    results.push({
      node_id: resource.id,
      item_name: resource.item_name,
      display_name: resource.display_name,
      required_qty: resource.required_qty,
      collected_qty: resource.collected_qty,
      remaining_qty: resource.required_qty - resource.collected_qty,
      blocked_ancestors: blockedCount,
    });
  }

  // Sort by most blocked ancestors, then by remaining quantity
  results.sort((a, b) =>
    b.blocked_ancestors - a.blocked_ancestors ||
    b.remaining_qty - a.remaining_qty
  );

  return results.slice(0, 10);
}

/**
 * Get overall project progress using the RPC or fallback.
 */
export async function getProjectProgress(projectId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .rpc('get_project_progress', { p_project_id: projectId });

  if (error) {
    // Fallback: compute in JS
    const { data: nodes } = await supabase
      .from('crafting_nodes')
      .select('is_resource, required_qty, collected_qty')
      .eq('project_id', projectId);

    if (!nodes) return { total_nodes: 0, completed_nodes: 0, progress_pct: 0 };

    const total = nodes.length;
    const completed = nodes.filter((n: any) => n.collected_qty >= n.required_qty).length;
    const totalResources = nodes.filter((n: any) => n.is_resource).length;
    const completedResources = nodes.filter((n: any) => n.is_resource && n.collected_qty >= n.required_qty).length;

    return {
      total_nodes: total,
      completed_nodes: completed,
      total_resources: totalResources,
      completed_resources: completedResources,
      progress_pct: total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0,
    };
  }

  return data?.[0] || { total_nodes: 0, completed_nodes: 0, progress_pct: 0 };
}
