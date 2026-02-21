-- ============================================================
-- CraftChain Database Schema
-- Recursive crafting tree with contributions & collaboration
-- ============================================================

-- 1. PROJECTS TABLE
-- Stores the top-level crafting goal (e.g., "Build a Beacon")
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  root_item_name TEXT NOT NULL,          -- Minecraft item ID, e.g. "beacon"
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PROJECT MEMBERS TABLE
-- Tracks who can contribute to a project
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 3. CRAFTING NODES TABLE
-- Self-referencing tree of items needed to craft the final goal
-- If parent_id IS NULL → this is the root/final goal node
-- If is_resource = true → raw material (leaf node, e.g., Log, Sand)
CREATE TABLE IF NOT EXISTS crafting_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES crafting_nodes(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,                -- Minecraft item name, e.g. "iron_ingot"
  display_name TEXT NOT NULL,             -- Human-readable name, e.g. "Iron Ingot"
  required_qty INT NOT NULL DEFAULT 1,
  collected_qty INT NOT NULL DEFAULT 0,
  is_resource BOOLEAN NOT NULL DEFAULT false,  -- true = raw material (leaf node)
  depth INT NOT NULL DEFAULT 0,           -- tree depth for display ordering
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CONTRIBUTIONS TABLE
-- Tracks which user contributed how much of which item
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES crafting_nodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  action TEXT NOT NULL DEFAULT 'collected' CHECK (action IN ('collected', 'crafted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_crafting_nodes_project ON crafting_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_crafting_nodes_parent ON crafting_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_contributions_project ON contributions(project_id);
CREATE INDEX IF NOT EXISTS idx_contributions_node ON contributions(node_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crafting_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- PROJECTS RLS
CREATE POLICY "Users can view projects they own or are members of"
  ON projects FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their projects"
  ON projects FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their projects"
  ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- PROJECT MEMBERS RLS
CREATE POLICY "Members can view project membership"
  ON project_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can add members"
  ON project_members FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Owners can remove members"
  ON project_members FOR DELETE
  USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- CRAFTING NODES RLS
CREATE POLICY "Project participants can view nodes"
  ON crafting_nodes FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project participants can insert nodes"
  ON crafting_nodes FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project participants can update nodes"
  ON crafting_nodes FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- CONTRIBUTIONS RLS
CREATE POLICY "Project participants can view contributions"
  ON contributions FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project participants can contribute"
  ON contributions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS / RPC
-- ============================================================

-- Auto-update updated_at on projects
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_timestamp
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_project_timestamp();

-- Auto-add owner as project member on project creation
CREATE OR REPLACE FUNCTION auto_add_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_add_owner
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_owner_as_member();

-- ============================================================
-- BOTTLENECK FINDER RPC
-- Finds the raw resource blocking the most progress
-- ============================================================
CREATE OR REPLACE FUNCTION find_bottleneck(p_project_id UUID)
RETURNS TABLE (
  node_id UUID,
  item_name TEXT,
  display_name TEXT,
  required_qty INT,
  collected_qty INT,
  remaining_qty INT,
  blocked_ancestors INT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestor_chain AS (
    -- Start from resource nodes that aren't completed
    SELECT
      cn.id AS resource_id,
      cn.id AS current_id,
      cn.parent_id
    FROM crafting_nodes cn
    WHERE cn.project_id = p_project_id
      AND cn.is_resource = true
      AND cn.collected_qty < cn.required_qty

    UNION ALL

    -- Walk up the tree to find all ancestors blocked by this resource
    SELECT
      ac.resource_id,
      parent.id AS current_id,
      parent.parent_id
    FROM ancestor_chain ac
    JOIN crafting_nodes parent ON parent.id = ac.parent_id
    WHERE parent.status != 'completed'
  ),
  blocked_counts AS (
    SELECT
      resource_id,
      COUNT(DISTINCT current_id) - 1 AS blocked_count  -- subtract self
    FROM ancestor_chain
    GROUP BY resource_id
  )
  SELECT
    cn.id AS node_id,
    cn.item_name,
    cn.display_name,
    cn.required_qty,
    cn.collected_qty,
    (cn.required_qty - cn.collected_qty) AS remaining_qty,
    bc.blocked_count::INT AS blocked_ancestors
  FROM blocked_counts bc
  JOIN crafting_nodes cn ON cn.id = bc.resource_id
  ORDER BY bc.blocked_count DESC, (cn.required_qty - cn.collected_qty) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PROJECT PROGRESS RPC
-- Returns overall progress percentage for a project
-- ============================================================
CREATE OR REPLACE FUNCTION get_project_progress(p_project_id UUID)
RETURNS TABLE (
  total_nodes BIGINT,
  completed_nodes BIGINT,
  total_resources BIGINT,
  completed_resources BIGINT,
  progress_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_nodes,
    COUNT(*) FILTER (WHERE cn.collected_qty >= cn.required_qty)::BIGINT AS completed_nodes,
    COUNT(*) FILTER (WHERE cn.is_resource = true)::BIGINT AS total_resources,
    COUNT(*) FILTER (WHERE cn.is_resource = true AND cn.collected_qty >= cn.required_qty)::BIGINT AS completed_resources,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE cn.collected_qty >= cn.required_qty)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1
      )
    END AS progress_pct
  FROM crafting_nodes cn
  WHERE cn.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- CHECK CHILDREN COMPLETE RPC
-- Used by Contribution Guard to verify all children are done
-- ============================================================
CREATE OR REPLACE FUNCTION check_children_complete(p_node_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  incomplete_count INT;
BEGIN
  SELECT COUNT(*) INTO incomplete_count
  FROM crafting_nodes
  WHERE parent_id = p_node_id
    AND collected_qty < required_qty;
  
  RETURN incomplete_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
