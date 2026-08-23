-- Give execution_events its own tenant column.
--
-- It was the one tenant-bearing table with no workspace_id, so its isolation
-- rested entirely on the caller having looked the run up correctly first.
-- Every other table can be scoped by its own predicate; this one could only be
-- scoped by convention, and convention is what the whole tenancy refactor
-- exists to stop relying on.
--
-- Safe to run against live data: adds a nullable column, backfills from the
-- parent run, then indexes. Nothing is rewritten or dropped.

ALTER TABLE execution_events ADD COLUMN workspace_id TEXT;

-- Backfill from the run each event belongs to. Events whose run has since been
-- deleted stay NULL and are unreachable by any scoped query, which is the
-- correct outcome for an orphan.
UPDATE execution_events
SET workspace_id = (
  SELECT action_runs.workspace_id
  FROM action_runs
  WHERE action_runs.run_id = execution_events.run_id
)
WHERE workspace_id IS NULL;

-- The scoped read path: events for one run, within one workspace.
CREATE INDEX IF NOT EXISTS idx_execution_events_workspace_run
  ON execution_events(workspace_id, run_id, created_at);
