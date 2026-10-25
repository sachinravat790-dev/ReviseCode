-- ====================================================================
-- Migration: 002_create_revisions_and_sessions.sql
-- Description: Creates persistent storage for spaced repetition milestones
--              and completed revision review sessions.
-- Idempotent: Safe to execute multiple times.
-- ====================================================================

-- 1. Create public.revisions
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

-- Performance and query indexes
CREATE INDEX IF NOT EXISTS idx_revisions_question_id ON public.revisions (question_id);
CREATE INDEX IF NOT EXISTS idx_revisions_due_date ON public.revisions (due_date);
CREATE INDEX IF NOT EXISTS idx_revisions_completed_at ON public.revisions (completed_at);
CREATE INDEX IF NOT EXISTS idx_revisions_milestone_day ON public.revisions (milestone_day);

-- Prevent duplicate milestones for same question on same due date
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


-- 2. Create public.revision_sessions
CREATE TABLE IF NOT EXISTS public.revision_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid REFERENCES public.revisions(id) ON DELETE SET NULL,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  milestone_day integer,
  recall_rating text NOT NULL CHECK (recall_rating IN ('easy', 'difficult', 'forgot')),
  notes text DEFAULT '',
  timestamp timestamptz DEFAULT now()
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_revision_sessions_question_id ON public.revision_sessions (question_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_revision_id ON public.revision_sessions (revision_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_timestamp ON public.revision_sessions (timestamp DESC);
