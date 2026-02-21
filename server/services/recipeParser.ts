/**
 * CraftChain Recursive Parser
 * 
 * Takes a Minecraft item name, looks up its recipe from minecraft-data,
 * and recursively creates rows in the crafting_nodes table until it
 * hits raw resources (items with no crafting recipe).
 */

import mcDataLoader from 'minecraft-data';
import type { SupabaseClient } from '@supabase/supabase-js';

const MC_VERSION = process.env.MC_VERSION || '1.20';
const mcData = mcDataLoader(MC_VERSION);

// Items that should always be treated as raw resources even if they
// technically have a recipe (e.g., diamond from diamond_block is a
// reverse recipe, not a crafting path)
const FORCE_RESOURCE_ITEMS = new Set([
  'diamond', 'emerald', 'lapis_lazuli', 'redstone', 'coal',
  'iron_ingot', 'gold_ingot', 'copper_ingot',
  'iron_nugget', 'gold_nugget',
  'quartz', 'amethyst_shard', 'echo_shard',
  'clay_ball', 'brick', 'nether_brick',
  'flint', 'feather', 'leather', 'rabbit_hide',
  'string', 'slime_ball', 'ghast_tear', 'blaze_rod', 'ender_pearl',
  'nether_star', 'phantom_membrane', 'nautilus_shell', 'heart_of_the_sea',
  'prismarine_shard', 'prismarine_crystals', 'shulker_shell',
  'bone', 'gunpowder', 'spider_eye', 'ink_sac', 'glow_ink_sac',
  'egg', 'honeycomb', 'honey_bottle',
  // Ores / raw materials
  'raw_iron', 'raw_gold', 'raw_copper',
  // Wood & natural (these are gathered, first-tier)
  'oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log',
  'dark_oak_log', 'mangrove_log', 'cherry_log', 'bamboo',
  'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks',
  'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks',
  // Stone & minerals
  'cobblestone', 'stone', 'deepslate', 'cobbled_deepslate',
  'sand', 'red_sand', 'gravel', 'clay',
  'obsidian', 'crying_obsidian', 'netherrack', 'soul_sand', 'soul_soil',
  'end_stone', 'basalt', 'blackstone',
  'glass', 'glowstone_dust',
  // Dyes
  'white_dye', 'orange_dye', 'magenta_dye', 'light_blue_dye',
  'yellow_dye', 'lime_dye', 'pink_dye', 'gray_dye',
  'light_gray_dye', 'cyan_dye', 'purple_dye', 'blue_dye',
  'brown_dye', 'green_dye', 'red_dye', 'black_dye',
  // Crops & food
  'wheat', 'sugar_cane', 'cactus', 'kelp',
  'apple', 'melon_slice', 'pumpkin', 'cocoa_beans',
  'sweet_berries', 'glow_berries',
  // Netherite raw components
  'netherite_scrap', 'ancient_debris',
  // Smithing template (obtained from bastion remnants, not crafted)
  'netherite_upgrade_smithing_template',
]);

/**
 * Manual recipes for items that use smithing table or other non-crafting-table
 * mechanics. minecraft-data only has crafting table recipes.
 * Map of itemName → array of { ingredientName, qty }
 */
