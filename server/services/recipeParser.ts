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
export const mcData = mcDataLoader(MC_VERSION);

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
  netherite_sword: [{ ingredientName: 'diamond_sword', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_pickaxe: [{ ingredientName: 'diamond_pickaxe', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_axe: [{ ingredientName: 'diamond_axe', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_shovel: [{ ingredientName: 'diamond_shovel', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_hoe: [{ ingredientName: 'diamond_hoe', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_helmet: [{ ingredientName: 'diamond_helmet', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_chestplate: [{ ingredientName: 'diamond_chestplate', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_leggings: [{ ingredientName: 'diamond_leggings', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  netherite_boots: [{ ingredientName: 'diamond_boots', qty: 1 }, { ingredientName: 'netherite_ingot', qty: 1 }, { ingredientName: 'netherite_upgrade_smithing_template', qty: 1 }],
  // Netherite ingot: 4 netherite scrap + 4 gold ingot
  netherite_ingot: [{ ingredientName: 'netherite_scrap', qty: 4 }, { ingredientName: 'gold_ingot', qty: 4 }],
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

// ── Potion / splash / lingering / tipped arrow variants ───────

const POTION_VARIANTS: { name: string; displayName: string; ingredient: string; level?: number; effects: string; duration?: string; canAmplify?: boolean }[] = [
  // ── Base potions (level 1) ───────────────────────────────
  { name: 'healing', displayName: 'Potion of Healing', ingredient: 'glistering_melon_slice', effects: 'Restores 4 hearts (8 HP) instantly', canAmplify: true },
  { name: 'strength', displayName: 'Potion of Strength', ingredient: 'blaze_powder', effects: '+3 melee attack damage (+1.5 hearts)', duration: '3:00', canAmplify: true },
  { name: 'regeneration', displayName: 'Potion of Regeneration', ingredient: 'ghast_tear', effects: 'Restores 1 heart every 2.5 seconds', duration: '0:45', canAmplify: true },
  { name: 'swiftness', displayName: 'Potion of Swiftness', ingredient: 'sugar', effects: '+20% movement speed', duration: '3:00', canAmplify: true },
  { name: 'night_vision', displayName: 'Potion of Night Vision', ingredient: 'golden_carrot', effects: 'See in the dark as if everything is max brightness', duration: '3:00' },
  { name: 'fire_resistance', displayName: 'Potion of Fire Resistance', ingredient: 'magma_cream', effects: 'Immune to fire, lava, magma blocks, and blaze fireballs', duration: '3:00' },
  { name: 'water_breathing', displayName: 'Potion of Water Breathing', ingredient: 'pufferfish', effects: 'Breathe underwater — oxygen bar does not deplete', duration: '3:00' },
  { name: 'leaping', displayName: 'Potion of Leaping', ingredient: 'rabbit_foot', effects: '+50% jump height (1.5 blocks)', duration: '3:00', canAmplify: true },
  { name: 'slow_falling', displayName: 'Potion of Slow Falling', ingredient: 'phantom_membrane', effects: 'Fall slowly (no fall damage), can drift farther', duration: '1:30' },
  { name: 'poison', displayName: 'Potion of Poison', ingredient: 'spider_eye', effects: 'Lose 1 heart every 1.25 seconds (cannot kill)', duration: '0:45', canAmplify: true },
  { name: 'weakness', displayName: 'Potion of Weakness', ingredient: 'fermented_spider_eye', effects: '-4 melee attack damage (-2 hearts)', duration: '1:30' },
  { name: 'harming', displayName: 'Potion of Harming', ingredient: 'fermented_spider_eye', effects: 'Deals 6 HP (3 hearts) instant damage', canAmplify: true },
  { name: 'invisibility', displayName: 'Potion of Invisibility', ingredient: 'fermented_spider_eye', effects: 'Invisible to mobs/players — armor still visible', duration: '3:00' },
  { name: 'slowness', displayName: 'Potion of Slowness', ingredient: 'fermented_spider_eye', effects: '-15% movement speed', duration: '1:30' },
  { name: 'turtle_master', displayName: 'Potion of the Turtle Master', ingredient: 'turtle_helmet', effects: 'Slowness IV (-60% speed) + Resistance III (60% damage reduction)', duration: '0:20', canAmplify: true },

  // ── Level II potions (brewed by adding Glowstone Dust to the base potion) ──
  { name: 'healing_2', displayName: 'Potion of Healing II', ingredient: 'glistering_melon_slice', level: 2, effects: 'Restores 8 hearts (16 HP) instantly' },
  { name: 'strength_2', displayName: 'Potion of Strength II', ingredient: 'blaze_powder', level: 2, effects: '+6 melee attack damage (+3 hearts)', duration: '1:30' },
  { name: 'regeneration_2', displayName: 'Potion of Regeneration II', ingredient: 'ghast_tear', level: 2, effects: 'Restores 1 heart every 1.2 seconds', duration: '0:22' },
  { name: 'swiftness_2', displayName: 'Potion of Swiftness II', ingredient: 'sugar', level: 2, effects: '+40% movement speed', duration: '1:30' },
  { name: 'leaping_2', displayName: 'Potion of Leaping II', ingredient: 'rabbit_foot', level: 2, effects: '+100% jump height (2.5 blocks)', duration: '1:30' },
  { name: 'poison_2', displayName: 'Potion of Poison II', ingredient: 'spider_eye', level: 2, effects: 'Lose 1 heart every 0.4 seconds (cannot kill)', duration: '0:21' },
  { name: 'harming_2', displayName: 'Potion of Harming II', ingredient: 'fermented_spider_eye', level: 2, effects: 'Deals 12 HP (6 hearts) instant damage' },
  { name: 'turtle_master_2', displayName: 'Potion of the Turtle Master II', ingredient: 'turtle_helmet', level: 2, effects: 'Slowness VI (-90% speed) + Resistance IV (80% damage reduction)', duration: '0:20' },
];

/** Items that support variant selection (potion type, etc.) */
const VARIANT_ITEMS = new Set(['potion', 'splash_potion', 'lingering_potion', 'tipped_arrow']);

function getPossibleVariants(itemName: string): { name: string; displayName: string; effects?: string; duration?: string }[] | null {
  if (!VARIANT_ITEMS.has(itemName)) return null;
  // For potions, prefix changes by item type
  const prefix = itemName === 'potion' ? 'Potion'
    : itemName === 'splash_potion' ? 'Splash Potion'
      : itemName === 'lingering_potion' ? 'Lingering Potion'
        : 'Tipped Arrow';
  return POTION_VARIANTS.map(v => ({
    name: v.name,
    displayName: `${prefix} of ${v.displayName.replace(/Potion of /i, '')}`,
    effects: v.effects,
    duration: v.duration,
  }));
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
  is_block: boolean;
  depth: number;
  status: string;
  enchantments?: { name: string; level: number }[] | null;
  variant?: string | null;
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
  supabase: SupabaseClient,
  enchantments: { name: string; level: number }[] | null = null,
  variant: string | null = null
): Promise<ParseResult> {
  const rootItem = mcData.itemsByName[rootItemName];
  if (!rootItem) {
    throw new Error(`Unknown Minecraft item: "${rootItemName}". Check the item name.`);
  }

  // If enchantments were requested on the final item, apply a simple
  // planning multiplier so enchantments affect required quantities.
  // Each enchant level increases resource needs by 20% (rounded up).
  const totalEnchantLevels = (enchantments || []).reduce((s, e) => s + (e?.level || 0), 0);
  if (totalEnchantLevels > 0) {
    const multiplier = 1 + 0.2 * totalEnchantLevels;
    totalQuantity = Math.ceil(totalQuantity * multiplier);
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
      is_block: !!mcData.blocksByName[item.name],
      depth,
      status: 'pending',
    };

    // Attach enchantments to root node only
    if (parentTempIndex === null && depth === 0 && enchantments && enchantments.length > 0) {
      node.enchantments = enchantments;
    }

    // Attach variant to root node only
    if (parentTempIndex === null && depth === 0 && variant) {
      node.variant = variant;
      // Update display name to include variant
      const variantInfo = POTION_VARIANTS.find(v => v.name === variant);
      if (variantInfo) {
        const prefix = item.name === 'potion' ? 'Potion'
          : item.name === 'splash_potion' ? 'Splash Potion'
            : item.name === 'lingering_potion' ? 'Lingering Potion'
              : item.name === 'tipped_arrow' ? 'Tipped Arrow' : item.displayName;
        node.display_name = `${prefix} of ${variantInfo.displayName.replace('Potion of ', '')}`;
      }
    }

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

  // For each enchantable tool/armor in the tree, add an Enchanted Book requirement per enchantment
  if (enchantments && enchantments.length > 0) {
    const bookAdds: { parentIndex: number; requiredQty: number }[] = [];
    for (let i = 0; i < allNodes.length; i++) {
      const node = allNodes[i];
      if (!enchantmentAppliesToItem(node.item_name, enchantments)) continue;
      bookAdds.push({ parentIndex: i, requiredQty: node.required_qty });
    }
    // Create a separate enchanted book node per enchantment
    for (const ench of enchantments) {
      const enchLabel = `${ench.name.replace(/_/g, ' ')} ${ench.level}`;
      let enchBookQty = 0;
      for (const { parentIndex, requiredQty } of bookAdds) {
        const parentNode = allNodes[parentIndex];
        const bookNode: CraftingNode = {
          project_id: projectId,
          parent_id: null,
          item_name: 'enchanted_book',
          display_name: `Enchanted Book (${enchLabel})`,
          required_qty: requiredQty,
          collected_qty: 0,
          is_resource: true,
          is_block: false,
          depth: parentNode.depth + 1,
          status: 'pending',
        };
        (bookNode as any)._parentIndex = parentIndex;
        allNodes.push(bookNode);
        enchBookQty += requiredQty;
      }
      if (enchBookQty > 0) {
        const key = `enchanted_book:${ench.name}`;
        resourceTotals.set(key, {
          displayName: `Enchanted Book (${enchLabel})`,
          qty: enchBookQty,
        });
      }
    }
  }

  // For potion/splash/lingering/tipped_arrow with a variant, add brewing ingredient nodes
  if (variant && VARIANT_ITEMS.has(rootItemName)) {
    const variantInfo = POTION_VARIANTS.find(v => v.name === variant);
    if (variantInfo) {
      const rootIndex = 0;
      const rootNode = allNodes[rootIndex];
      const brewDepth = rootNode.depth + 1;

      // Add Nether Wart (base ingredient for Awkward Potion)
      const netherWart = mcData.itemsByName['nether_wart'];
      if (netherWart) {
        const nwNode: CraftingNode = {
          project_id: projectId, parent_id: null,
          item_name: 'nether_wart', display_name: 'Nether Wart',
          required_qty: totalQuantity, collected_qty: 0,
          is_resource: true, is_block: !!mcData.blocksByName['nether_wart'],
          depth: brewDepth, status: 'pending',
        };
        (nwNode as any)._parentIndex = rootIndex;
        allNodes.push(nwNode);
        const nwExist = resourceTotals.get('nether_wart');
        if (nwExist) nwExist.qty += totalQuantity; else resourceTotals.set('nether_wart', { displayName: 'Nether Wart', qty: totalQuantity });
      }

      // Add the variant-specific ingredient
      const ingItem = mcData.itemsByName[variantInfo.ingredient];
      if (ingItem) {
        const ingNode: CraftingNode = {
          project_id: projectId, parent_id: null,
          item_name: ingItem.name, display_name: ingItem.displayName,
          required_qty: totalQuantity, collected_qty: 0,
          is_resource: true, is_block: !!mcData.blocksByName[ingItem.name],
          depth: brewDepth, status: 'pending',
        };
        (ingNode as any)._parentIndex = rootIndex;
        allNodes.push(ingNode);
        const ingExist = resourceTotals.get(ingItem.name);
        if (ingExist) ingExist.qty += totalQuantity; else resourceTotals.set(ingItem.name, { displayName: ingItem.displayName, qty: totalQuantity });
      }

      // Add Blaze Powder (fuel)
      const blazePowder = mcData.itemsByName['blaze_powder'];
      if (blazePowder) {
        const fuelQty = Math.ceil(totalQuantity / 20); // 1 powder = 20 brews
        const bpNode: CraftingNode = {
          project_id: projectId, parent_id: null,
          item_name: 'blaze_powder', display_name: 'Blaze Powder (fuel)',
          required_qty: fuelQty, collected_qty: 0,
          is_resource: true, is_block: false,
          depth: brewDepth, status: 'pending',
        };
        (bpNode as any)._parentIndex = rootIndex;
        allNodes.push(bpNode);
        const bpExist = resourceTotals.get('blaze_powder');
        if (bpExist) bpExist.qty += fuelQty; else resourceTotals.set('blaze_powder', { displayName: 'Blaze Powder (fuel)', qty: fuelQty });
      }

      // Add Glass Bottle
      const glassBottle = mcData.itemsByName['glass_bottle'];
      if (glassBottle) {
        const gbNode: CraftingNode = {
          project_id: projectId, parent_id: null,
          item_name: 'glass_bottle', display_name: 'Glass Bottle',
          required_qty: totalQuantity, collected_qty: 0,
          is_resource: true, is_block: false,
          depth: brewDepth, status: 'pending',
        };
        (gbNode as any)._parentIndex = rootIndex;
        allNodes.push(gbNode);
        const gbExist = resourceTotals.get('glass_bottle');
        if (gbExist) gbExist.qty += totalQuantity; else resourceTotals.set('glass_bottle', { displayName: 'Glass Bottle', qty: totalQuantity });
      }
      // For splash potion: also needs Gunpowder
      if (rootItemName === 'splash_potion') {
        const gp = mcData.itemsByName['gunpowder'];
        if (gp) {
          const gpNode: CraftingNode = {
            project_id: projectId, parent_id: null,
            item_name: 'gunpowder', display_name: 'Gunpowder',
            required_qty: totalQuantity, collected_qty: 0,
            is_resource: true, is_block: false,
            depth: brewDepth, status: 'pending',
          };
          (gpNode as any)._parentIndex = rootIndex;
          allNodes.push(gpNode);
          const gpExist = resourceTotals.get('gunpowder');
          if (gpExist) gpExist.qty += totalQuantity; else resourceTotals.set('gunpowder', { displayName: 'Gunpowder', qty: totalQuantity });
        }
      }

      // For lingering potion: needs Gunpowder + Dragon Breath
      if (rootItemName === 'lingering_potion') {
        const gp = mcData.itemsByName['gunpowder'];
        if (gp) {
          const gpNode: CraftingNode = {
            project_id: projectId, parent_id: null,
            item_name: 'gunpowder', display_name: 'Gunpowder',
            required_qty: totalQuantity, collected_qty: 0,
            is_resource: true, is_block: false,
            depth: brewDepth, status: 'pending',
          };
          (gpNode as any)._parentIndex = rootIndex;
          allNodes.push(gpNode);
          const gpExist = resourceTotals.get('gunpowder');
          if (gpExist) gpExist.qty += totalQuantity; else resourceTotals.set('gunpowder', { displayName: 'Gunpowder', qty: totalQuantity });
        }
        const db = mcData.itemsByName['dragon_breath'];
        if (db) {
          const dbNode: CraftingNode = {
            project_id: projectId, parent_id: null,
            item_name: 'dragon_breath', display_name: 'Dragon Breath',
            required_qty: totalQuantity, collected_qty: 0,
            is_resource: true, is_block: false,
            depth: brewDepth, status: 'pending',
          };
          (dbNode as any)._parentIndex = rootIndex;
          allNodes.push(dbNode);
          const dbExist = resourceTotals.get('dragon_breath');
          if (dbExist) dbExist.qty += totalQuantity; else resourceTotals.set('dragon_breath', { displayName: 'Dragon Breath', qty: totalQuantity });
        }
      }

      // For level II variants: add Glowstone Dust
      if (variantInfo.level === 2) {
        const gd = mcData.itemsByName['glowstone_dust'];
        if (gd) {
          const gdNode: CraftingNode = {
            project_id: projectId, parent_id: null,
            item_name: 'glowstone_dust', display_name: 'Glowstone Dust',
            required_qty: totalQuantity, collected_qty: 0,
            is_resource: true, is_block: !!mcData.blocksByName['glowstone_dust'],
            depth: brewDepth, status: 'pending',
          };
          (gdNode as any)._parentIndex = rootIndex;
          allNodes.push(gdNode);
          const gdExist = resourceTotals.get('glowstone_dust');
          if (gdExist) gdExist.qty += totalQuantity; else resourceTotals.set('glowstone_dust', { displayName: 'Glowstone Dust', qty: totalQuantity });
        }
      }
    }
  }

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
        is_block: node.is_block,
        depth: node.depth,
        status: 'pending',
        enchantments: node.enchantments || null,
        variant: node.variant || null,
      };
    });

    let { data: inserted, error } = await supabase
      .from('crafting_nodes')
      .insert(rowsToInsert)
      .select('id');

    // If the insert failed due to missing columns in the DB
    // (e.g. migration not applied), retry without the extra columns.
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('enchantments') || msg.includes('variant') || msg.includes('schema')) {
        console.warn('Database missing column(s); retrying insert without enchantments/variant.');
        const rowsStripped = rowsToInsert.map(r => {
          const copy: any = { ...r };
          delete copy.enchantments;
          delete copy.variant;
          delete copy.is_block;
          return copy;
        });

        const retry = await supabase
          .from('crafting_nodes')
          .insert(rowsStripped)
          .select('id');

        inserted = retry.data;
        error = retry.error;
        if (error) {
          throw new Error(`Failed to insert crafting nodes at depth ${d} (after stripping columns): ${error.message}`);
        }
      } else {
        throw new Error(`Failed to insert crafting nodes at depth ${d}: ${error.message}`);
      }
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
 * Get the max level for a given enchantment name from minecraft-data.
 * Returns the maxLevel or null if not found.
 */
export function getEnchantmentMaxLevel(enchantmentName: string): number | null {
  const enchantmentsArray: any[] = (mcData as any).enchantmentsArray || [];
  const ench = enchantmentsArray.find((e: any) => e.name === enchantmentName);
  return ench ? (ench.maxLevel || 1) : null;
}

/**
 * Minimum XP levels required to obtain enchantments at each tier via enchanting table.
 * Based on Minecraft Java Edition enchanting table mechanics (15 bookshelves).
 * Key = enchantment name, Value = array where index is enchantment level (1-indexed).
 * e.g. ENCHANTMENT_MIN_LEVELS['sharpness'] = [0, 1, 12, 23, 34, 45]
 * Index 0 unused; index 1 = level I requirement, etc.
 *
 * For enchantments obtainable only via anvil/trading/loot (e.g. mending), set higher values.
 */
const ENCHANTMENT_MIN_LEVELS: Record<string, number[]> = {
  // ── Melee ──
  sharpness: [0, 1, 12, 23, 34, 45],
  smite: [0, 5, 13, 21, 29, 37],
  bane_of_arthropods: [0, 5, 13, 21, 29, 37],
  knockback: [0, 5, 25],
  fire_aspect: [0, 10, 30],
  looting: [0, 15, 24, 33],
  sweeping_edge: [0, 5, 14, 23],

  // ── Tools ──
  efficiency: [0, 1, 11, 21, 31, 41],
  silk_touch: [0, 15],
  fortune: [0, 15, 24, 33],
  unbreaking: [0, 5, 13, 21],

  // ── Bow ──
  power: [0, 1, 11, 21, 31, 41],
  punch: [0, 12, 32],
  flame: [0, 20],
  infinity: [0, 20],

  // ── Armor ──
  protection: [0, 1, 12, 23, 34],
  fire_protection: [0, 10, 18, 26, 34],
  blast_protection: [0, 5, 13, 21, 29],
  projectile_protection: [0, 3, 11, 19, 27],
  feather_falling: [0, 5, 11, 17, 23],
  respiration: [0, 10, 20, 30],
  aqua_affinity: [0, 1],
  thorns: [0, 10, 30, 50],
  depth_strider: [0, 10, 20, 30],
  frost_walker: [0, 10, 20],
  soul_speed: [0, 10, 20, 30],
  swift_sneak: [0, 15, 24, 33],

  // ── Trident ──
  loyalty: [0, 12, 19, 26],
  impaling: [0, 1, 9, 17, 25, 33],
  riptide: [0, 17, 24, 31],
  channeling: [0, 25],

  // ── Crossbow ──
  multishot: [0, 20],
  quick_charge: [0, 12, 32, 52],
  piercing: [0, 1, 11, 21, 31],

  // ── Fishing ──
  luck_of_the_sea: [0, 15, 24, 33],
  lure: [0, 15, 24, 33],

  // ── Treasure (anvil/trading/loot only) ──
  mending: [0, 30],
  binding_curse: [0, 25],
  vanishing_curse: [0, 25],
};

/**
 * Get the minimum XP level required for a given enchantment at a given level.
 * Returns the min level, or a fallback estimate if not in the lookup.
 */
export function getEnchantmentMinLevel(enchantmentName: string, enchantmentLevel: number): number {
  const levels = ENCHANTMENT_MIN_LEVELS[enchantmentName];
  if (levels && enchantmentLevel < levels.length) {
    return levels[enchantmentLevel];
  }
  // Fallback formula: roughly 8 * level
  return Math.min(enchantmentLevel * 8, 30);
}

/**
 * Look up a Minecraft item by name and return its info.
 */
export function lookupItem(itemName: string) {
  const item = mcData.itemsByName[itemName];
  if (!item) return null;
  const category = determineItemCategory(item.name);
  const isVariantItem = VARIANT_ITEMS.has(item.name);
  const possibleEnchantments = isVariantItem ? [] : getEnchantmentsForCategory(category);

  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    isResource: isRawResource(item.name, item.id),
    isBlock: !!mcData.blocksByName[item.name],
    hasRecipe: !!(
      (mcData.recipes[item.id] && mcData.recipes[item.id].length > 0)
      || MANUAL_RECIPES[item.name]
    ),
    category,
    possibleEnchantments,
    possibleVariants: getPossibleVariants(item.name),
  };
}

// ── Acquisition Data (entity loot, block loot, manual sources) ─

/** Manual acquisition sources for resources that minecraft-data doesn't cover well */
const MANUAL_ACQUISITION: Record<string, {
  locations?: string[];
  obtainedBy?: string[];
  notes?: string;
  procedure?: { steps: string[]; station?: string; fuel?: string };
}> = {
  // Liquids & terrain
  lava: { locations: ['Nether (oceans & falls)', 'Overworld (underground pools, y=0-10)', 'Ruined Portals', 'Blacksmith buildings'], obtainedBy: ['Bucket'], notes: 'Infinite lava source in the Nether' },
  water: { locations: ['Oceans', 'Rivers', 'Lakes', 'Rain collection'], obtainedBy: ['Bucket'] },
  obsidian: { locations: ['Where water meets lava source', 'Nether portal frames', 'End platform', 'Ruined portals'], obtainedBy: ['Diamond Pickaxe or better'] },
  // Ores
  diamond: { locations: ['Overworld (y=-64 to y=16, best at y=-59)', 'Deep caves', 'Shipwreck & Buried Treasure chests'], obtainedBy: ['Iron Pickaxe or better', 'Fortune III enchantment recommended'] },
  emerald: { locations: ['Mountain biomes (y=-16 to y=320)', 'Trading with villagers'], obtainedBy: ['Iron Pickaxe or better'] },
  ancient_debris: { locations: ['Nether (y=8-22, best at y=15)', 'Bastion Remnant chests'], obtainedBy: ['Diamond Pickaxe or better', 'TNT mining', 'Bed mining'] },
  lapis_lazuli: { locations: ['Overworld (y=-64 to y=64, best at y=0)'], obtainedBy: ['Stone Pickaxe or better'] },
  redstone: { locations: ['Overworld (y=-64 to y=15)', 'Witch drops', 'Jungle Temple traps'], obtainedBy: ['Iron Pickaxe or better'] },
  coal: { locations: ['Overworld (y=0 to y=320, common above y=96)'], obtainedBy: ['Any Pickaxe'] },
  quartz: { locations: ['Nether (all altitudes)'], obtainedBy: ['Any Pickaxe'] },
  raw_iron: { locations: ['Overworld (y=-24 to y=56, best at y=16)'], obtainedBy: ['Stone Pickaxe or better'] },
  raw_gold: { locations: ['Overworld (y=-64 to y=32)', 'Badlands biome at all heights', 'Nether Gold Ore'], obtainedBy: ['Iron Pickaxe or better'] },
  raw_copper: { locations: ['Overworld (y=-16 to y=112, best at y=48)', 'Dripstone caves (large veins)'], obtainedBy: ['Stone Pickaxe or better'] },
  // Mob drops  
  gunpowder: { locations: ['Overworld (anywhere at night/dark)', 'Desert Temples', 'Witch Huts', 'Dungeons'], obtainedBy: ['Kill Creepers', 'Kill Ghasts (Nether)', 'Kill Witches'] },
  blaze_rod: { locations: ['Nether Fortress'], obtainedBy: ['Kill Blazes (Nether Fortress spawner)'] },
  ender_pearl: { locations: ['Overworld (night)', 'The End', 'Warped Forest (Nether)'], obtainedBy: ['Kill Endermen', 'Trade with Piglins (bartering)', 'Stronghold chests'] },
  slime_ball: { locations: ['Swamp biome (at night)', 'Slime chunks (y<40)'], obtainedBy: ['Kill Slimes'] },
  spider_eye: { locations: ['Overworld (night)', 'Desert Temples', 'Witch drops'], obtainedBy: ['Kill Spiders', 'Kill Cave Spiders'] },
  string: { locations: ['Overworld (night)', 'Mineshafts (cobwebs)', 'Jungle Temples'], obtainedBy: ['Kill Spiders', 'Kill Cave Spiders', 'Break cobwebs with sword', 'Fishing'] },
  bone: { locations: ['Overworld (night)', 'Skeleton spawners (dungeons)'], obtainedBy: ['Kill Skeletons', 'Kill Wither Skeletons', 'Fishing (junk)'] },
  leather: { locations: ['Plains', 'Villages (tanneries)'], obtainedBy: ['Kill Cows', 'Kill Horses', 'Kill Llamas', 'Kill Rabbits (rabbit hide ×4)', 'Fishing (junk)'] },
  feather: { locations: ['Overworld (anywhere with chickens)'], obtainedBy: ['Kill Chickens', 'Kill Parrots'] },
  ghast_tear: { locations: ['Nether (Soul Sand Valley, Nether Wastes)'], obtainedBy: ['Kill Ghasts'] },
  phantom_membrane: { locations: ['Overworld (night, if no sleep for 3+ days)'], obtainedBy: ['Kill Phantoms'] },
  nether_star: { locations: ['Anywhere (boss fight)'], obtainedBy: ['Kill the Wither (requires 3 Wither Skeleton Skulls + 4 Soul Sand)'] },
  ink_sac: { locations: ['Oceans', 'Rivers', 'Underground water pools'], obtainedBy: ['Kill Squids'] },
  glow_ink_sac: { locations: ['Underground (below y=30)'], obtainedBy: ['Kill Glow Squids'] },
  prismarine_shard: { locations: ['Ocean Monuments'], obtainedBy: ['Kill Guardians', 'Kill Elder Guardians'] },
  prismarine_crystals: { locations: ['Ocean Monuments'], obtainedBy: ['Kill Guardians (rare)', 'Sea Lanterns'] },
  shulker_shell: { locations: ['End Cities'], obtainedBy: ['Kill Shulkers'] },
  nautilus_shell: { locations: ['Oceans'], obtainedBy: ['Fishing (treasure)', 'Kill Drowned (rare)', 'Wandering Trader'] },
  heart_of_the_sea: { locations: ['Buried Treasure chests (beach biomes)'], obtainedBy: ['Find Buried Treasure (use treasure maps from shipwrecks)'] },
  egg: { locations: ['Overworld (anywhere with chickens)'], obtainedBy: ['Chickens lay eggs every 5-10 minutes'] },
  honeycomb: { locations: ['Plains', 'Flower Forest', 'Meadow biomes'], obtainedBy: ['Shear a Bee Nest/Beehive (with campfire underneath)'] },
  flint: { locations: ['Gravel deposits everywhere'], obtainedBy: ['Break Gravel blocks (10% chance, 100% with Fortune III)'] },
  clay_ball: { locations: ['Rivers', 'Shallow ponds', 'Lush Caves'], obtainedBy: ['Break Clay blocks (drops 4 clay balls)'] },
  // Crops
  wheat: { locations: ['Village farms', 'Anywhere (farmable)'], obtainedBy: ['Farm with Seeds on tilled soil near water'] },
  sugar_cane: { locations: ['River banks', 'Beach biomes'], obtainedBy: ['Break and replant near water'] },
  cocoa_beans: { locations: ['Jungle biomes'], obtainedBy: ['Break Cocoa Pods on Jungle Log'] },
  melon_slice: { locations: ['Jungle biomes', 'Savanna village chests'], obtainedBy: ['Break Melon block', 'Farm Melon Seeds'] },
  pumpkin: { locations: ['Most Overworld biomes (grassy areas)', 'Taiga', 'Woodland Mansion'], obtainedBy: ['Find and break naturally spawned pumpkins', 'Farm Pumpkin Seeds'] },
  apple: { locations: ['Oak/Dark Oak forests'], obtainedBy: ['Break Oak/Dark Oak leaves (0.5% chance)', 'Village chests', 'Stronghold chests'] },
  // Wood
  oak_log: { locations: ['Forest', 'Plains', 'most Overworld biomes'], obtainedBy: ['Chop Oak Trees'] },
  spruce_log: { locations: ['Taiga', 'Mega Taiga', 'Snowy biomes'], obtainedBy: ['Chop Spruce Trees'] },
  birch_log: { locations: ['Forest', 'Birch Forest'], obtainedBy: ['Chop Birch Trees'] },
  jungle_log: { locations: ['Jungle biomes'], obtainedBy: ['Chop Jungle Trees'] },
  acacia_log: { locations: ['Savanna biomes'], obtainedBy: ['Chop Acacia Trees'] },
  dark_oak_log: { locations: ['Dark Forest biomes'], obtainedBy: ['Chop Dark Oak Trees'] },
  cherry_log: { locations: ['Cherry Grove biomes'], obtainedBy: ['Chop Cherry Trees'] },
  bamboo: { locations: ['Jungle biomes', 'Bamboo Jungle'], obtainedBy: ['Break bamboo shoots'] },
  // Stone & minerals
  cobblestone: { locations: ['Everywhere underground'], obtainedBy: ['Mine Stone with any Pickaxe'] },
  stone: { locations: ['Everywhere underground'], obtainedBy: ['Mine Stone with Silk Touch pickaxe', 'Smelt Cobblestone'] },
  sand: { locations: ['Beaches', 'Deserts', 'Rivers'], obtainedBy: ['Dig with Shovel'] },
  gravel: { locations: ['Overworld (underground, beaches)', 'Nether (large deposits)'], obtainedBy: ['Dig with Shovel'] },
  glowstone_dust: { locations: ['Nether (Glowstone clusters on ceilings)'], obtainedBy: ['Break Glowstone blocks', 'Kill Witches'] },
  netherrack: { locations: ['Nether (everywhere)'], obtainedBy: ['Mine with any Pickaxe'] },
  soul_sand: { locations: ['Nether (Soul Sand Valley)', 'Nether Fortress'], obtainedBy: ['Dig with Shovel'] },
  basalt: { locations: ['Nether (Basalt Deltas)'], obtainedBy: ['Mine with any Pickaxe'] },
  blackstone: { locations: ['Nether (Basalt Deltas)', 'Bastion Remnants'], obtainedBy: ['Mine with any Pickaxe'] },
  end_stone: { locations: ['The End dimension'], obtainedBy: ['Mine with any Pickaxe'] },
  deepslate: { locations: ['Overworld (below y=0)'], obtainedBy: ['Mine with any Pickaxe (Silk Touch for deepslate, otherwise cobbled)'] },
  // Dyes
  white_dye: { obtainedBy: ['Bone Meal (from Bones)', 'Lily of the Valley'] },
  red_dye: { obtainedBy: ['Poppy', 'Rose Bush', 'Red Tulip', 'Beetroot'] },
  blue_dye: { obtainedBy: ['Lapis Lazuli', 'Cornflower'] },
  yellow_dye: { obtainedBy: ['Dandelion', 'Sunflower'] },
  green_dye: { obtainedBy: ['Smelt Cactus in Furnace'] },
  black_dye: { obtainedBy: ['Ink Sac', 'Wither Rose'] },
  brown_dye: { obtainedBy: ['Cocoa Beans'] },
  // Templates
  netherite_upgrade_smithing_template: { locations: ['Bastion Remnants (treasure room chests)'], obtainedBy: ['Loot Bastion Remnant chests'], notes: 'Very rare, found only in Bastion treasure rooms' },
  // ── Cooked Foods (Furnace / Smoker / Campfire) ──────────────
  cooked_beef: {
    obtainedBy: ['Cook Raw Beef in a Furnace, Smoker, or Campfire'],
    procedure: {
      steps: [
        'Kill a Cow to get Raw Beef',
        'Place Raw Beef in the top slot of a Furnace or Smoker',
        'Add fuel (coal, charcoal, wood, etc.) in the bottom slot',
        'Wait for the arrow to fill — collect your Steak!',
        'Alternative: Place Raw Beef on a lit Campfire (no fuel needed, takes 30 seconds)',
      ],
      station: 'Furnace / Smoker / Campfire',
      fuel: 'Coal, Charcoal, Wood Planks, or any burnable item',
    },
  },
  cooked_chicken: {
    obtainedBy: ['Cook Raw Chicken in a Furnace, Smoker, or Campfire'],
    procedure: {
      steps: [
        'Kill a Chicken to get Raw Chicken',
        'Place Raw Chicken in the top slot of a Furnace or Smoker',
        'Add fuel in the bottom slot',
        'Wait for it to cook — collect your Cooked Chicken!',
        'Alternative: Place on a lit Campfire (30 seconds, no fuel needed)',
      ],
      station: 'Furnace / Smoker / Campfire',
      fuel: 'Coal, Charcoal, or any burnable item',
    },
    notes: 'Eating Raw Chicken has a 30% chance of giving Hunger effect — always cook it!',
  },
  cooked_porkchop: {
    obtainedBy: ['Cook Raw Porkchop in a Furnace, Smoker, or Campfire'],
    procedure: {
      steps: [
        'Kill a Pig to get Raw Porkchop',
        'Place Raw Porkchop in the top slot of a Furnace or Smoker',
        'Add fuel in the bottom slot',
        'Wait for it to cook — collect your Cooked Porkchop!',
        'Alternative: Place on a lit Campfire (30 seconds)',
      ],
      station: 'Furnace / Smoker / Campfire',
    },
  },
  cooked_mutton: {
    obtainedBy: ['Cook Raw Mutton in a Furnace, Smoker, or Campfire'],
    procedure: {
      steps: [
        'Kill a Sheep to get Raw Mutton',
        'Cook Raw Mutton in a Furnace, Smoker, or on a Campfire',
      ],
      station: 'Furnace / Smoker / Campfire',
    },
  },
  cooked_rabbit: {
    obtainedBy: ['Cook Raw Rabbit in a Furnace, Smoker, or Campfire'],
    procedure: {
      steps: [
        'Kill a Rabbit to get Raw Rabbit',
        'Cook Raw Rabbit in a Furnace, Smoker, or on a Campfire',
      ],
      station: 'Furnace / Smoker / Campfire',
    },
  },
  cooked_salmon: {
    obtainedBy: ['Cook Raw Salmon in a Furnace, Smoker, or Campfire', 'Fishing'],
    procedure: {
      steps: [
        'Catch Raw Salmon by fishing or kill a Salmon mob',
        'Cook Raw Salmon in a Furnace, Smoker, or on a Campfire',
      ],
      station: 'Furnace / Smoker / Campfire',
    },
  },
  cooked_cod: {
    obtainedBy: ['Cook Raw Cod in a Furnace, Smoker, or Campfire', 'Fishing'],
    procedure: {
      steps: [
        'Catch Raw Cod by fishing or kill a Cod mob',
        'Cook Raw Cod in a Furnace, Smoker, or on a Campfire',
      ],
      station: 'Furnace / Smoker / Campfire',
    },
  },
  baked_potato: {
    obtainedBy: ['Cook a Potato in a Furnace, Smoker, or Campfire'],
    procedure: {
      steps: [
        'Harvest Potatoes from village farms or zombie drops',
        'Cook the Potato in a Furnace, Smoker, or on a Campfire',
      ],
      station: 'Furnace / Smoker / Campfire',
    },
  },
  dried_kelp: {
    obtainedBy: ['Cook Kelp in a Furnace, Smoker, or Campfire'],
    procedure: {
      steps: [
        'Harvest Kelp from ocean floors',
        'Cook the Kelp in a Furnace or Smoker to get Dried Kelp',
        '9 Dried Kelp can be crafted into a Dried Kelp Block (fuel)',
      ],
      station: 'Furnace / Smoker',
    },
  },
  // ── Smelted items ──────────────────────────────────────────
  iron_ingot: {
    locations: ['Smelt Raw Iron', 'Village chests', 'Dungeon chests', 'Stronghold chests'],
    obtainedBy: ['Furnace + Raw Iron', 'Iron Golem drops (3-5)', 'Blast Furnace (2× speed)'],
    procedure: {
      steps: [
        'Mine Iron Ore with a Stone Pickaxe or better to get Raw Iron',
        'Place Raw Iron in the top slot of a Furnace or Blast Furnace',
        'Add fuel (coal, charcoal, etc.) in the bottom slot',
        'Wait for smelting to complete — collect your Iron Ingot!',
      ],
      station: 'Furnace / Blast Furnace',
      fuel: 'Coal, Charcoal, Wood, Lava Bucket, or any burnable item',
    },
  },
  gold_ingot: {
    locations: ['Smelt Raw Gold', 'Nether Fortress chests', 'Bastion chests'],
    obtainedBy: ['Furnace + Raw Gold', 'Zombified Piglin drops', 'Blast Furnace (2× speed)'],
    procedure: {
      steps: [
        'Mine Gold Ore with an Iron Pickaxe or better to get Raw Gold',
        'Place Raw Gold in the top slot of a Furnace or Blast Furnace',
        'Add fuel in the bottom slot',
        'Wait for smelting to complete — collect your Gold Ingot!',
      ],
      station: 'Furnace / Blast Furnace',
    },
  },
  copper_ingot: {
    locations: ['Smelt Raw Copper'],
    obtainedBy: ['Furnace + Raw Copper', 'Blast Furnace (2× speed)'],
    procedure: {
      steps: [
        'Mine Copper Ore with a Stone Pickaxe or better to get Raw Copper',
        'Smelt Raw Copper in a Furnace or Blast Furnace',
      ],
      station: 'Furnace / Blast Furnace',
    },
  },
  netherite_scrap: {
    locations: ['Smelt Ancient Debris in a Furnace'],
    obtainedBy: ['Furnace + Ancient Debris'],
    procedure: {
      steps: [
        'Mine Ancient Debris in the Nether (y=8-22) with a Diamond Pickaxe',
        'Place Ancient Debris in the top slot of a Furnace or Blast Furnace',
        'Add fuel — smelt to get Netherite Scrap',
        'Combine 4 Netherite Scraps + 4 Gold Ingots on a crafting table to make a Netherite Ingot',
      ],
      station: 'Furnace / Blast Furnace',
    },
  },
  glass: {
    locations: ['Smelt Sand in Furnace'],
    obtainedBy: ['Furnace + Sand'],
    procedure: {
      steps: [
        'Dig Sand from beaches, deserts, or rivers',
        'Smelt Sand in a Furnace to get Glass',
      ],
      station: 'Furnace',
    },
  },
  // ── Bucket items ──────────────────────────────────────────
  lava_bucket: {
    locations: ['Nether (lava oceans)', 'Overworld (underground pools, y=0-10)', 'Ruined Portals'],
    obtainedBy: ['Use an empty Bucket on a Lava source block'],
    procedure: {
      steps: [
        'Craft a Bucket using 3 Iron Ingots (V-shape on crafting table)',
        'Find a Lava source block (Nether is the easiest — infinite lava)',
        'Right-click the Lava source with the empty Bucket',
        'You now have a Lava Bucket! (also works as furnace fuel for 100 items)',
      ],
      station: 'None — use Bucket directly on lava',
    },
    notes: 'A Lava Bucket is the best furnace fuel, smelting 100 items per bucket',
  },
  water_bucket: {
    locations: ['Any water source'],
    obtainedBy: ['Use an empty Bucket on a Water source block'],
    procedure: {
      steps: [
        'Craft a Bucket using 3 Iron Ingots (V-shape on crafting table)',
        'Right-click any Water source block with the empty Bucket',
      ],
      station: 'None — use Bucket directly on water',
    },
  },
  milk_bucket: {
    obtainedBy: ['Use an empty Bucket on a Cow or Mooshroom'],
    procedure: {
      steps: [
        'Craft a Bucket using 3 Iron Ingots',
        'Find a Cow or Mooshroom',
        'Right-click the Cow with the empty Bucket',
        'Milk Bucket clears all status effects when consumed!',
      ],
      station: 'None — use Bucket on a Cow',
    },
    notes: 'Drinking Milk removes all potion/status effects, including bad ones',
  },
  // ── Missing FORCE_RESOURCE items ──────────────────────────
  rabbit_hide: { locations: ['Overworld (deserts, taigas, snowy biomes)'], obtainedBy: ['Kill Rabbits'], notes: '4 Rabbit Hides can be crafted into 1 Leather' },
  rabbit_foot: { locations: ['Overworld (deserts, taigas, snowy biomes)'], obtainedBy: ['Kill Rabbits (10% chance, increased with Looting)'], notes: 'Brewing ingredient for Potion of Leaping' },
  honey_bottle: { locations: ['Plains', 'Flower Forest', 'Meadow biomes'], obtainedBy: ['Use Glass Bottle on full Bee Nest/Beehive (honey_level 5)'], notes: 'Place a campfire under the hive to prevent bees from attacking. Restores 6 hunger points.' },
  amethyst_shard: { locations: ['Amethyst Geodes (underground, y=-58 to y=30)'], obtainedBy: ['Mine Amethyst Clusters with any Pickaxe', 'Fortune increases drops'], notes: 'Only fully grown Amethyst Clusters drop shards. Used to craft Spyglass, Tinted Glass, and Calibrated Sculk Sensors.' },
  echo_shard: { locations: ['Ancient City chests (Deep Dark biome)'], obtainedBy: ['Loot Ancient City chests'], notes: 'Used to craft Recovery Compass. Ancient Cities generate at y=-52 in Deep Dark biomes. Watch out for the Warden!' },
  sweet_berries: { locations: ['Taiga biomes', 'Old Growth Taiga'], obtainedBy: ['Harvest Sweet Berry Bushes', 'Replantable'], notes: 'Berry bushes slow and damage entities that walk through them — useful for defense!' },
  glow_berries: { locations: ['Lush Caves (ceiling vines)'], obtainedBy: ['Harvest from Cave Vines', 'Replantable on cave ceilings'], notes: 'Emit light when growing. Can be used to breed Foxes.' },
  kelp: { locations: ['Ocean floors (all ocean variants)'], obtainedBy: ['Break kelp plants'], notes: 'Can be dried in a Furnace for Dried Kelp. Grows underwater when planted on ocean floor.' },
  cactus: { locations: ['Desert biomes', 'Badlands biomes'], obtainedBy: ['Break Cactus blocks'], notes: 'Can be smelted into Green Dye. Damages entities on contact. Grows up to 3 blocks tall.' },
  crying_obsidian: { locations: ['Ruined Portals', 'Bastion Remnant chests'], obtainedBy: ['Piglin bartering (Gold Ingots)', 'Mine from Ruined Portals with Diamond Pickaxe'], notes: 'Used to craft Respawn Anchors for Nether respawning' },
  soul_soil: { locations: ['Nether (Soul Sand Valley)'], obtainedBy: ['Dig with Shovel'], notes: 'Unlike Soul Sand, does not slow movement. Blue fire burns on Soul Soil.' },
  red_sand: { locations: ['Badlands (Mesa) biomes'], obtainedBy: ['Dig with Shovel'], notes: 'Functions like regular Sand but cannot be smelted into Glass.' },
  mangrove_log: { locations: ['Mangrove Swamp biomes'], obtainedBy: ['Chop Mangrove Trees'] },
  cobbled_deepslate: { locations: ['Overworld (below y=0)'], obtainedBy: ['Mine Deepslate without Silk Touch'] },
  // ── Rare Mob Drops ────────────────────────────────────────
  trident: { locations: ['Oceans', 'Rivers', 'Rain'], obtainedBy: ['Kill Drowned that are holding a Trident (6.25% drop in Java Edition)'], notes: 'Cannot be crafted! Only obtainable from Drowned. Can be enchanted with Loyalty, Riptide, Channeling, and Impaling.' },
  totem_of_undying: { locations: ['Woodland Mansions', 'Pillager Raids'], obtainedBy: ['Kill Evokers (always drops 1)'], notes: 'When held in either hand, prevents death once, granting Regeneration and Absorption effects.' },
  wither_skeleton_skull: { locations: ['Nether Fortress'], obtainedBy: ['Kill Wither Skeletons (2.5% chance, Looting III increases to 5.5%)'], notes: '3 skulls + 4 Soul Sand/Soil are needed to summon the Wither boss.' },
  rotten_flesh: { locations: ['Overworld (night)', 'Dungeons', 'Temples'], obtainedBy: ['Kill Zombies', 'Kill Drowned', 'Kill Husks', 'Kill Zombie Villagers'], notes: 'Eating grants 4 hunger but has 80% chance of giving Hunger effect. Can be traded to Cleric villagers.' },
  magma_cream: { locations: ['Nether (Basalt Deltas)'], obtainedBy: ['Kill Magma Cubes', 'Craft from Slime Ball + Blaze Powder'], notes: 'Brewing ingredient for Potion of Fire Resistance.' },
  // ── Boss & Endgame Items ──────────────────────────────────
  dragon_egg: { locations: ['The End (on top of exit portal)'], obtainedBy: ['Defeat the Ender Dragon (first kill only)', 'Push with piston or drop onto torch to collect'], notes: 'Unique item — only 1 exists per world! Teleports when clicked directly, use piston to collect.' },
  elytra: { locations: ['End Cities (End Ships)'], obtainedBy: ['Find in Item Frame on End Ships'], notes: 'Only found in End Ships attached to End Cities. Allows gliding flight. Repair with Phantom Membranes at an Anvil.' },
  dragon_breath: { locations: ['The End (during Ender Dragon fight)'], obtainedBy: ['Use Glass Bottle on Ender Dragon\'s breath/fireball clouds'], notes: 'Used to craft Lingering Potions (splash potions that leave area-of-effect clouds).' },
  // ── Dungeon / Structure Loot Only ─────────────────────────
  saddle: { locations: ['Dungeons', 'Desert Temples', 'Nether Fortress', 'End Cities', 'Village Tanneries'], obtainedBy: ['Loot from chests', 'Fishing (treasure)', 'Trading with Leatherworker villagers'], notes: 'Cannot be crafted! Used to ride Horses, Pigs (with Carrot on a Stick), and Striders (with Warped Fungus on a Stick).' },
  name_tag: { locations: ['Dungeons', 'Mineshafts', 'Woodland Mansions', 'Ancient Cities'], obtainedBy: ['Loot from chests', 'Fishing (treasure)', 'Trading with Librarian villagers (master level)'], notes: 'Cannot be crafted! Use an Anvil to write a name, then right-click a mob to name it. Named mobs never despawn.' },
  enchanted_golden_apple: { locations: ['Dungeons', 'Desert Temples', 'Woodland Mansions', 'Ancient Cities', 'Mineshafts', 'Ruined Portals'], obtainedBy: ['Chest loot only'], notes: 'Cannot be crafted (since 1.9)! Grants Absorption IV, Regeneration II, Fire Resistance, and Resistance. Extremely rare.' },
  iron_horse_armor: { locations: ['Dungeons', 'Desert Temples', 'End Cities', 'Nether Fortress', 'Village Weaponsmith chests'], obtainedBy: ['Chest loot only'], notes: 'Cannot be crafted! Equip on a Horse for protection (no durability).' },
  golden_horse_armor: { locations: ['Dungeons', 'Desert Temples', 'End Cities', 'Nether Fortress', 'Ruined Portals'], obtainedBy: ['Chest loot only'], notes: 'Cannot be crafted! Better protection than Iron Horse Armor.' },
  diamond_horse_armor: { locations: ['Dungeons', 'Desert Temples', 'End Cities', 'Nether Fortress'], obtainedBy: ['Chest loot only'], notes: 'Cannot be crafted! Best horse armor in the game (11 armor points).' },
  disc_fragment_5: { locations: ['Ancient City chests'], obtainedBy: ['Loot Ancient City chests'], notes: '9 Disc Fragments can be crafted into Music Disc 5. Ancient Cities are in the Deep Dark biome.' },
  music_disc_13: { locations: ['Dungeon chests', 'Woodland Mansion chests'], obtainedBy: ['Chest loot', 'Creeper killed by a Skeleton or Stray'], notes: 'All music discs (except 5 and Pigstep) can drop when a Skeleton kills a Creeper.' },
  music_disc_pigstep: { locations: ['Bastion Remnant chests'], obtainedBy: ['Bastion Remnant chests only (5.6% chance)'], notes: 'The rarest music disc! Only found in Bastion Remnants, cannot be obtained from Creeper+Skeleton.' },
  music_disc_otherside: { locations: ['Dungeon chests', 'Stronghold corridor chests'], obtainedBy: ['Chest loot only'], notes: 'Rare disc added in 1.18. Does NOT drop from Creeper+Skeleton.' },
  // ── Brewing Ingredients ───────────────────────────────────
  nether_wart: { locations: ['Nether Fortress (stairwell gardens)', 'Bastion Remnant chests'], obtainedBy: ['Harvest from Nether Fortress', 'Farmable on Soul Sand in any dimension'], notes: 'Base ingredient for most potions. Plant on Soul Sand to farm — grows in any dimension.' },
  turtle_scute: {
    locations: ['Beach biomes (where turtles live)'], obtainedBy: ['Baby Turtle drops 1 Scute when it grows into an adult'], notes: 'Breed 2 adult Turtles with Seagrass. The baby returns to its home beach and drops a Scute when grown. 5 Scutes craft a Turtle Shell helmet (water breathing).',
    procedure: {
      steps: [
        'Find 2 Turtles on a beach (their home beach)',
        'Feed each Turtle Seagrass to breed them',
        'One turtle will lay eggs on its home beach',
        'Wait for eggs to hatch (crack 3 times, several in-game days)',
        'When the baby turtle grows up, it drops 1 Scute',
        'Collect 5 Scutes to craft a Turtle Shell helmet',
      ],
    },
  },
  // ── Missing Dyes (9 of 16) ───────────────────────────────
  orange_dye: { obtainedBy: ['Orange Tulip', 'Torchflower', 'Craft from Red Dye + Yellow Dye'] },
  magenta_dye: { obtainedBy: ['Allium', 'Lilac', 'Craft from Purple Dye + Pink Dye', 'Craft from Blue + Red + Pink Dye'] },
  light_blue_dye: { obtainedBy: ['Blue Orchid', 'Craft from Blue Dye + White Dye'] },
  lime_dye: { obtainedBy: ['Smelt Sea Pickle in Furnace', 'Craft from Green Dye + White Dye'] },
  pink_dye: { obtainedBy: ['Pink Tulip', 'Peony', 'Pink Petals', 'Craft from Red Dye + White Dye'] },
  gray_dye: { obtainedBy: ['Craft from Black Dye + White Dye'] },
  light_gray_dye: { obtainedBy: ['Azure Bluet', 'Oxeye Daisy', 'White Tulip', 'Craft from Gray Dye + White Dye', 'Craft from Black Dye + 2 White Dye'] },
  cyan_dye: { obtainedBy: ['Pitcher Plant', 'Craft from Blue Dye + Green Dye'] },
  purple_dye: { obtainedBy: ['Craft from Blue Dye + Red Dye'] },
  // ── Mob Heads ─────────────────────────────────────────────
  skeleton_skull: { locations: ['Overworld'], obtainedBy: ['Skeleton killed by a Charged Creeper explosion'], notes: 'Charged Creepers are created when lightning strikes near a Creeper.' },
  zombie_head: { locations: ['Overworld'], obtainedBy: ['Zombie killed by a Charged Creeper explosion'] },
  creeper_head: { locations: ['Overworld'], obtainedBy: ['Creeper killed by a Charged Creeper explosion'] },
  piglin_head: { locations: ['Nether'], obtainedBy: ['Piglin killed by a Charged Creeper explosion'] },
  dragon_head: { locations: ['End Cities (End Ships)'], obtainedBy: ['Found on the bow of End Ships'], notes: 'Decorative block that opens and closes its mouth with redstone.' },
  // ── 1.20 Archaeology & Misc ───────────────────────────────
  sniffer_egg: { locations: ['Warm Ocean Ruins (Suspicious Sand)'], obtainedBy: ['Brush Suspicious Sand in Warm Ocean Ruins', 'Two Sniffers can breed with Torchflower Seeds'], notes: 'Hatches into a Sniffer, which can dig up ancient Torchflower and Pitcher Pod seeds.' },
  goat_horn: { locations: ['Frozen Peaks', 'Jagged Peaks', 'Snowy Slopes', 'Pillager Outposts'], obtainedBy: ['Goat rams into a block (drops 1 horn)', 'Pillager Outpost chests'], notes: '8 variants exist. Only screaming goats can drop the 4 rare variants. Regular goats drop 4 common variants.' },
  // ── Additional Useful Items ───────────────────────────────
  brick: { locations: ['Smelt Clay Ball'], obtainedBy: ['Furnace + Clay Ball'], procedure: { steps: ['Dig Clay blocks from rivers or shallow ponds (drops 4 Clay Balls)', 'Smelt Clay Balls in a Furnace to get Bricks', '4 Bricks craft into a Brick block'], station: 'Furnace' } },
  nether_brick: { locations: ['Nether Fortress'], obtainedBy: ['Smelt Netherrack in a Furnace', 'Found in Nether Fortresses'], procedure: { steps: ['Mine Netherrack in the Nether', 'Smelt Netherrack in a Furnace to get Nether Bricks'], station: 'Furnace' } },
  iron_nugget: { locations: ['Smelt iron gear', 'Ruined Portal chests'], obtainedBy: ['Craft from Iron Ingot (9 nuggets)', 'Smelt iron tools/armor in Furnace'] },
  gold_nugget: { locations: ['Nether (mine Nether Gold Ore)', 'Ruined Portal chests'], obtainedBy: ['Craft from Gold Ingot (9 nuggets)', 'Kill Zombified Piglins', 'Mine Nether Gold Ore', 'Smelt gold tools/armor in Furnace'] },
  clay: { locations: ['Rivers', 'Shallow ponds', 'Lush Caves'], obtainedBy: ['Dig Clay blocks with Silk Touch'], notes: 'Without Silk Touch, Clay blocks drop 4 Clay Balls instead.' },
  charcoal: { obtainedBy: ['Smelt Oak/Birch/Spruce/etc. Logs in a Furnace'], procedure: { steps: ['Chop any tree to get Logs', 'Smelt Logs in a Furnace to get Charcoal', 'Works identically to Coal as fuel'], station: 'Furnace' }, notes: 'Renewable alternative to Coal. Great early-game fuel source.' },
  snowball: { locations: ['Snowy biomes', 'Snowy Taiga', 'Ice Spikes'], obtainedBy: ['Dig Snow layers with Shovel', 'Kill Snow Golems'] },
  experience_bottle: { locations: ['Pillager Outpost chests', 'Ancient City chests', 'Buried Treasure chests'], obtainedBy: ['Trading with Cleric villagers (Emeralds)', 'Chest loot'], notes: 'Grants 3-11 XP when thrown. Cannot be filled by players.' },
  // ── Ore Blocks ─────────────────────────────────────────────
  diamond_ore: { locations: ['Overworld (y=-64 to y=16, best at y=-59)'], obtainedBy: ['Mine with Iron Pickaxe or better'], notes: 'Drops 1 Diamond (Fortune III gives up to 4). Use Silk Touch to get the ore block itself.' },
  deepslate_diamond_ore: { locations: ['Overworld (y=-64 to y=-4)'], obtainedBy: ['Mine with Iron Pickaxe or better'], notes: 'Deepslate variant of Diamond Ore. Same drops as regular Diamond Ore.' },
  iron_ore: { locations: ['Overworld (y=-24 to y=56, best at y=16)'], obtainedBy: ['Mine with Stone Pickaxe or better'], notes: 'Drops Raw Iron. Smelt in a Furnace or Blast Furnace to get Iron Ingots.' },
  deepslate_iron_ore: { locations: ['Overworld (y=-64 to y=0)'], obtainedBy: ['Mine with Stone Pickaxe or better'] },
  gold_ore: { locations: ['Overworld (y=-64 to y=32)', 'Badlands biome at all heights'], obtainedBy: ['Mine with Iron Pickaxe or better'], notes: 'Drops Raw Gold. Smelt to get Gold Ingots.' },
  deepslate_gold_ore: { locations: ['Overworld (y=-64 to y=-4)'], obtainedBy: ['Mine with Iron Pickaxe or better'] },
  copper_ore: { locations: ['Overworld (y=-16 to y=112, best at y=48)'], obtainedBy: ['Mine with Stone Pickaxe or better'], notes: 'Drops 2-5 Raw Copper. Large veins in Dripstone Caves.' },
  deepslate_copper_ore: { locations: ['Overworld (y=-64 to y=0)'], obtainedBy: ['Mine with Stone Pickaxe or better'] },
  coal_ore: { locations: ['Overworld (y=0 to y=320, common above y=96)'], obtainedBy: ['Mine with any Pickaxe'], notes: 'Drops Coal. Most common ore, found at high elevations.' },
  deepslate_coal_ore: { locations: ['Overworld (y=-64 to y=0)'], obtainedBy: ['Mine with any Pickaxe'] },
  lapis_ore: { locations: ['Overworld (y=-64 to y=64, best at y=0)'], obtainedBy: ['Mine with Stone Pickaxe or better'], notes: 'Drops 4-9 Lapis Lazuli. Used for enchanting and blue dye.' },
  deepslate_lapis_ore: { locations: ['Overworld (y=-64 to y=0)'], obtainedBy: ['Mine with Stone Pickaxe or better'] },
  redstone_ore: { locations: ['Overworld (y=-64 to y=15)'], obtainedBy: ['Mine with Iron Pickaxe or better'], notes: 'Drops 4-5 Redstone Dust. Glows when stepped on or mined.' },
  deepslate_redstone_ore: { locations: ['Overworld (y=-64 to y=-4)'], obtainedBy: ['Mine with Iron Pickaxe or better'] },
  emerald_ore: { locations: ['Mountain biomes only (y=-16 to y=320)'], obtainedBy: ['Mine with Iron Pickaxe or better'], notes: 'Rarest overworld ore. Only spawns in Mountain biomes. Drops 1 Emerald.' },
  deepslate_emerald_ore: { locations: ['Mountain biomes (y=-16 to y=0)'], obtainedBy: ['Mine with Iron Pickaxe or better'], notes: 'Extremely rare — the rarest ore in the game.' },
  nether_gold_ore: { locations: ['Nether (all altitudes, common in Nether Wastes)'], obtainedBy: ['Mine with any Pickaxe'], notes: 'Drops 2-6 Gold Nuggets. Aggravates nearby Piglins when mined!' },
  nether_quartz_ore: { locations: ['Nether (all altitudes)'], obtainedBy: ['Mine with any Pickaxe'], notes: 'Drops 1 Nether Quartz. Good XP source for early Nether visits.' },
  // ── Potions & Brewing ─────────────────────────────────────
  potion: {
    locations: ['Brewing Stand'],
    obtainedBy: ['Brew at a Brewing Stand'],
    notes: 'Potions are brewed, not crafted. Each potion requires a specific ingredient added to an Awkward Potion. Modifiers: Redstone extends duration, Glowstone amplifies effect, Fermented Spider Eye corrupts.',
    procedure: {
      steps: [
        'Craft a Brewing Stand: place 1 Blaze Rod on top + 3 Cobblestone on bottom row of a crafting table',
        'Craft Glass Bottles: 3 Glass in a V-shape on a crafting table → 3 Glass Bottles',
        'Fill the Glass Bottles: right-click any water source block while holding a Glass Bottle → Water Bottle',
        'Place up to 3 Water Bottles in the bottom 3 slots of the Brewing Stand',
        'Add Blaze Powder to the fuel slot (top-left square) — 1 Blaze Powder = 20 brew operations',
        'Add Nether Wart to the top ingredient slot → all 3 Water Bottles become Awkward Potions',
        'Now add your desired effect ingredient to the top slot:',
        '  • Glistering Melon Slice → Potion of Healing (instant health)',
        '  • Golden Carrot → Potion of Night Vision (3:00)',
        '  • Magma Cream → Potion of Fire Resistance (3:00)',
        '  • Sugar → Potion of Swiftness (3:00)',
        '  • Rabbit Foot → Potion of Leaping (3:00)',
        '  • Blaze Powder → Potion of Strength (3:00)',
        '  • Ghast Tear → Potion of Regeneration (0:45)',
        '  • Glistering Melon → Potion of Healing (instant)',
        '  • Spider Eye → Potion of Poison (0:45)',
        '  • Pufferfish → Potion of Water Breathing (3:00)',
        '  • Phantom Membrane → Potion of Slow Falling (1:30)',
        '  • Turtle Shell → Potion of the Turtle Master (Slowness + Resistance)',
        'Optional modifiers (add after the effect ingredient):',
        '  • Redstone Dust → extends potion duration (e.g., 3:00 → 8:00)',
        '  • Glowstone Dust → amplifies to level II (but shortens duration)',
        '  • Gunpowder → converts to Splash Potion (throwable)',
        '  • Dragon Breath → converts Splash to Lingering Potion (area effect cloud)',
        '  • Fermented Spider Eye → corrupts potion (e.g., Healing → Harming, Night Vision → Invisibility)',
      ],
      station: 'Brewing Stand',
      fuel: 'Blaze Powder (1 powder = 20 brews)',
    },
  },
  splash_potion: {
    obtainedBy: ['Add Gunpowder to any Potion in a Brewing Stand'],
    notes: 'Throwable potion that affects all entities in the splash radius. Reduced duration compared to drinkable version.',
    procedure: {
      steps: [
        'Brew a regular Potion first (Water Bottle → Nether Wart → effect ingredient)',
        'Place the finished Potion(s) in the bottom slots of the Brewing Stand',
        'Add Gunpowder to the top ingredient slot',
        'Wait for brewing to finish — the Potion converts to a Splash Potion',
        'Throw with right-click — affects all entities within ~4 block radius',
      ],
      station: 'Brewing Stand',
      fuel: 'Blaze Powder',
    },
  },
  lingering_potion: {
    obtainedBy: ['Add Dragon Breath to any Splash Potion in a Brewing Stand'],
    notes: 'Creates an area-of-effect cloud that lingers for 30 seconds. Also used to craft Tipped Arrows (8 arrows + 1 lingering potion).',
    procedure: {
      steps: [
        'Brew a Splash Potion first (Potion + Gunpowder)',
        'Obtain Dragon Breath: use an empty Glass Bottle on the Ender Dragon\'s purple breath/fireball clouds',
        'Place the Splash Potion(s) in the bottom slots of the Brewing Stand',
        'Add Dragon Breath to the top ingredient slot',
        'The Splash Potion converts to a Lingering Potion',
        'When thrown, leaves a purple area-of-effect cloud for ~30 seconds',
      ],
      station: 'Brewing Stand',
      fuel: 'Blaze Powder',
    },
  },
  glass_bottle: {
    obtainedBy: ['Craft from 3 Glass blocks in a V-shape (yields 3 bottles)', 'Witch drops', 'Fishing (junk)'],
    procedure: {
      steps: [
        'Smelt Sand in a Furnace to get Glass',
        'Place 3 Glass in a V-shape on a crafting table: Glass / empty / Glass / empty / Glass / empty',
        'Yields 3 Glass Bottles',
        'Right-click any water source block to fill → Water Bottle',
      ],
      station: 'Crafting Table',
    },
  },
  brewing_stand: {
    locations: ['Nether Fortress', 'Village churches', 'End Ships', 'Igloos (basement)'],
    obtainedBy: ['Craft from 1 Blaze Rod + 3 Cobblestone', 'Found pre-placed in structures'],
    notes: 'The only station for brewing potions. Requires Blaze Powder as fuel (1 powder = 20 operations).',
    procedure: {
      steps: [
        'Kill Blazes in a Nether Fortress to get Blaze Rods',
        'Craft on a crafting table: 1 Blaze Rod in the center + 3 Cobblestone on the bottom row',
        'Place the Brewing Stand on the ground',
        'Add Blaze Powder to the fuel slot (top-left) — required before any brewing',
        'Place up to 3 bottles in the bottom 3 slots',
        'Add an ingredient to the top slot — brewing takes 20 seconds per operation',
        'The ingredient is consumed, and all 3 bottles are brewed simultaneously',
      ],
      station: 'Crafting Table → then place as block',
      fuel: 'Blaze Powder (1 = 20 brews)',
    },
  },
  blaze_powder: {
    obtainedBy: ['Craft from 1 Blaze Rod → yields 2 Blaze Powder'],
    notes: 'Essential for brewing (fuel) and crafting Eyes of Ender. Also used to craft Magma Cream and Fire Charges.',
    procedure: {
      steps: [
        'Travel to the Nether and find a Nether Fortress',
        'Locate Blaze spawners (found on fortress balconies/platforms)',
        'Kill Blazes to collect Blaze Rods (0-1 per kill, Looting helps)',
        'Place 1 Blaze Rod in a crafting grid → 2 Blaze Powder',
      ],
      station: 'Crafting Table (or inventory 2×2 grid)',
    },
  },
  fermented_spider_eye: {
    obtainedBy: ['Craft from Spider Eye + Sugar + Brown Mushroom'],
    notes: 'Corrupts/inverts potions: Healing→Harming, Poison→Harming, Night Vision→Invisibility, Water Breathing→Harming, Swiftness→Slowness, Leaping→Slowness, Fire Resistance→Slowness.',
    procedure: {
      steps: [
        'Get a Spider Eye (kill Spiders at night)',
        'Get Sugar (craft from Sugar Cane)',
        'Get a Brown Mushroom (found in dark areas, caves, Mushroom Islands, or Nether)',
        'Combine all 3 in a crafting grid (shapeless recipe) → 1 Fermented Spider Eye',
        'To use: add to a Potion in a Brewing Stand to corrupt it into its negative version',
      ],
      station: 'Crafting Table (shapeless)',
    },
  },
  glistering_melon_slice: {
    obtainedBy: ['Craft from 1 Melon Slice + 8 Gold Nuggets'],
    notes: 'Brewing ingredient for Potion of Healing (Instant Health). Unlike Golden Carrot, cannot be eaten.',
    procedure: {
      steps: [
        'Get a Melon Slice (break Melon blocks or farm Melon Seeds)',
        'Get 8 Gold Nuggets (craft 1 Gold Ingot → 9 Gold Nuggets)',
        'Place 1 Melon Slice in the center of a crafting table, surround with 8 Gold Nuggets',
        'Use in Brewing Stand: Awkward Potion + Glistering Melon Slice → Potion of Healing',
      ],
      station: 'Crafting Table',
    },
  },
  golden_carrot: {
    locations: ['Ruined Portal chests', 'Bastion Remnant chests'],
    obtainedBy: ['Craft from 1 Carrot + 8 Gold Nuggets', 'Trading with Master Farmer villagers (3 Emeralds)'],
    notes: 'Best food saturation in the game (14.4)! Also the brewing ingredient for Potion of Night Vision.',
    procedure: {
      steps: [
        'Get a Carrot (village farms, Zombie drops, or Shipwreck chests)',
        'Get 8 Gold Nuggets (craft 1 Gold Ingot → 9 Gold Nuggets)',
        'Place 1 Carrot in the center of a crafting table, surround with 8 Gold Nuggets',
        'As food: restores 6 hunger + 14.4 saturation (best saturation in the game)',
        'For brewing: Awkward Potion + Golden Carrot → Potion of Night Vision (3:00)',
      ],
      station: 'Crafting Table',
    },
  },
  // ── Additional Common Items ───────────────────────────────
  stick: { obtainedBy: ['Craft from 2 Planks (yields 4 Sticks)', 'Dead Bushes drop 0-2 Sticks', 'Witch drops', 'Fishing (junk)'] },
  torch: { obtainedBy: ['Craft from 1 Stick + 1 Coal or Charcoal (yields 4 Torches)'] },
  crafting_table: { obtainedBy: ['Craft from 4 Planks (any wood type)'] },
  furnace: { obtainedBy: ['Craft from 8 Cobblestone'] },
  chest: { obtainedBy: ['Craft from 8 Planks (any wood type)', 'Found in most structures'] },
  bucket: { obtainedBy: ['Craft from 3 Iron Ingots (V-shape)'] },
};

/**
 * Get detailed information about a Minecraft item including recipe visualization,
 * acquisition sources, entity drops, and block loot.
 */
export function getItemDetail(itemName: string) {
  const item = mcData.itemsByName[itemName];
  if (!item) return null;

  const category = determineItemCategory(item.name);
  const isVariantItem = VARIANT_ITEMS.has(item.name);
  const possibleEnchantments = isVariantItem ? [] : getEnchantmentsForCategory(category);
  const resource = isRawResource(item.name, item.id);
  const hasRecipe = !!(
    (mcData.recipes[item.id] && mcData.recipes[item.id].length > 0)
    || MANUAL_RECIPES[item.name]
  );

  // ── Recipe detail ──────────────────────────────────────────
  let recipe: any = null;
  if (hasRecipe) {
    const recipes = mcData.recipes[item.id];
    if (recipes && recipes.length > 0) {
      const r = recipes[0] as any;
      if (r.inShape) {
        // Shaped recipe — build 3×3 grid with item names
        const grid: (null | { name: string; displayName: string })[][] = [];
        for (const row of r.inShape) {
          const gridRow: (null | { name: string; displayName: string })[] = [];
          for (const slot of row) {
            if (slot !== null && slot !== undefined) {
              const slotItem = mcData.items[slot];
              gridRow.push(slotItem
                ? { name: slotItem.name, displayName: slotItem.displayName }
                : null);
            } else {
              gridRow.push(null);
            }
          }
          grid.push(gridRow);
        }
        // Pad to 3 rows
        while (grid.length < 3) grid.push([null, null, null]);
        // Pad each row to 3 cols
        for (const row of grid) {
          while (row.length < 3) row.push(null);
        }
        const resultCount = r.result
          ? (typeof r.result.count === 'number' ? r.result.count : 1)
          : 1;
        recipe = {
          type: 'shaped',
          grid,
          outputCount: resultCount,
        };
      } else if (r.ingredients) {
        // Shapeless recipe
        const ingredients: { name: string; displayName: string }[] = [];
        for (const ingId of r.ingredients) {
          const ingItem = mcData.items[ingId];
          if (ingItem) {
            ingredients.push({ name: ingItem.name, displayName: ingItem.displayName });
          }
        }
        const resultCount = r.result
          ? (typeof r.result.count === 'number' ? r.result.count : 1)
          : 1;
        recipe = {
          type: 'shapeless',
          ingredients,
          outputCount: resultCount,
        };
      }
    } else if (MANUAL_RECIPES[item.name]) {
      // Manual recipe (smithing table etc.)
      const ingredients = MANUAL_RECIPES[item.name].map(ing => {
        const ingItem = mcData.itemsByName[ing.ingredientName];
        return {
          name: ing.ingredientName,
          displayName: ingItem ? ingItem.displayName : ing.ingredientName.replace(/_/g, ' '),
          qty: ing.qty,
        };
      });
      recipe = {
        type: 'smithing',
        ingredients,
        outputCount: 1,
      };
    }
  }

  // ── Entity drops (which mobs drop this item) ───────────────
  const entityDrops: { entity: string; displayName: string; dropChance: number; stackSizeRange: [number, number] }[] = [];
  const entityLootRaw = (mcData as any).entityLoot || {};
  const entityLoot: any[] = Array.isArray(entityLootRaw) ? entityLootRaw : Object.values(entityLootRaw);
  for (const lootEntry of entityLoot) {
    if (!lootEntry.drops) continue;
    for (const drop of lootEntry.drops) {
      // drop.item can be item ID or name
      const dropItemId = typeof drop.item === 'number' ? drop.item : null;
      const dropItemName = typeof drop.item === 'string' ? drop.item : null;

      let matches = false;
      if (dropItemId !== null && dropItemId === item.id) matches = true;
      if (dropItemName && dropItemName === item.name) matches = true;
      // Also try matching by looking up the drop item
      if (dropItemId !== null) {
        const dropItem = mcData.items[dropItemId];
        if (dropItem && dropItem.name === item.name) matches = true;
      }

      if (matches) {
        const entityName = lootEntry.entity || 'unknown';
        const entity = (mcData as any).entitiesByName?.[entityName];
        entityDrops.push({
          entity: entityName,
          displayName: entity?.displayName || entityName.replace(/_/g, ' '),
          dropChance: drop.dropChance ?? 1,
          stackSizeRange: drop.stackSizeRange || [1, 1],
        });
      }
    }
  }

  // ── Block sources (which blocks drop this item) ────────────
  const blockSources: { block: string; displayName: string }[] = [];
  const blockLootRaw = (mcData as any).blockLoot || {};
  const blockLoot: any[] = Array.isArray(blockLootRaw) ? blockLootRaw : Object.values(blockLootRaw);
  for (const bl of blockLoot) {
    if (!bl.drops) continue;
    for (const dropName of bl.drops) {
      if (dropName === item.name) {
        const blockName = bl.block || 'unknown';
        const block = (mcData as any).blocksByName?.[blockName];
        blockSources.push({
          block: blockName,
          displayName: block?.displayName || blockName.replace(/_/g, ' '),
        });
        break; // one entry per block
      }
    }
  }

  // ── Manual acquisition info ────────────────────────────────
  const manualInfo = MANUAL_ACQUISITION[item.name] || null;

  // ── Image URL ──────────────────────────────────────────────
  const imageUrl = `https://mc-heads.net/item/${item.name}`;

  // ── Food info ──────────────────────────────────────────────
  let foodInfo: { foodPoints: number; saturation: number } | null = null;
  const foods: any[] = (mcData as any).foodsArray || [];
  for (const f of foods) {
    if (f.name === item.name) {
      foodInfo = { foodPoints: f.foodPoints, saturation: f.saturation };
      break;
    }
  }

  return {
    id: item.id,
    name: item.name,
    displayName: item.displayName,
    stackSize: item.stackSize,
    isResource: resource,
    hasRecipe,
    category,
    possibleEnchantments,
    possibleVariants: getPossibleVariants(item.name),
    imageUrl,
    recipe,
    entityDrops,
    blockSources,
    acquisition: manualInfo ? {
      locations: manualInfo.locations,
      obtainedBy: manualInfo.obtainedBy,
      notes: manualInfo.notes,
      procedure: manualInfo.procedure || null,
    } : null,
    foodInfo,
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
        // include category and enchantment hints in search results where helpful
        // (frontend may call /items/:itemName for full details)
      } as any);
      if (results.length >= limit) break;
    }
  }

  return results;
}

// Determine a broad item category from item name heuristics
function determineItemCategory(itemName: string): string {
  if (itemName.endsWith('_sword')) return 'sword';
  if (itemName.endsWith('_pickaxe')) return 'pickaxe';
  if (itemName.endsWith('_axe')) return 'axe';
  if (itemName.endsWith('_shovel')) return 'shovel';
  if (itemName.endsWith('_hoe')) return 'hoe';
  if (itemName.endsWith('_bow') || itemName === 'bow') return 'bow';
  if (itemName.includes('trident')) return 'trident';
  if (itemName.includes('fishing_rod')) return 'fishing_rod';
  if (itemName.endsWith('_helmet') || itemName.endsWith('_chestplate') || itemName.endsWith('_leggings') || itemName.endsWith('_boots')) return 'armor';
  if (itemName.includes('pickaxe') || itemName.includes('axe') || itemName.includes('shovel')) return 'tool';
  return 'generic';
}

// Map categories to common enchantments
function getEnchantmentsForCategory(category: string): { name: string; level: number; levelRequirements: number[] }[] {
  // Preferred approach: use minecraft-data's enchantment list when available
  const enchantmentsArray: any[] = (mcData as any).enchantmentsArray || [];

  // Helper to check presence in mcData and map to a simple object
  const enchMap = new Map(enchantmentsArray.map((e: any) => [e.name, e.maxLevel || 1]));
  const pick = (names: string[]) => {
    const out: { name: string; level: number; levelRequirements: number[] }[] = [];
    for (const n of names) {
      if (enchMap.has(n)) {
        const maxLvl = enchMap.get(n)!;
        // Build levelRequirements array: [minXP for level 1, minXP for level 2, ...]
        const reqs: number[] = [];
        for (let i = 1; i <= maxLvl; i++) {
          reqs.push(getEnchantmentMinLevel(n, i));
        }
        out.push({ name: n, level: maxLvl, levelRequirements: reqs });
      }
    }
    return out;
  };

  // Common enchantments useful for many tools
  const common = pick(['unbreaking', 'mending']);

  // Category → candidate enchantment names (fall back to heuristics)
  const candidates: Record<string, string[]> = {
    sword: ['sharpness', 'smite', 'bane_of_arthropods', 'knockback', 'fire_aspect', 'looting', 'sweeping'],
    pickaxe: ['efficiency', 'silk_touch', 'fortune'],
    axe: ['efficiency', 'silk_touch', 'fortune'],
    shovel: ['efficiency', 'silk_touch', 'fortune'],
    hoe: ['efficiency'],
    bow: ['power', 'punch', 'flame', 'infinity'],
    trident: ['impaling', 'loyalty', 'channeling', 'riptide'],
    fishing_rod: ['luck_of_the_sea', 'lure'],
    armor: ['protection', 'projectile_protection', 'blast_protection', 'fire_protection', 'thorns'],
  };

  const names = candidates[category] || [];
  const found = pick(names);

  // append common enchants that exist
  for (const c of common) {
    if (!found.find(f => f.name === c.name)) found.push(c);
  }

  // If none found from mcData, fall back to returning common or basic list
  if (found.length === 0) {
    // fallback hard-coded (ensures UI still has options)
    return (
      candidates[category]
        ? candidates[category].map(n => {
          const maxLvl = enchMap.get(n) || 5;
          const reqs: number[] = [];
          for (let i = 1; i <= maxLvl; i++) reqs.push(getEnchantmentMinLevel(n, i));
          return { name: n, level: maxLvl, levelRequirements: reqs };
        })
        : []
    ).concat(common.length ? common : []);
  }

  return found;
}

/** True if the item is an enchantable tool/armor and the chosen enchantment applies to it */
function enchantmentAppliesToItem(
  itemName: string,
  enchantments: { name: string; level: number }[] | null
): boolean {
  if (!enchantments || enchantments.length === 0) return false;
  if (itemName === 'enchanted_book') return false;
  const category = determineItemCategory(itemName);
  if (category === 'generic') return false;
  const possible = getEnchantmentsForCategory(category);
  const possibleNames = new Set(possible.map((p) => p.name));
  return enchantments.some((e) => possibleNames.has(e.name));
}
