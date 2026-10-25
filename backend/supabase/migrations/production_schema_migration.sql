-- ====================================================================
-- ReviseCode Production Schema & RLS Migration
-- File: backend/supabase/migrations/production_schema_migration.sql
-- 
-- Description:
--   Consolidated, idempotent, and production-grade PostgreSQL migration
--   for ReviseCode. Safely provisions and reconciles all 7 tables:
--     1. public.subjects
--     2. public.questions
--     3. public.revisions
--     4. public.revision_sessions
--     5. public.notifications
--     6. public.user_settings
--     7. public.whatsapp_logs
--
-- Safety Guarantees:
--   - 100% Non-destructive: ZERO table drops, ZERO column drops, ZERO data loss.
--   - Fully Idempotent: Can be safely executed multiple times without errors.
--   - Enables Row Level Security (RLS) on all 7 tables.
--   - Grants explicit full CRUD access exclusively to the 'service_role' PostgreSQL role.
--   - Notifies PostgREST to reload its schema cache immediately.
--
-- How to apply:
--   1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/<project-ref>
--   2. Click "SQL Editor" in the left sidebar.
--   3. Paste the entire content of this file and click "Run".
-- ====================================================================

BEGIN;

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- TABLE 1: public.subjects
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#7c3aed',
  icon text DEFAULT 'folder',
  topics text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Backfill any missing columns for existing subjects table
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS icon text DEFAULT 'folder',
  ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Unique index on lowercase subject name
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_name_unique_lower 
  ON public.subjects (lower(trim(name)));

-- ====================================================================
-- TABLE 2: public.questions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  platform text NOT NULL,
  problem_number integer,
  problem_url text DEFAULT '',
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic text DEFAULT 'General',
  difficulty text DEFAULT 'Medium',
  date_solved date DEFAULT CURRENT_DATE,
  statement text DEFAULT '',
  approach text DEFAULT '',
  notes text DEFAULT '',
  solution text DEFAULT '',
  code_language text DEFAULT 'javascript',
  time_complexity text DEFAULT 'O(n)',
  space_complexity text DEFAULT 'O(1)',
  tags text[] DEFAULT '{}'::text[],
  is_bookmarked boolean DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Backfill any missing columns on questions
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS problem_number integer,
  ADD COLUMN IF NOT EXISTS problem_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic text DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS date_solved date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS statement text DEFAULT '',
  ADD COLUMN IF NOT EXISTS approach text DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS solution text DEFAULT '',
  ADD COLUMN IF NOT EXISTS code_language text DEFAULT 'javascript',
  ADD COLUMN IF NOT EXISTS time_complexity text DEFAULT 'O(n)',
  ADD COLUMN IF NOT EXISTS space_complexity text DEFAULT 'O(1)',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS is_bookmarked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Unique constraint index on (platform, problem_number) where problem_number is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_platform_problem_number_unique 
  ON public.questions (lower(trim(platform)), problem_number) 
  WHERE problem_number IS NOT NULL;

