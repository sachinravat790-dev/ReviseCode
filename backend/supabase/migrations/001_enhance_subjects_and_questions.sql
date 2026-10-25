-- ====================================================================
-- Migration: 001_enhance_subjects_and_questions.sql
-- Description: Enhances existing subjects and questions tables with
--              metadata columns required by ReviseCode frontend and
--              spaced repetition workflows.
-- Idempotent: Safe to execute multiple times.
-- ====================================================================

-- 1. Create or enhance public.subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Add missing columns to public.subjects
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#7c3aed',
  ADD COLUMN IF NOT EXISTS icon text DEFAULT 'folder',
  ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure unique subject name (case-insensitive)
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

-- Add missing columns to public.questions
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS approach text DEFAULT '',
  ADD COLUMN IF NOT EXISTS code_language text DEFAULT 'javascript',
  ADD COLUMN IF NOT EXISTS time_complexity text DEFAULT 'O(n)',
  ADD COLUMN IF NOT EXISTS space_complexity text DEFAULT 'O(1)',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS date_solved date DEFAULT current_date;

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions (subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions (difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_platform ON public.questions (platform);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions (topic);
CREATE INDEX IF NOT EXISTS idx_questions_is_bookmarked ON public.questions (is_bookmarked);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_title_lower ON public.questions (lower(trim(title)));

-- Unique index for platform + problem_number when problem_number is present
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
