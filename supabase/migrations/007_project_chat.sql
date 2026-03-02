-- ============================================================
-- Project Chat Messages
-- Simple project-level chat unrelated to version control
-- ============================================================

CREATE TABLE IF NOT EXISTS project_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_project ON project_chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON project_chat_messages(project_id, created_at DESC);

-- RLS
ALTER TABLE project_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view chat messages"
  ON project_chat_messages FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can send chat messages"
  ON project_chat_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages"
  ON project_chat_messages FOR DELETE
  USING (user_id = auth.uid());

-- Enable Realtime for project_chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE project_chat_messages;
