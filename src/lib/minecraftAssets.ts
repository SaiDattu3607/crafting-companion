/**
 * Minecraft Asset URL Generator
 * 
 * Provides URLs for 2D item icons from the PrismarineJS/minecraft-assets repository.
 */

const BASE_URL = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data';

/**
 * Items whose PrismarineJS texture filename differs from their minecraft-data item name.
 * Maps item_name → { folder, textureName } so we can construct the correct URL.
 *
 * For block-items that only have _top / _side / _front variants in the blocks folder,
 * we pick the most recognizable face (usually _top or _front).
 */
const TEXTURE_NAME_OVERRIDES: Record<string, { folder: 'items' | 'blocks'; textureName: string }> = {
    enchanting_table: { folder: 'blocks', textureName: 'enchanting_table_top' },
    // Add more overrides here as needed, e.g.:
    // brewing_stand:     { folder: 'items',  textureName: 'brewing_stand' },
};

/**
 * Returns a high-quality 2D icon URL for a Minecraft item.
 */
export function getMinecraftAssetUrl(itemName: string, type: 'items' | 'blocks' = 'items', version: string = '1.20.2'): string {
    // Check if this item has a known texture-name override
    const override = TEXTURE_NAME_OVERRIDES[itemName];
    if (override) {
        return `${BASE_URL}/${version}/${override.folder}/${override.textureName}.png`;
    }
    // Common pattern for modern versions in minecraft-assets
    // Note: If this fails, the component should fallback to other sources.
    return `${BASE_URL}/${version}/${type}/${itemName}.png`;
}

/**
 * Returns a head/icon URL for a Minecraft entity.
 */
export function getMinecraftEntityUrl(entityName: string): string {
    return `https://mc-heads.net/head/${entityName}`;
}
