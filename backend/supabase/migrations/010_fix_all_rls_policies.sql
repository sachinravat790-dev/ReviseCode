-- ====================================================================
-- ReviseCode Database Migration: 010_fix_all_rls_policies.sql
-- Description: Fixes Row Level Security (RLS) policies on revisions,
--              subjects, revision_sessions, notifications, and user_settings
--              to ensure service_role full access and authenticated isolation.
-- ====================================================================

BEGIN;

-- 1. Ensure user_id column exists on all personal tables
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.revisions 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.revision_sessions 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_settings 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Disable FORCE ROW LEVEL SECURITY across all tables
ALTER TABLE public.questions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revisions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subjects NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings NO FORCE ROW LEVEL SECURITY;

-- 3. REVISIONS Table: Clean up and recreate policies
DROP POLICY IF EXISTS "service_role_all_revisions" ON public.revisions;
DROP POLICY IF EXISTS "Users can only select own revisions" ON public.revisions;
DROP POLICY IF EXISTS "Users can only insert own revisions" ON public.revisions;
DROP POLICY IF EXISTS "Users can only update own revisions" ON public.revisions;
DROP POLICY IF EXISTS "Users can only delete own revisions" ON public.revisions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.revisions;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.revisions;
DROP POLICY IF EXISTS "allow_all_revisions" ON public.revisions;

-- Service role full access for backend
CREATE POLICY "service_role_all_revisions" ON public.revisions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated user isolation
CREATE POLICY "Users can only select own revisions" ON public.revisions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert own revisions" ON public.revisions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update own revisions" ON public.revisions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete own revisions" ON public.revisions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. SUBJECTS Table: Allow view and create
DROP POLICY IF EXISTS "service_role_all_subjects" ON public.subjects;
DROP POLICY IF EXISTS "allow_read_subjects" ON public.subjects;
DROP POLICY IF EXISTS "authenticated_read_subjects" ON public.subjects;
DROP POLICY IF EXISTS "allow_all_subjects" ON public.subjects;

CREATE POLICY "allow_all_subjects" ON public.subjects
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. REVISION SESSIONS Table
DROP POLICY IF EXISTS "service_role_all_revision_sessions" ON public.revision_sessions;
DROP POLICY IF EXISTS "Users can only select own sessions" ON public.revision_sessions;
DROP POLICY IF EXISTS "Users can only insert own sessions" ON public.revision_sessions;

CREATE POLICY "service_role_all_revision_sessions" ON public.revision_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can only select own sessions" ON public.revision_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert own sessions" ON public.revision_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 6. NOTIFICATIONS Table
DROP POLICY IF EXISTS "service_role_all_notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can only select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can only update own notifications" ON public.notifications;

CREATE POLICY "service_role_all_notifications" ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can only select own notifications" ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only update own notifications" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. USER SETTINGS Table
DROP POLICY IF EXISTS "service_role_all_user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can only select own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can only update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can only insert own settings" ON public.user_settings;

CREATE POLICY "service_role_all_user_settings" ON public.user_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can only select own settings" ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only update own settings" ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only insert own settings" ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 8. Safe backfill for any existing unassigned records
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.questions SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE public.revisions SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE public.revision_sessions SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE public.notifications SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE public.user_settings SET user_id = v_user_id WHERE user_id IS NULL;
  END IF;
END $$;

COMMIT;

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
