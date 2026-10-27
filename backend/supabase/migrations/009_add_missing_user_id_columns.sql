-- ====================================================================
-- ReviseCode Database Migration: 009_add_missing_user_id_columns.sql
-- Description: Adds user_id column to revisions, revision_sessions, 
--              notifications, and user_settings tables, safely backfills 
--              existing unassigned data, and resolves duplicate constraints.
-- ====================================================================

BEGIN;

-- 1. Ensure user_id column exists on all personal data tables
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

-- 2. Indexes for fast user-scoped queries
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON public.questions (user_id);
CREATE INDEX IF NOT EXISTS idx_revisions_user_id ON public.revisions (user_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_user_id ON public.revision_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);

-- Optional whatsapp_logs table if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_logs') THEN
    ALTER TABLE public.whatsapp_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user_id ON public.whatsapp_logs (user_id);
  END IF;
END $$;

-- 3. Delete unassigned duplicate questions that would violate unique constraint
DELETE FROM public.questions
WHERE user_id IS NULL
  AND (lower(trim(platform)), problem_number) IN (
    SELECT lower(trim(platform)), problem_number
    FROM public.questions
    WHERE user_id IS NOT NULL AND problem_number IS NOT NULL
  );

-- 4. Safely link all unassigned records to the primary user account
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    UPDATE public.questions 
    SET user_id = v_user_id 
    WHERE user_id IS NULL;

    UPDATE public.revisions 
    SET user_id = v_user_id 
    WHERE user_id IS NULL;

    UPDATE public.revision_sessions 
    SET user_id = v_user_id 
    WHERE user_id IS NULL;

    UPDATE public.notifications 
    SET user_id = v_user_id 
    WHERE user_id IS NULL;

    UPDATE public.user_settings 
    SET user_id = v_user_id 
    WHERE user_id IS NULL;
  END IF;
END $$;

COMMIT;

-- 5. Force PostgREST to reload schema cache so new columns are immediately active
NOTIFY pgrst, 'reload schema';
