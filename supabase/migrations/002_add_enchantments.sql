-- Add enchantments column to crafting_nodes
ALTER TABLE crafting_nodes
  ADD COLUMN IF NOT EXISTS enchantments JSONB DEFAULT NULL;

-- Ensure RLS still applies (no new policies needed for this column)
