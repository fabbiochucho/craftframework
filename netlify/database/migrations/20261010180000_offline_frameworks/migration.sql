CREATE UNIQUE INDEX IF NOT EXISTS workspaces_org_id_id_unique ON workspaces (org_id, id);
CREATE TABLE IF NOT EXISTS offline_frameworks (
  org_id integer NOT NULL,
  workspace_id integer NOT NULL,
  id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  deleted integer NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  payload text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, workspace_id, id),
  FOREIGN KEY (org_id, workspace_id) REFERENCES workspaces (org_id, id)
);
CREATE TABLE IF NOT EXISTS offline_framework_receipts (
  org_id integer NOT NULL,
  workspace_id integer NOT NULL,
  user_id text NOT NULL,
  operation_id text NOT NULL,
  fingerprint text NOT NULL,
  response text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, workspace_id, user_id, operation_id),
  FOREIGN KEY (org_id, workspace_id) REFERENCES workspaces (org_id, id)
);
