/**
 * Enchantment Book Reference Data
 *
 * Provides information about:
 * - How many books are needed to reach a target enchantment level (anvil combining)
 * - Where to find enchanted books in Minecraft
 * - Max levels for each enchantment
 */

// ── Enchantment metadata ───────────────────────────────────────

export interface EnchantmentInfo {
  name: string;
  displayName: string;
  maxLevel: number;
  /** The max level obtainable from an enchanting table (books may go higher via combining) */
  maxTableLevel: number;
  /** Where enchanted books with this enchantment can be found */
  sources: EnchantmentSource[];
}

export interface EnchantmentSource {
  method: string;
  description: string;
  /** Approximate max level obtainable from this source */
  maxLevel: number;
  /** Icon hint for the UI */
  icon: string;
}

export interface BookRequirement {
  enchantmentName: string;
  displayName: string;
  targetLevel: number;
  /** Number of level-1 books needed (worst case, combining from scratch) */
  booksNeeded: number;
  /** Anvil steps to combine them */
  anvilSteps: AnvilStep[];
  sources: EnchantmentSource[];
}

export interface AnvilStep {
  step: number;
  description: string;
  inputLevel: number;
  outputLevel: number;
  count: number;
}

// ── Enchantment database ───────────────────────────────────────

const ENCHANTMENT_DATA: Record<string, Omit<EnchantmentInfo, 'name'>> = {
  // Sword enchantments
  sharpness: {
    displayName: 'Sharpness',
    maxLevel: 5,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table (up to level 4)', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Weaponsmith villager', maxLevel: 5, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Dungeon, Bastion Remnant, and Ancient City chests', maxLevel: 5, icon: '📦' },
      { method: 'Fishing', description: 'Rare catch while fishing with Luck of the Sea', maxLevel: 4, icon: '🎣' },
    ],
  },
  smite: {
    displayName: 'Smite',
    maxLevel: 5,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Weaponsmith villager', maxLevel: 5, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in various structure chests', maxLevel: 5, icon: '📦' },
    ],
  },
  bane_of_arthropods: {
    displayName: 'Bane of Arthropods',
    maxLevel: 5,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Weaponsmith villager', maxLevel: 5, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in various structure chests', maxLevel: 5, icon: '📦' },
    ],
  },
  knockback: {
    displayName: 'Knockback',
    maxLevel: 2,
    maxTableLevel: 2,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 2, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 2, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Dungeon and Mineshaft chests', maxLevel: 2, icon: '📦' },
    ],
  },
  fire_aspect: {
    displayName: 'Fire Aspect',
    maxLevel: 2,
    maxTableLevel: 2,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 2, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 2, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Bastion Remnant and Ruined Portal chests', maxLevel: 2, icon: '📦' },
    ],
  },
  looting: {
    displayName: 'Looting',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Ancient City and Bastion Remnant chests', maxLevel: 3, icon: '📦' },
      { method: 'Fishing', description: 'Rare catch while fishing', maxLevel: 3, icon: '🎣' },
    ],
  },
  sweeping_edge: {
    displayName: 'Sweeping Edge',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
    ],
  },

  // Tool enchantments
  efficiency: {
    displayName: 'Efficiency',
    maxLevel: 5,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table (up to level 4)', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 5, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Mineshaft and End City chests', maxLevel: 5, icon: '📦' },
    ],
  },
  silk_touch: {
    displayName: 'Silk Touch',
    maxLevel: 1,
    maxTableLevel: 1,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table (level 30)', maxLevel: 1, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 1, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in various structure chests', maxLevel: 1, icon: '📦' },
    ],
  },
  fortune: {
    displayName: 'Fortune',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Buried Treasure, Bastion Remnant chests', maxLevel: 3, icon: '📦' },
    ],
  },

  // Armor enchantments
  protection: {
    displayName: 'Protection',
    maxLevel: 4,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with an Armorer or Librarian villager', maxLevel: 4, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Stronghold, Ancient City, and End City chests', maxLevel: 4, icon: '📦' },
    ],
  },
  projectile_protection: {
    displayName: 'Projectile Protection',
    maxLevel: 4,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 4, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Pillager Outpost and Village chests', maxLevel: 4, icon: '📦' },
    ],
  },
  blast_protection: {
    displayName: 'Blast Protection',
    maxLevel: 4,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 4, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Ruined Portal and Bastion Remnant chests', maxLevel: 4, icon: '📦' },
    ],
  },
  fire_protection: {
    displayName: 'Fire Protection',
    maxLevel: 4,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 4, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Ruined Portal and Bastion Remnant chests', maxLevel: 4, icon: '📦' },
    ],
  },
  thorns: {
    displayName: 'Thorns',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in various structure chests', maxLevel: 3, icon: '📦' },
    ],
  },

  // Bow enchantments
  power: {
    displayName: 'Power',
    maxLevel: 5,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table (up to level 4)', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 5, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Dungeon, Pillager Outpost chests', maxLevel: 5, icon: '📦' },
    ],
  },
  punch: {
    displayName: 'Punch',
    maxLevel: 2,
    maxTableLevel: 2,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 2, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 2, icon: '🧑‍🌾' },
    ],
  },
  flame: {
    displayName: 'Flame',
    maxLevel: 1,
    maxTableLevel: 1,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 1, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 1, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Bastion Remnant chests', maxLevel: 1, icon: '📦' },
    ],
  },
  infinity: {
    displayName: 'Infinity',
    maxLevel: 1,
    maxTableLevel: 1,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 1, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 1, icon: '🧑‍🌾' },
    ],
  },

  // Trident enchantments
  impaling: {
    displayName: 'Impaling',
    maxLevel: 5,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 5, icon: '🧑‍🌾' },
    ],
  },
  loyalty: {
    displayName: 'Loyalty',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
    ],
  },
  channeling: {
    displayName: 'Channeling',
    maxLevel: 1,
    maxTableLevel: 1,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 1, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 1, icon: '🧑‍🌾' },
    ],
  },
  riptide: {
    displayName: 'Riptide',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
    ],
  },

  // Fishing rod
  luck_of_the_sea: {
    displayName: 'Luck of the Sea',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Fishing', description: 'Rare catch while fishing', maxLevel: 3, icon: '🎣' },
    ],
  },
  lure: {
    displayName: 'Lure',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Fishing', description: 'Rare catch while fishing', maxLevel: 3, icon: '🎣' },
    ],
  },

  // Universal enchantments
  unbreaking: {
    displayName: 'Unbreaking',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in End City, Stronghold, and Ancient City chests', maxLevel: 3, icon: '📦' },
      { method: 'Fishing', description: 'Rare catch while fishing', maxLevel: 3, icon: '🎣' },
    ],
  },
  mending: {
    displayName: 'Mending',
    maxLevel: 1,
    maxTableLevel: 0, // Cannot be obtained from enchanting table
    sources: [
      { method: 'Villager Trading', description: 'Trade with a Librarian villager (best method)', maxLevel: 1, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Ancient City, Jungle Temple, and Pillager Outpost chests', maxLevel: 1, icon: '📦' },
      { method: 'Fishing', description: 'Very rare catch while fishing with Luck of the Sea III', maxLevel: 1, icon: '🎣' },
      { method: 'Raid Drops', description: 'Rare drop from raid captains', maxLevel: 1, icon: '⚔️' },
    ],
  },

  // Crossbow
  multishot: {
    displayName: 'Multishot',
    maxLevel: 1,
    maxTableLevel: 1,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 1, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Fletcher villager', maxLevel: 1, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Pillager Outpost chests', maxLevel: 1, icon: '📦' },
    ],
  },
  piercing: {
    displayName: 'Piercing',
    maxLevel: 4,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Fletcher villager', maxLevel: 4, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Pillager Outpost chests', maxLevel: 4, icon: '📦' },
    ],
  },
  quick_charge: {
    displayName: 'Quick Charge',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Fletcher villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Pillager Outpost chests', maxLevel: 3, icon: '📦' },
    ],
  },

  // Boots
  depth_strider: {
    displayName: 'Depth Strider',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in various structure chests', maxLevel: 3, icon: '📦' },
    ],
  },
  frost_walker: {
    displayName: 'Frost Walker',
    maxLevel: 2,
    maxTableLevel: 0,
    sources: [
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 2, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in various structure chests', maxLevel: 2, icon: '📦' },
    ],
  },
  soul_speed: {
    displayName: 'Soul Speed',
    maxLevel: 3,
    maxTableLevel: 0,
    sources: [
      { method: 'Bartering', description: 'Trade gold ingots with Piglins in the Nether', maxLevel: 3, icon: '🐷' },
      { method: 'Chest Loot', description: 'Found in Bastion Remnant chests', maxLevel: 3, icon: '📦' },
    ],
  },
  swift_sneak: {
    displayName: 'Swift Sneak',
    maxLevel: 3,
    maxTableLevel: 0,
    sources: [
      { method: 'Chest Loot', description: 'Found exclusively in Ancient City chests (rare)', maxLevel: 3, icon: '📦' },
    ],
  },
  feather_falling: {
    displayName: 'Feather Falling',
    maxLevel: 4,
    maxTableLevel: 4,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 4, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 4, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in various structure chests', maxLevel: 4, icon: '📦' },
    ],
  },

  // Helmet
  respiration: {
    displayName: 'Respiration',
    maxLevel: 3,
    maxTableLevel: 3,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 3, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 3, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Buried Treasure and Shipwreck chests', maxLevel: 3, icon: '📦' },
    ],
  },
  aqua_affinity: {
    displayName: 'Aqua Affinity',
    maxLevel: 1,
    maxTableLevel: 1,
    sources: [
      { method: 'Enchanting Table', description: 'Enchant a book at an enchanting table', maxLevel: 1, icon: '📖' },
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: 1, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in Buried Treasure chests', maxLevel: 1, icon: '📦' },
    ],
  },
};

