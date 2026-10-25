-- ====================================================================
-- ReviseCode Database Migration - Combined Script
-- ====================================================================
-- Safe and idempotent: can be executed repeatedly without data loss.
-- Enhances existing subjects & questions tables, creates revisions,
-- sessions, notifications, and user_settings tables with indexes & RLS.
-- ====================================================================

BEGIN;

-- 1. Create or enhance public.subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS icon text DEFAULT 'folder',
  ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'subjects' 
      AND indexname = 'idx_subjects_name_unique_lower'
  ) THEN
    CREATE UNIQUE INDEX idx_subjects_name_unique_lower 
      ON public.subjects (lower(trim(name)));
  END IF;
END $$;


-- 2. Create or enhance public.questions
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  problem_number text DEFAULT '',
  platform text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic text DEFAULT 'General',
  difficulty text DEFAULT 'Medium',
  problem_url text DEFAULT '',
  statement text DEFAULT '',
  solution text DEFAULT '',
  notes text DEFAULT '',
  is_bookmarked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS approach text DEFAULT '',
  ADD COLUMN IF NOT EXISTS code_language text DEFAULT 'javascript',
  ADD COLUMN IF NOT EXISTS time_complexity text DEFAULT 'O(n)',
  ADD COLUMN IF NOT EXISTS space_complexity text DEFAULT 'O(1)',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS date_solved date DEFAULT current_date;

CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions (subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions (difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_platform ON public.questions (platform);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions (topic);
CREATE INDEX IF NOT EXISTS idx_questions_is_bookmarked ON public.questions (is_bookmarked);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_title_lower ON public.questions (lower(trim(title)));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'questions' 
      AND indexname = 'idx_questions_platform_problem_number_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_questions_platform_problem_number_unique 
      ON public.questions (lower(trim(platform)), trim(problem_number))
      WHERE problem_number IS NOT NULL AND trim(problem_number) <> '';
  END IF;
END $$;


-- 3. Create public.revisions
CREATE TABLE IF NOT EXISTS public.revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  milestone_day integer NOT NULL,
  due_date date NOT NULL,
  completed_at date,
  recall_rating text CHECK (recall_rating IS NULL OR recall_rating IN ('easy', 'difficult', 'forgot')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revisions_question_id ON public.revisions (question_id);
CREATE INDEX IF NOT EXISTS idx_revisions_due_date ON public.revisions (due_date);
CREATE INDEX IF NOT EXISTS idx_revisions_completed_at ON public.revisions (completed_at);
CREATE INDEX IF NOT EXISTS idx_revisions_milestone_day ON public.revisions (milestone_day);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'revisions' 
      AND indexname = 'idx_revisions_question_due_date_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_revisions_question_due_date_unique 
      ON public.revisions (question_id, due_date);
  END IF;
END $$;


-- 4. Create public.revision_sessions
CREATE TABLE IF NOT EXISTS public.revision_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid REFERENCES public.revisions(id) ON DELETE SET NULL,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  milestone_day integer,
  recall_rating text NOT NULL CHECK (recall_rating IN ('easy', 'difficult', 'forgot')),
  notes text DEFAULT '',
  timestamp timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revision_sessions_question_id ON public.revision_sessions (question_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_revision_id ON public.revision_sessions (revision_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_timestamp ON public.revision_sessions (timestamp DESC);


-- 5. Create public.notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  category text DEFAULT 'Revisions',
  title text NOT NULL,
  message text NOT NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_question_id ON public.notifications (question_id);


-- 6. Create public.user_settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  id text PRIMARY KEY DEFAULT 'default',
  theme text DEFAULT 'dark',
  time_zone text DEFAULT 'Asia/Kolkata (UTC+05:30)',
  reminder_time text DEFAULT '09:00',
  study_goal_questions integer DEFAULT 3,
  custom_intervals_enabled boolean DEFAULT false,
  custom_interval_days jsonb DEFAULT '[45, 60]'::jsonb,
  in_app_notifications boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  whatsapp_notifications boolean DEFAULT false,
  quiet_hours_start text DEFAULT '22:00',
  quiet_hours_end text DEFAULT '08:00',
  ai_demo_mode boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.user_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;


-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

COMMIT;
