-- ====================================================================
-- ReviseCode Multi-User Data Isolation Migration
-- File: backend/supabase/migrations/007_multi_user_data_isolation.sql
-- 
-- Description:
--   Non-destructive, idempotent migration to partition all personal user data
--   by user_id referencing Supabase auth.users(id).
--   Enforces multi-user isolation so brand-new registered users start with
--   a clean slate (0 questions, 0 streak, empty revision queues), while
--   completely preserving existing questions and settings for the primary owner.
--
-- Tables Enhanced:
--   1. public.questions (user_id uuid REFERENCES auth.users(id))
--   2. public.revisions (user_id uuid REFERENCES auth.users(id))
--   3. public.revision_sessions (user_id uuid REFERENCES auth.users(id))
--   4. public.notifications (user_id uuid REFERENCES auth.users(id))
--   5. public.user_settings (user_id uuid REFERENCES auth.users(id))
--   6. public.whatsapp_logs (user_id uuid REFERENCES auth.users(id))
--
-- Safety Guarantees:
--   - 100% Non-destructive: ZERO table drops, ZERO column drops, ZERO data loss.
--   - Fully Idempotent: Can be safely executed multiple times without errors.
--   - No Automatic Reassignment: Never reassigns legacy records to an arbitrary user.
--   - Scopes unique constraint on (user_id, platform, problem_number) so
--     different users can each solve the same problem number.
--   - Enforces Row Level Security (RLS) for authenticated users.
-- ====================================================================

BEGIN;

-- 1. public.questions: Add user_id column
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions (user_id);

-- Drop the global platform + problem_number unique index if it exists
DROP INDEX IF EXISTS public.idx_questions_platform_problem_number_unique;

-- Create scoped unique index partitioned by user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_user_platform_problem_number_unique 
  ON public.questions (user_id, lower(trim(platform)), problem_number) 
  WHERE problem_number IS NOT NULL AND user_id IS NOT NULL;


-- 2. public.revisions: Add user_id column
ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_revisions_user_id ON public.revisions (user_id);


-- 3. public.revision_sessions: Add user_id column
ALTER TABLE public.revision_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_revision_sessions_user_id ON public.revision_sessions (user_id);


-- 4. public.notifications: Add user_id column
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);


-- 5. public.user_settings: Add user_id column
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings (user_id) WHERE user_id IS NOT NULL;


-- 6. public.whatsapp_logs: Add user_id column
ALTER TABLE public.whatsapp_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user_id ON public.whatsapp_logs (user_id);


-- 7. Legacy Records Preservation Notice
-- Unassigned legacy records (where user_id IS NULL) are preserved in place.
-- They are NOT automatically reassigned to prevent any risk of misattribution.
-- An administrator who wishes to assign legacy records to a verified account can run:
--   UPDATE public.questions SET user_id = '<VERIFIED_AUTH_USER_UUID>' WHERE user_id IS NULL;
--   UPDATE public.revisions SET user_id = '<VERIFIED_AUTH_USER_UUID>' WHERE user_id IS NULL;
--   UPDATE public.revision_sessions SET user_id = '<VERIFIED_AUTH_USER_UUID>' WHERE user_id IS NULL;
--   UPDATE public.notifications SET user_id = '<VERIFIED_AUTH_USER_UUID>' WHERE user_id IS NULL;
--   UPDATE public.user_settings SET user_id = '<VERIFIED_AUTH_USER_UUID>' WHERE id = 'default' AND user_id IS NULL;


-- 8. Enable Row Level Security (RLS) & Policies
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Questions RLS
DROP POLICY IF EXISTS "Users can only select own questions" ON public.questions;
CREATE POLICY "Users can only select own questions" ON public.questions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert own questions" ON public.questions;
CREATE POLICY "Users can only insert own questions" ON public.questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update own questions" ON public.questions;
CREATE POLICY "Users can only update own questions" ON public.questions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete own questions" ON public.questions;
CREATE POLICY "Users can only delete own questions" ON public.questions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Revisions RLS
DROP POLICY IF EXISTS "Users can only select own revisions" ON public.revisions;
CREATE POLICY "Users can only select own revisions" ON public.revisions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert own revisions" ON public.revisions;
CREATE POLICY "Users can only insert own revisions" ON public.revisions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update own revisions" ON public.revisions;
CREATE POLICY "Users can only update own revisions" ON public.revisions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete own revisions" ON public.revisions;
CREATE POLICY "Users can only delete own revisions" ON public.revisions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Revision Sessions RLS
DROP POLICY IF EXISTS "Users can only select own sessions" ON public.revision_sessions;
CREATE POLICY "Users can only select own sessions" ON public.revision_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert own sessions" ON public.revision_sessions;
CREATE POLICY "Users can only insert own sessions" ON public.revision_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Notifications RLS
DROP POLICY IF EXISTS "Users can only select own notifications" ON public.notifications;
CREATE POLICY "Users can only select own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update own notifications" ON public.notifications;
CREATE POLICY "Users can only update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User Settings RLS
DROP POLICY IF EXISTS "Users can only select own settings" ON public.user_settings;
CREATE POLICY "Users can only select own settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update own settings" ON public.user_settings;
CREATE POLICY "Users can only update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert own settings" ON public.user_settings;
CREATE POLICY "Users can only insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Ensure service_role policies exist for all tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'service_role_all_questions') THEN
    CREATE POLICY service_role_all_questions ON public.questions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'revisions' AND policyname = 'service_role_all_revisions') THEN
    CREATE POLICY service_role_all_revisions ON public.revisions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'revision_sessions' AND policyname = 'service_role_all_revision_sessions') THEN
    CREATE POLICY service_role_all_revision_sessions ON public.revision_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'service_role_all_notifications') THEN
    CREATE POLICY service_role_all_notifications ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_settings' AND policyname = 'service_role_all_user_settings') THEN
    CREATE POLICY service_role_all_user_settings ON public.user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_logs' AND policyname = 'service_role_all_whatsapp_logs') THEN
    CREATE POLICY service_role_all_whatsapp_logs ON public.whatsapp_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
