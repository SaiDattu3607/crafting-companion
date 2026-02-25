-- ============================================================
-- 006: Schema fixes — align DB with server/client code
-- ============================================================

-- 1. Add plan_version to projects (used by snapshot system)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_version INTEGER DEFAULT 0;

-- 2. Add is_block to crafting_nodes (persists block vs item)
ALTER TABLE crafting_nodes ADD COLUMN IF NOT EXISTS is_block BOOLEAN DEFAULT false;

-- 3. Add last_active_at to profiles (presence tracking)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- 4. Widen contributions.action CHECK to allow milestone/saved/restored
ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_action_check;
ALTER TABLE contributions ADD CONSTRAINT contributions_action_check
  CHECK (action IN ('collected', 'crafted', 'milestone', 'restored', 'saved'));

-- 5. Widen project_members.role CHECK to allow miner/builder/planner
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_role_check;
ALTER TABLE project_members ADD CONSTRAINT project_members_role_check
  CHECK (role IN ('owner', 'member', 'miner', 'builder', 'planner'));

-- 6. Create plan_snapshots table (versioning system)
CREATE TABLE IF NOT EXISTS plan_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  label       TEXT,
  snapshot    JSONB NOT NULL,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_plan_snapshots_project ON plan_snapshots(project_id);

-- 7. RLS for plan_snapshots
ALTER TABLE plan_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project participants can view snapshots"
  ON plan_snapshots FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project participants can create snapshots"
  ON plan_snapshots FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can delete snapshots"
  ON plan_snapshots FOR DELETE
  USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- 8. Missing UPDATE policy on project_members (needed for role changes)
CREATE POLICY "Owners can update member roles"
  ON project_members FOR UPDATE
  USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

-- 9. Missing DELETE policy on crafting_nodes (needed for snapshot restore)
CREATE POLICY "Project participants can delete nodes"
  ON crafting_nodes FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );
