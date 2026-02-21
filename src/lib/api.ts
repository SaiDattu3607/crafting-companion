/**
 * CraftChain API Client
 * 
 * Frontend service that communicates with the Express backend.
 * Automatically attaches the Supabase JWT for authentication.
 */

import { supabase } from './supabase';

// Use the same hostname the browser loaded from, so LAN users hit the right server
const API_BASE = import.meta.env.VITE_API_URL
  || `http://${window.location.hostname}:3001/api`;

// ── Helper ─────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data as T;
}

// ── Types ──────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string;
  root_item_name: string;
  owner_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  role?: string;
}

export interface CraftingNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  item_name: string;
  display_name: string;
  required_qty: number;
  collected_qty: number;
  is_resource: boolean;
  depth: number;
  status: string;
  created_at: string;
  enchantments?: { name: string; level: number }[] | null;
}

export type MemberRole = 'owner' | 'member' | 'miner' | 'builder' | 'planner';

export interface ProjectMember {
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
    avatar_url: string | null;
    last_active_at?: string | null;
  };
}

export interface Contribution {
  id: string;
  quantity: number;
  action: 'collected' | 'crafted' | 'milestone' | 'restored';
  created_at: string;
  user_id: string;
  node_id: string;
  crafting_nodes: {
    item_name: string;
    display_name: string;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

export interface BottleneckItem {
  node_id: string;
  item_name: string;
  display_name: string;
  required_qty: number;
  collected_qty: number;
  remaining_qty: number;
  blocked_ancestors: number;
}

export interface ProjectProgress {
  total_nodes: number;
  completed_nodes: number;
  total_resources: number;
  completed_resources: number;
  progress_pct: number;
}

export interface MinecraftItem {
  name: string;
  displayName: string;
  isResource: boolean;
  hasRecipe?: boolean;
  category?: string;
  possibleEnchantments?: { name: string; level?: number }[] | null;
}

export interface ParseResult {
  projectId: string;
  rootNodeId: string;
  totalNodes: number;
  resources: { name: string; displayName: string; totalQty: number }[];
}

// ── API Functions ──────────────────────────────────────────────

/** List all projects for the current user */
export async function fetchProjects(): Promise<Project[]> {
  const data = await apiFetch<{ projects: Project[] }>('/projects');
  return data.projects;
}

/** Create a new project and parse its crafting tree */
export async function createProject(
  name: string,
  rootItemName: string,
  description?: string,
  quantity?: number,
  enchantments?: { name: string; level: number }[] | null,
): Promise<{ project: Project; tree: ParseResult }> {
  return apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, rootItemName, description, quantity, enchantments }),
  });
}

/** Create a project with multiple target items */
export interface TargetItem {
  itemName: string;
  displayName: string;
  quantity: number;
  enchantments: { name: string; level: number }[] | null;
}

export async function createMultiItemProject(
  name: string,
  items: TargetItem[],
  description?: string,
): Promise<{ project: Project; trees: ParseResult[] }> {
  return apiFetch('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      items: items.map(i => ({
        itemName: i.itemName,
        quantity: i.quantity,
        enchantments: i.enchantments,
      })),
    }),
  });
}

/** Get project details with full crafting tree */
export async function fetchProject(projectId: string): Promise<{
  project: Project;
  nodes: CraftingNode[];
  members: ProjectMember[];
}> {
  return apiFetch(`/projects/${projectId}`);
}