const MANUAL_RECIPES: Record<string, { ingredientName: string; qty: number }[]> = {
  // Netherite tools & armor: smithing table = diamond item + netherite ingot + template
  netherite_sword:      [{ ingredientName: 'diamond_sword', qty: 1 },      { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_pickaxe:    [{ ingredientName: 'diamond_pickaxe', qty: 1 },    { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_axe:        [{ ingredientName: 'diamond_axe', qty: 1 },        { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_shovel:     [{ ingredientName: 'diamond_shovel', qty: 1 },     { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_hoe:        [{ ingredientName: 'diamond_hoe', qty: 1 },        { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_helmet:     [{ ingredientName: 'diamond_helmet', qty: 1 },     { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_chestplate: [{ ingredientName: 'diamond_chestplate', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_leggings:   [{ ingredientName: 'diamond_leggings', qty: 1 },   { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_boots:      [{ ingredientName: 'diamond_boots', qty: 1 },      { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  // Netherite ingot: 4 netherite scrap + 4 gold ingot
  netherite_ingot:      [{ ingredientName: 'netherite_scrap', qty: 4 }, { ingredientName: 'gold_ingot', qty: 4 }],
};

/**
 * Determines the ingredients needed for one craft of an item.
 * Returns a Map of itemId → quantity needed.
 * Falls back to MANUAL_RECIPES if minecraft-data has no recipe.
 */
function getRecipeIngredients(itemId: number): Map<number, number> | null {
  const recipes = mcData.recipes[itemId];
  if (!recipes || recipes.length === 0) {
    // Check manual recipes
    const item = mcData.items[itemId];
    if (item && MANUAL_RECIPES[item.name]) {
      const ingredientCounts = new Map<number, number>();
      for (const ing of MANUAL_RECIPES[item.name]) {
        const ingItem = mcData.itemsByName[ing.ingredientName];
        if (ingItem) {
          ingredientCounts.set(ingItem.id, (ingredientCounts.get(ingItem.id) || 0) + ing.qty);
        }
      }
      return ingredientCounts.size > 0 ? ingredientCounts : null;
    }
    return null;
  }

  // Use the first recipe available
  const recipe = recipes[0] as any;
  const ingredientCounts = new Map<number, number>();

  if (recipe.inShape) {
    // Shaped recipe — 2D array of item IDs (null = empty)
    for (const row of recipe.inShape) {
      for (const slot of row) {
        if (slot !== null && slot !== undefined) {
          ingredientCounts.set(slot, (ingredientCounts.get(slot) || 0) + 1);
        }
      }
    }
  } else if (recipe.ingredients) {
    // Shapeless recipe — flat array of item IDs
    for (const ingredientId of recipe.ingredients) {
      ingredientCounts.set(ingredientId, (ingredientCounts.get(ingredientId) || 0) + 1);
    }
  }

  return ingredientCounts.size > 0 ? ingredientCounts : null;
}

/**
 * Gets the recipe output count (how many items one craft produces)
 */
function getRecipeOutputCount(itemId: number): number {
  const recipes = mcData.recipes[itemId];
  if (!recipes || recipes.length === 0) {
    // Manual recipes always produce 1
    const item = mcData.items[itemId];
    if (item && MANUAL_RECIPES[item.name]) return 1;
    return 1;
  }
  const result = (recipes[0] as any).result;
  if (!result) return 1;
  return typeof result.count === 'number' ? result.count : 1;
}

/**
 * Check if an item is a raw resource (no recipe or forced resource)
 */
function isRawResource(itemName: string, itemId: number): boolean {
  if (FORCE_RESOURCE_ITEMS.has(itemName)) return true;
  // Check both minecraft-data recipes and manual recipes
  const recipes = mcData.recipes[itemId];
  const hasRecipe = (recipes && recipes.length > 0) || !!MANUAL_RECIPES[itemName];
  return !hasRecipe;
}

// ── Types ──────────────────────────────────────────────────────

export interface CraftingNode {
  id?: string;
  project_id: string;
  parent_id: string | null;
  item_name: string;
  display_name: string;
  required_qty: number;
  collected_qty: number;
  is_resource: boolean;
  depth: number;
  status: string;
}

export interface ParseResult {
  projectId: string;
  rootNodeId: string;
  totalNodes: number;
  resources: { name: string; displayName: string; totalQty: number }[];
}

// ── Main Parser ────────────────────────────────────────────────

/**
 * Recursively parses a Minecraft item into a crafting tree and
 * inserts all nodes into the Supabase crafting_nodes table.
 *
 * @param projectId - The UUID of the project to populate
 * @param rootItemName - Minecraft item name (e.g., "beacon", "diamond_pickaxe")
 * @param totalQuantity - How many of the final item are needed
 * @returns ParseResult with stats about what was created
 */
export async function parseRecipeTree(
  projectId: string,
  rootItemName: string,
  totalQuantity: number = 1,
  supabase: SupabaseClient
): Promise<ParseResult> {
  const rootItem = mcData.itemsByName[rootItemName];
  if (!rootItem) {
    throw new Error(`Unknown Minecraft item: "${rootItemName}". Check the item name.`);
  }

  // Track all nodes to batch insert
  const allNodes: CraftingNode[] = [];
  // Track resource totals for summary
  const resourceTotals = new Map<string, { displayName: string; qty: number }>();

  // Recursive helper
  function buildTree(
    itemId: number,
    parentTempIndex: number | null,
    requiredQty: number,
    depth: number
  ): number {
    const item = mcData.items[itemId];
    if (!item) return -1;

    const resource = isRawResource(item.name, itemId);
    const nodeIndex = allNodes.length;

    const node: CraftingNode = {
      project_id: projectId,
      parent_id: null, // will be resolved after DB insert
      item_name: item.name,
      display_name: item.displayName,
      required_qty: requiredQty,
      collected_qty: 0,
      is_resource: resource,
      depth,
      status: 'pending',
    };

    // Store parent index for later resolution
    allNodes.push(node);
    (node as any)._parentIndex = parentTempIndex;

    if (resource) {
      // Leaf node — track resource totals
      const existing = resourceTotals.get(item.name);
      if (existing) {
        existing.qty += requiredQty;
      } else {
        resourceTotals.set(item.name, { displayName: item.displayName, qty: requiredQty });
      }
      return nodeIndex;
    }

    // Not a resource — get recipe and recurse
    const ingredients = getRecipeIngredients(itemId);
    if (!ingredients) {
      // No recipe found — treat as resource
      node.is_resource = true;
      const existing = resourceTotals.get(item.name);
      if (existing) {
        existing.qty += requiredQty;
      } else {
        resourceTotals.set(item.name, { displayName: item.displayName, qty: requiredQty });
      }
      return nodeIndex;
    }

    // Calculate how many crafts are needed
    const outputCount = getRecipeOutputCount(itemId);
    const craftsNeeded = Math.ceil(requiredQty / outputCount);

    for (const [ingredientId, perCraftQty] of ingredients) {
      const totalIngredientQty = perCraftQty * craftsNeeded;
      buildTree(ingredientId, nodeIndex, totalIngredientQty, depth + 1);
    }

    return nodeIndex;
  }

  // Build the tree in memory
  buildTree(rootItem.id, null, totalQuantity, 0);

  if (allNodes.length === 0) {
    throw new Error(`Could not parse recipe tree for "${rootItemName}"`);
  }

  // Insert nodes level by level to resolve parent IDs
  // Group by depth (BFS order)
  const maxDepth = Math.max(...allNodes.map(n => n.depth));
  const insertedIds: (string | null)[] = new Array(allNodes.length).fill(null);

  for (let d = 0; d <= maxDepth; d++) {
    const nodesAtDepth = allNodes
      .map((n, i) => ({ node: n, index: i }))
      .filter(({ node }) => node.depth === d);

    if (nodesAtDepth.length === 0) continue;

    // Resolve parent_id from previously inserted nodes
    const rowsToInsert = nodesAtDepth.map(({ node, index }) => {
      const parentIndex = (node as any)._parentIndex as number | null;
      const parentId = parentIndex !== null ? insertedIds[parentIndex] : null;

      return {
        project_id: node.project_id,
        parent_id: parentId,
        item_name: node.item_name,
        display_name: node.display_name,
        required_qty: node.required_qty,
        collected_qty: 0,
        is_resource: node.is_resource,
        depth: node.depth,
        status: 'pending',
      };
    });

    const { data: inserted, error } = await supabase
      .from('crafting_nodes')
      .insert(rowsToInsert)
      .select('id');

    if (error) {
      throw new Error(`Failed to insert crafting nodes at depth ${d}: ${error.message}`);
    }

    // Map inserted IDs back
    if (inserted) {
      nodesAtDepth.forEach(({ index }, i) => {
        insertedIds[index] = inserted[i]?.id || null;
      });
    }
  }

  const rootNodeId = insertedIds[0];
  if (!rootNodeId) {
    throw new Error('Failed to get root node ID after insert');
  }

  // Build resource summary
  const resources = Array.from(resourceTotals.entries()).map(([name, info]) => ({
    name,
    displayName: info.displayName,
    totalQty: info.qty,
  }));

  return {
    projectId,
    rootNodeId,
    totalNodes: allNodes.length,
    resources,
  };
}

/**
 * Look up a Minecraft item by name and return its info.
 */
export function lookupItem(itemName: string) {
  const item = mcData.itemsByName[itemName];
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    isResource: isRawResource(item.name, item.id),
    hasRecipe: !!(
      (mcData.recipes[item.id] && mcData.recipes[item.id].length > 0)
      || MANUAL_RECIPES[item.name]
    ),
  };
}

/**
 * Search for Minecraft items by partial name.
 */
export function searchItems(query: string, limit: number = 20) {
  const q = query.toLowerCase();
  const results: { name: string; displayName: string; isResource: boolean }[] = [];

  for (const item of mcData.itemsArray) {
    if (
      item.name.toLowerCase().includes(q) ||
      item.displayName.toLowerCase().includes(q)
    ) {
      results.push({
        name: item.name,
        displayName: item.displayName,
        isResource: isRawResource(item.name, item.id),
      });
      if (results.length >= limit) break;
    }
  }

  return results;
}
