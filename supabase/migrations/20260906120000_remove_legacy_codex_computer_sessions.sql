-- Codex authentication is a standalone integration. The old session table
-- coupled Codex runs to organization_computers and is no longer used.
drop table if exists public.codex_sessions;