/** Delete a project */
export async function deleteProject(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}`, { method: 'DELETE' });
}

/** Mark project as completed or reactivate */
export async function updateProjectStatus(projectId: string, status: 'active' | 'completed' | 'archived'): Promise<void> {
  await apiFetch(`/projects/${projectId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** Contribute items to a node (with guard) */
export async function contributeToNode(
  projectId: string,
  nodeId: string,
  quantity: number = 1,
  action: 'collected' | 'crafted' = 'collected',
): Promise<{
  success: boolean;
  error?: string;
  node?: CraftingNode;
  contribution?: { id: string; quantity: number; action: 'collected' | 'crafted' | 'milestone' };
}> {
  return apiFetch(`/projects/${projectId}/contribute`, {
    method: 'POST',
    body: JSON.stringify({ nodeId, quantity, action }),
  });
}

/** Add a member to a project with optional role */
export async function addProjectMember(
  projectId: string,
  email: string,
  role: MemberRole = 'member',
): Promise<void> {
  await apiFetch(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

/** Update a member's role */
export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: MemberRole,
): Promise<void> {
  await apiFetch(`/projects/${projectId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/** Get contribution history */
export async function fetchContributions(projectId: string): Promise<Contribution[]> {
  const data = await apiFetch<{ contributions: Contribution[] }>(
    `/projects/${projectId}/contributions`
  );
  return data.contributions;
}

/** Get contribution leaderboard */
export async function fetchLeaderboard(projectId: string) {
  const data = await apiFetch<{ leaderboard: any[] }>(
    `/projects/${projectId}/leaderboard`
  );
  return data.leaderboard;
}

/** Find bottleneck resources */
export async function fetchBottleneck(projectId: string): Promise<BottleneckItem[]> {
  const data = await apiFetch<{ bottlenecks: BottleneckItem[] }>(
    `/projects/${projectId}/bottleneck`
  );
  return data.bottlenecks;
}

/** Get project progress */
export async function fetchProgress(projectId: string): Promise<ProjectProgress> {
  const data = await apiFetch<{ progress: ProjectProgress }>(
    `/projects/${projectId}/progress`
  );
  return data.progress;
}

/** Update enchantment levels on a crafting node */
export async function updateNodeEnchantments(
  projectId: string,
  nodeId: string,
  enchantments: { name: string; level: number }[],
): Promise<{ success: boolean; enchantments: { name: string; level: number }[] }> {
  return apiFetch(`/projects/${projectId}/nodes/${nodeId}/enchantments`, {
    method: 'PATCH',
    body: JSON.stringify({ enchantments }),
  });
}

// ── Task Suggestions ───────────────────────────────────────────

export interface SuggestedTask {
  id: string;
  action: string;
  item: string;
  displayName: string;
  qty: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/** Get role-based task suggestions for the current user */
export async function fetchTaskSuggestions(projectId: string): Promise<{
  role: MemberRole;
  tasks: SuggestedTask[];
}> {
  return apiFetch(`/projects/${projectId}/tasks`);
}

// ── Plan Versioning ────────────────────────────────────────────

export interface PlanSnapshot {
  id: string;
  version: number;
  label: string;
  created_at: string;
  created_by: string;
}

/** Save a snapshot of the current plan */
export async function savePlanSnapshot(
  projectId: string,
  label?: string,
): Promise<{ success: boolean; version: number }> {
  return apiFetch(`/projects/${projectId}/snapshots`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

/** List all plan snapshots */
export async function fetchPlanSnapshots(projectId: string): Promise<PlanSnapshot[]> {
  const data = await apiFetch<{ snapshots: PlanSnapshot[] }>(
    `/projects/${projectId}/snapshots`
  );
  return data.snapshots;
}

/** Restore a plan snapshot */
export async function restorePlanSnapshot(
  projectId: string,
  version: number,
): Promise<{ success: boolean; restoredVersion: number; nodesRestored: number }> {
  return apiFetch(`/projects/${projectId}/snapshots/${version}/restore`, {
    method: 'POST',
  });
}

/** Search Minecraft items */
export async function searchMinecraftItems(query: string): Promise<MinecraftItem[]> {
  if (query.length < 2) return [];
  const data = await apiFetch<{ items: MinecraftItem[] }>(
    `/items/search?q=${encodeURIComponent(query)}`
  );
  return data.items;
}

/** Look up a specific item */
export async function lookupMinecraftItem(itemName: string): Promise<MinecraftItem | null> {
  try {
    return await apiFetch<MinecraftItem>(`/items/${itemName}`);
  } catch {
    return null;
  }
}
