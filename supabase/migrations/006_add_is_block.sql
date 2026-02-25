-- Add is_block column to crafting_nodes (server has been computing it on-the-fly,
-- but the missing column caused insert fallbacks that stripped enchantments JSONB)
ALTER TABLE crafting_nodes ADD COLUMN IF NOT EXISTS is_block BOOLEAN DEFAULT false;

-- Backfill: update enchanted_book nodes that have NULL enchantments
-- by parsing enchantment info from display_name
UPDATE crafting_nodes
SET enchantments = jsonb_build_array(
  jsonb_build_object(
    'name', replace(trim((regexp_match(display_name, '\((.+?)\s+(\d+)\)'))[1]), ' ', '_'),
    'level', ((regexp_match(display_name, '\((.+?)\s+(\d+)\)'))[2])::int
  )
)
WHERE item_name = 'enchanted_book'
  AND (enchantments IS NULL OR enchantments::text = 'null')
  AND display_name ~ '^\s*Enchanted Book \(.+\s+\d+\)\s*$'
  AND display_name NOT LIKE '%,%';