-- Performance indexes for questions
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions (subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions (difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_date_solved ON public.questions (date_solved DESC);
CREATE INDEX IF NOT EXISTS idx_questions_is_bookmarked ON public.questions (is_bookmarked) WHERE is_bookmarked = true;

-- ====================================================================
-- TABLE 3: public.revisions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  milestone_day integer NOT NULL,
  due_date date NOT NULL,
  completed_at date,
  recall_rating text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS milestone_day integer,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS completed_at date,
  ADD COLUMN IF NOT EXISTS recall_rating text,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Unique index to prevent duplicate milestones for same question and day
CREATE UNIQUE INDEX IF NOT EXISTS idx_revisions_question_milestone_unique 
  ON public.revisions (question_id, milestone_day);

-- Performance indexes for revisions
CREATE INDEX IF NOT EXISTS idx_revisions_due_date ON public.revisions (due_date);
CREATE INDEX IF NOT EXISTS idx_revisions_completed_at ON public.revisions (completed_at);
CREATE INDEX IF NOT EXISTS idx_revisions_question_id ON public.revisions (question_id);

-- ====================================================================
-- TABLE 4: public.revision_sessions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.revision_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid REFERENCES public.revisions(id) ON DELETE SET NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  milestone_day integer,
  recall_rating text,
  notes text DEFAULT '',
  timestamp timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revision_sessions_timestamp ON public.revision_sessions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_question_id ON public.revision_sessions (question_id);

-- ====================================================================
-- TABLE 5: public.notifications
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);

-- ====================================================================
-- TABLE 6: public.user_settings
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id text PRIMARY KEY DEFAULT 'default',
  theme text DEFAULT 'dark',
  email_notifications boolean DEFAULT false,
  push_notifications boolean DEFAULT true,
  revision_reminders boolean DEFAULT true,
  weekly_digest boolean DEFAULT false,
  sound_effects boolean DEFAULT true,
  compact_view boolean DEFAULT false,
  code_wrap boolean DEFAULT true,
  line_numbers boolean DEFAULT true,
  auto_complete boolean DEFAULT true,
  preferred_language text DEFAULT 'javascript',
  editor_font_size integer DEFAULT 14,
  custom_intervals integer[] DEFAULT '{1, 3, 7, 15, 30}'::integer[],
  daily_goal integer DEFAULT 3,
  whatsapp_notifications boolean DEFAULT false,
  whatsapp_phone_number text DEFAULT '',
  whatsapp_reminder_time text DEFAULT '09:00',
  whatsapp_timezone text DEFAULT 'Asia/Kolkata',
  whatsapp_quiet_hours boolean DEFAULT true,
  quiet_hours_start text DEFAULT '22:00',
  quiet_hours_end text DEFAULT '08:00',
  ai_demo_mode boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure baseline user settings exist
INSERT INTO public.user_settings (id, theme, custom_intervals, daily_goal)
VALUES ('default', 'dark', '{1, 3, 7, 15, 30}'::integer[], 3)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- TABLE 7: public.whatsapp_logs
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid REFERENCES public.revisions(id) ON DELETE SET NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  reminder_window text NOT NULL,
  reminder_date date NOT NULL,
  message_type text DEFAULT 'text',
  message_body text NOT NULL,
  status text NOT NULL,
  whatsapp_message_id text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON public.whatsapp_logs (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_revision_id ON public.whatsapp_logs (revision_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_question_id ON public.whatsapp_logs (question_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_logs_unique_window 
  ON public.whatsapp_logs (revision_id, reminder_window, reminder_date) 
  WHERE status IN ('sent', 'simulated_test_mode') AND revision_id IS NOT NULL;

-- ====================================================================
-- SECTION 8: Row Level Security (RLS) & Service Role Policies
-- ====================================================================
-- Enable RLS across all 7 tables
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Idempotently create service_role full-access policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'service_role_all_subjects'
  ) THEN
    CREATE POLICY service_role_all_subjects ON public.subjects FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'service_role_all_questions'
  ) THEN
    CREATE POLICY service_role_all_questions ON public.questions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'revisions' AND policyname = 'service_role_all_revisions'
  ) THEN
    CREATE POLICY service_role_all_revisions ON public.revisions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'revision_sessions' AND policyname = 'service_role_all_revision_sessions'
  ) THEN
    CREATE POLICY service_role_all_revision_sessions ON public.revision_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'service_role_all_notifications'
  ) THEN
    CREATE POLICY service_role_all_notifications ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_settings' AND policyname = 'service_role_all_user_settings'
  ) THEN
    CREATE POLICY service_role_all_user_settings ON public.user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_logs' AND policyname = 'service_role_all_whatsapp_logs'
  ) THEN
    CREATE POLICY service_role_all_whatsapp_logs ON public.whatsapp_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