// ── Helper functions ───────────────────────────────────────────

/**
 * Get enchantment info by name (case-insensitive, supports spaces or underscores).
 */
export function getEnchantmentInfo(name: string): EnchantmentInfo | null {
  const key = name.toLowerCase().replace(/\s+/g, '_');
  const data = ENCHANTMENT_DATA[key];
  if (!data) return null;
  return { name: key, ...data };
}

/**
 * Roman numeral conversion for enchantment levels.
 */
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export function toRoman(n: number): string {
  return ROMAN[n] || String(n);
}

/**
 * Calculate how many level-1 books are needed to reach a target level
 * via anvil combining.
 *
 * In Minecraft, you combine 2 books of the same level to get level+1:
 *   2 × Level I  → Level II
 *   2 × Level II → Level III
 *   etc.
 *
 * So for level N, you need 2^(N-1) level-1 books.
 */
export function booksNeededForLevel(targetLevel: number): number {
  if (targetLevel <= 1) return 1;
  return Math.pow(2, targetLevel - 1);
}

/**
 * Generate the anvil combining steps to reach a target level.
 */
export function getAnvilSteps(targetLevel: number): AnvilStep[] {
  if (targetLevel <= 1) return [];

  const steps: AnvilStep[] = [];
  for (let lvl = 1; lvl < targetLevel; lvl++) {
    const count = Math.pow(2, targetLevel - lvl - 1);
    steps.push({
      step: lvl,
      description: `Combine ${count} pairs of ${toRoman(lvl)} → ${count} × ${toRoman(lvl + 1)}`,
      inputLevel: lvl,
      outputLevel: lvl + 1,
      count,
    });
  }

  return steps;
}

