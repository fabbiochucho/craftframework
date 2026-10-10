CREATE TABLE IF NOT EXISTS legacy_workspace_state (
  org_id text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, key)
);
