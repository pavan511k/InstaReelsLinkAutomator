-- Migration: Enable RLS on data_deletion_requests
-- Resolves Supabase lint warning: 0013_rls_disabled_in_public
--
-- WHY NO POLICIES?
--   All access to this table is done via the Supabase service role key
--   (src/lib/supabase-admin.js). The service role bypasses RLS entirely,
--   so no explicit POLICY rows are needed.
--
--   Anon and authenticated (JWT) clients — including the public Supabase
--   Data API — are blocked from reading or writing this table by default
--   once RLS is enabled with zero permissive policies.
--
-- WHAT CHANGED IN CODE?
--   src/app/api/webhooks/data-deletion/route.js now imports createAdminClient
--   (service role) instead of the anon createClient, so the webhook still
--   works correctly after this migration.

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
