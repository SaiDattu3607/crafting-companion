/**
 * Minecraft Asset URL Generator
 * 
 * Provides URLs for 2D item icons from the PrismarineJS/minecraft-assets repository.
 */

const BASE_URL = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data';

/**
 * Returns a high-quality 2D icon URL for a Minecraft item.
 */
export function getMinecraftAssetUrl(itemName: string, type: 'items' | 'blocks' = 'items', version: string = '1.20.2'): string {
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
