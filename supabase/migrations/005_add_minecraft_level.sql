-- ============================================================
-- 005: Add minecraft_level to profiles
-- Stores the player's current Minecraft XP level (0-2147483647)
-- Used to determine which enchantments are available
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS minecraft_level INTEGER DEFAULT 0;
