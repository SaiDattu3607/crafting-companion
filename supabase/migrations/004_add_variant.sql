-- Add variant column to crafting_nodes for potion/splash/lingering/tipped arrow types
ALTER TABLE crafting_nodes ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT NULL;
