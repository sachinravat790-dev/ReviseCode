-- ====================================================================
-- ReviseCode Database Migration: 008_fix_questions_rls_policy.sql
-- Description: Corrects and hardens PostgreSQL Row Level Security (RLS)
--              for public.questions and related tables in ReviseCode.
--
-- Security Objectives:
-- 1. Keeps RLS ENABLED across all tables.
-- 2. Grants explicit full CRUD access to the 'service_role' PostgreSQL role
--    for trusted server-side operations (Express backend).
-- 3. Enforces strict per-user ownership for direct 'authenticated' clients
--    (auth.uid() = user_id).
-- 4. Ensures 'anon' (unauthenticated) clients have zero access to private records.
-- 5. Removes legacy, conflicting, or overly permissive policies (e.g. template
--    policies with WITH CHECK (true) or policies applying to PUBLIC).
-- 6. Ensures user_id foreign key, index, and user-scoped unique index exist.
--
-- Safety Guarantees:
-- - 100% Non-destructive: ZERO DROP TABLE, ZERO TRUNCATE, ZERO DATA LOSS.
-- - Fully Idempotent: Can be safely executed multiple times without errors.
-- - Wrapped in a single transaction (BEGIN ... COMMIT).
-- ====================================================================

BEGIN;

-- 1. Ensure user_id column exists on public.questions with CASCADE delete
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index user_id for high-performance foreign key lookups and filtered queries
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions (user_id);

-- Drop legacy global unique index on (platform, problem_number) if it exists
DROP INDEX IF EXISTS public.idx_questions_platform_problem_number_unique;

-- Create user-scoped unique index partitioned by user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_user_platform_problem_number_unique 
  ON public.questions (user_id, lower(trim(platform)), problem_number) 
  WHERE problem_number IS NOT NULL AND user_id IS NOT NULL;


-- 2. Ensure Row Level Security (RLS) is ENABLED on all tables
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_logs') THEN
    ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Ensure NO FORCE ROW LEVEL SECURITY (prevents blocking roles with BYPASSRLS or explicit bypass policies)
ALTER TABLE public.questions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subjects NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revisions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings NO FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_logs') THEN
    ALTER TABLE public.whatsapp_logs NO FORCE ROW LEVEL SECURITY;
  END IF;
END $$;


-- 3. Clean up legacy, conflicting, or overly permissive policies on public.questions
DROP POLICY IF EXISTS "service_role_all_questions" ON public.questions;
DROP POLICY IF EXISTS "Users can only select own questions" ON public.questions;
DROP POLICY IF EXISTS "Users can only insert own questions" ON public.questions;
DROP POLICY IF EXISTS "Users can only update own questions" ON public.questions;
DROP POLICY IF EXISTS "Users can only delete own questions" ON public.questions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.questions;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.questions;
DROP POLICY IF EXISTS "authenticated_select_own_questions" ON public.questions;
DROP POLICY IF EXISTS "authenticated_insert_own_questions" ON public.questions;
DROP POLICY IF EXISTS "authenticated_update_own_questions" ON public.questions;
DROP POLICY IF EXISTS "authenticated_delete_own_questions" ON public.questions;


-- 4. Service Role Policy on public.questions: Full access for Express backend
CREATE POLICY "service_role_all_questions" ON public.questions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- 5. Authenticated User Policies on public.questions: Strict isolation (auth.uid() = user_id)
CREATE POLICY "Users can only select own questions" ON public.questions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert own questions" ON public.questions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update own questions" ON public.questions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete own questions" ON public.questions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- 6. Companion service_role policies on related tables
DROP POLICY IF EXISTS "service_role_all_subjects" ON public.subjects;
CREATE POLICY "service_role_all_subjects" ON public.subjects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_revisions" ON public.revisions;
CREATE POLICY "service_role_all_revisions" ON public.revisions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_revision_sessions" ON public.revision_sessions;
CREATE POLICY "service_role_all_revision_sessions" ON public.revision_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_notifications" ON public.notifications;
CREATE POLICY "service_role_all_notifications" ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_user_settings" ON public.user_settings;
CREATE POLICY "service_role_all_user_settings" ON public.user_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_logs') THEN
    DROP POLICY IF EXISTS "service_role_all_whatsapp_logs" ON public.whatsapp_logs;
    CREATE POLICY "service_role_all_whatsapp_logs" ON public.whatsapp_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-- 7. Public/Shared Subjects Catalog Policy (Read-only for all users, write restricted to service_role)
DROP POLICY IF EXISTS "allow_read_subjects" ON public.subjects;
DROP POLICY IF EXISTS "authenticated_read_subjects" ON public.subjects;
CREATE POLICY "allow_read_subjects" ON public.subjects
  FOR SELECT
  TO authenticated, anon
  USING (true);


COMMIT;

-- 8. Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
