-- ============================================================
-- Project Invites – pending invite system with accept / deny
-- ============================================================

CREATE TABLE IF NOT EXISTS project_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inviter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('member', 'miner', 'builder', 'planner')),
  message     TEXT,                       -- optional message from the inviter
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, invitee_id)          -- one pending invite per user per project
);

-- RLS
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;

-- Invitee can see their own invites
CREATE POLICY "Users can see their own invites"
  ON project_invites FOR SELECT
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

-- Project owners can insert invites
CREATE POLICY "Project owners can create invites"
  ON project_invites FOR INSERT
  WITH CHECK (inviter_id = auth.uid());

-- Invitees can update (accept/decline) their own invites
CREATE POLICY "Invitees can respond to invites"
  ON project_invites FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid());

-- Project owners can also delete/cancel invites they created
CREATE POLICY "Inviters can delete invites"
  ON project_invites FOR DELETE
  USING (inviter_id = auth.uid());
