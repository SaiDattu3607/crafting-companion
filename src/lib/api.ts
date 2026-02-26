/**
 * CraftChain API Client
 * 
 * Frontend service that communicates with the Express backend.
 * Automatically attaches the Supabase JWT for authentication.
 */

import { supabase } from './supabase';

// In dev mode, Vite proxies /api to the backend so we can use same-origin.
// In production, the Express server serves both static files and API on the same port.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
  is_block: boolean;
  depth: number;
  status: string;
  created_at: string;
  enchantments?: { name: string; level: number }[] | null;
  variant?: string | null;
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
    minecraft_level?: number;
  };
}

export interface Contribution {
  id: string;
  quantity: number;
  action: 'collected' | 'crafted' | 'milestone' | 'restored' | 'saved';
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
  isBlock?: boolean;
  hasRecipe?: boolean;
  category?: string;
  possibleEnchantments?: { name: string; level?: number; levelRequirements?: number[] }[] | null;
  possibleVariants?: { name: string; displayName: string; effects?: string; duration?: string }[] | null;
}

export interface RecipeSlot {
  name: string;
  displayName: string;
}

export interface ShapedRecipe {
  type: 'shaped';
  grid: (RecipeSlot | null)[][];
  outputCount: number;
}

export interface ShapelessRecipe {
  type: 'shapeless';
  ingredients: RecipeSlot[];
  outputCount: number;
}

export interface SmithingRecipe {
  type: 'smithing';
  ingredients: { name: string; displayName: string; qty: number }[];
  outputCount: number;
}

export type Recipe = ShapedRecipe | ShapelessRecipe | SmithingRecipe;

export interface EntityDrop {
  entity: string;
  displayName: string;
  dropChance: number;
  stackSizeRange: [number, number];
}

export interface BlockSource {
  block: string;
  displayName: string;
}

export interface ProcedureInfo {
  steps: string[];
  station?: string;
  fuel?: string;
}

export interface AcquisitionInfo {
  locations?: string[];
  obtainedBy?: string[];
  notes?: string;
  procedure?: ProcedureInfo | null;
}

export interface ItemDetail {
  id: number;
  name: string;
  displayName: string;
  stackSize: number;
  isResource: boolean;
  hasRecipe: boolean;
  category: string;
  possibleEnchantments: { name: string; level?: number; levelRequirements?: number[] }[];
  possibleVariants?: { name: string; displayName: string; effects?: string; duration?: string }[] | null;
  imageUrl: string;
  recipe: Recipe | null;
  entityDrops: EntityDrop[];
  blockSources: BlockSource[];
  acquisition: AcquisitionInfo | null;
  foodInfo: { foodPoints: number; saturation: number } | null;
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
  variant: string | null;
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
        variant: i.variant,
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

/** Add a new target item to an existing project */
export async function addTargetItem(
  projectId: string,
  itemName: string,
  quantity: number = 1,
  enchantments: { name: string; level: number }[] | null = null,
  variant: string | null = null,
): Promise<{ success: boolean; tree: ParseResult }> {
  return apiFetch(`/projects/${projectId}/items`, {
    method: 'POST',
    body: JSON.stringify({ itemName, quantity, enchantments, variant }),
  });
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

/** Get detailed item info including recipe, drops, and acquisition */
export async function fetchItemDetail(itemName: string): Promise<ItemDetail | null> {
  try {
    return await apiFetch<ItemDetail>(`/items/${itemName}/detail`);
  } catch {
    return null;
  }
}

/** Enchantment data returned from the server */
export interface EnchantmentDetail {
  name: string;
  displayName: string;
  description?: string | null;
  maxLevel: number;
  treasureOnly: boolean;
  curse: boolean;
  category: string;
  weight: number;
  tradeable: boolean;
  discoverable: boolean;
  exclude: string[];
  levels: { level: number; booksNeeded: number; minXp: number }[];
  anvilSteps: { targetLevel: number; steps: { step: number; inputLevel: number; outputLevel: number; count: number }[] }[];
  sources: { method: string; description: string; icon: string; maxLevel: number }[];
  bestStrategy: string;
}

/** Fetch enchantment data (levels, anvil steps, sources) */
export async function fetchEnchantmentData(enchantmentName: string): Promise<EnchantmentDetail | null> {
  try {
    return await apiFetch<EnchantmentDetail>(`/items/enchantment/${enchantmentName}`);
  } catch {
    return null;
  }
}

// ── Invite System ──────────────────────────────────────────────

export interface ProjectInvite {
  id: string;
  project_id: string;
  inviter_id: string;
  role: MemberRole;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  projects: { id: string; name: string; description: string | null };
  inviter: { id: string; full_name: string | null; email: string; avatar_url: string | null };
}

/** Send an invite to a user for a project */
export async function sendProjectInvite(
  projectId: string,
  email: string,
  role: MemberRole = 'member',
  message: string = '',
): Promise<{ success: boolean }> {
  return apiFetch(`/projects/${projectId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email, role, message }),
  });
}

/** Get all pending invites for the current user */
export async function fetchPendingInvites(): Promise<ProjectInvite[]> {
  const data = await apiFetch<{ invites: ProjectInvite[] }>('/projects/invites/pending');
  return data.invites;
}

/** Accept an invite */
export async function acceptInvite(inviteId: string): Promise<{ success: boolean; projectId: string }> {
  return apiFetch(`/projects/invites/${inviteId}/accept`, { method: 'POST' });
}

/** Decline an invite */
export async function declineInvite(inviteId: string): Promise<{ success: boolean }> {
  return apiFetch(`/projects/invites/${inviteId}/decline`, { method: 'POST' });
}

// ── Profile ────────────────────────────────────────────────────

/** Get the current user's profile */
export async function fetchProfile(): Promise<{ id: string; full_name: string; email: string; minecraft_level: number }> {
  return apiFetch('/projects/profile');
}

/** Update the current user's profile (e.g. minecraft_level) */
export async function updateProfile(updates: { minecraft_level?: number }): Promise<{ id: string; minecraft_level: number }> {
  return apiFetch('/projects/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