/**
 * Get full book requirements for a list of enchantments.
 * This is the main function the UI calls.
 */
export function getBookRequirements(
  enchantments: { name: string; level: number }[]
): BookRequirement[] {
  return enchantments.map(({ name, level }) => {
    const info = getEnchantmentInfo(name);
    const displayName = info?.displayName || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const targetLevel = level;

    // Filter sources to only those that can provide useful levels
    const sources = info?.sources || [
      { method: 'Villager Trading', description: 'Trade with a Librarian villager', maxLevel: targetLevel, icon: '🧑‍🌾' },
      { method: 'Chest Loot', description: 'Found in various structure chests', maxLevel: targetLevel, icon: '📦' },
    ];

    return {
      enchantmentName: name,
      displayName,
      targetLevel,
      booksNeeded: booksNeededForLevel(targetLevel),
      anvilSteps: getAnvilSteps(targetLevel),
      sources,
    };
  });
}

/**
 * Get the best strategy recommendation for obtaining an enchantment at a given level.
 */
export function getBestStrategy(name: string, level: number): string {
  const info = getEnchantmentInfo(name);
  if (!info) return 'Trade with a Librarian villager for the best results.';

  // Check if a villager can give the exact level directly
  const villagerSource = info.sources.find(s => s.method === 'Villager Trading');
  if (villagerSource && villagerSource.maxLevel >= level) {
    return `Best: Trade with a Librarian villager for a ${info.displayName} ${toRoman(level)} book directly.`;
  }

  // If enchanting table can give it
  if (info.maxTableLevel >= level) {
    return `Enchant books at a level 30 enchanting table, or trade with a Librarian.`;
  }

  // Need combining
  const books = booksNeededForLevel(level);
  const sourceLevel = Math.min(info.maxTableLevel || 1, level - 1) || 1;
  return `Combine ${books} × ${info.displayName} I books on an anvil, or trade for higher-level books from Librarians to reduce combining.`;
}
