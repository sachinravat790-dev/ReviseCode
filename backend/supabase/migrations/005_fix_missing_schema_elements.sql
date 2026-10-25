-- ====================================================================
-- Migration: 005_fix_missing_schema_elements.sql
-- Path: backend/supabase/migrations/005_fix_missing_schema_elements.sql
-- Description: Safe, defensive, and incremental migration for ReviseCode:
--   1. Ensures question_id and all milestone columns exist on public.revisions
--   2. Verifies existing revisions have non-null question_id, day, and due_date
--   3. Compatible with INTEGER problem_number on public.questions (no text trim on int)
--   4. Pre-index validation for duplicate subjects, (platform, problem_number), and milestones
--   5. Unique index verification by expression, predicate, and uniqueness (not name alone)
--   6. Foreign key reconciliation against complete catalog definitions (columns + ON DELETE action)
--   7. Orphaned foreign key detection halting transaction before constraints are added
--   8. Row Level Security (RLS) enabled on all 6 tables with explicit service_role isolation
--   9. 100% data preservation: zero table drops, zero column drops, zero row deletions
--  10. Atomic transaction with PostgREST schema cache reload after COMMIT
--
-- Safety Guarantees:
--   - ZERO data loss: Never drops tables or columns.
--   - Transactional atomicity: Runs strictly within BEGIN ... COMMIT.
--   - Any duplicate, null, or orphan validation failure halts via RAISE EXCEPTION,
--     triggering an automatic ROLLBACK with zero partial schema changes left.
--   - Preserves existing user settings via ON CONFLICT (id) DO NOTHING.
-- ====================================================================

BEGIN;

-- ====================================================================
-- SECTION 1: Enhance public.subjects
-- ====================================================================

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

-- Defensively backfill null values for existing rows without altering custom values
UPDATE public.subjects SET color = '#7c3aed' WHERE color IS NULL;
UPDATE public.subjects SET icon = 'folder' WHERE icon IS NULL;
UPDATE public.subjects SET topics = '{}'::text[] WHERE topics IS NULL;
UPDATE public.subjects SET updated_at = now() WHERE updated_at IS NULL;

-- Validate uniqueness for subject names before unique index creation
DO $$
DECLARE
  dup_subjects text;
  idx_already_valid boolean := false;
  rec RECORD;
BEGIN
  -- 1. Check for duplicates in lower(trim(name))
  SELECT string_agg(format('"%s" (%s records)', dup_name, cnt), ', ')
  INTO dup_subjects
  FROM (
    SELECT lower(trim(name)) AS dup_name, count(*) AS cnt
    FROM public.subjects
    GROUP BY lower(trim(name))
    HAVING count(*) > 1
  ) sub;

  IF dup_subjects IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Duplicate subject names found in public.subjects: %. Please resolve duplicate subject names before creating unique index. Transaction rolled back, no data was modified.', dup_subjects;
  END IF;

  -- 2. Check existing unique indexes by expression and uniqueness
  FOR rec IN (
    SELECT c.relname, pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE i.indrelid = 'public.subjects'::regclass
      AND i.indisunique = true
  ) LOOP
    IF rec.def ILIKE '%lower(btrim(name))%' OR rec.def ILIKE '%lower(trim(name))%' THEN
      idx_already_valid := true;
    END IF;
  END LOOP;

  -- If an index named idx_subjects_name_unique_lower exists with an obsolete definition, drop it
  IF NOT idx_already_valid THEN
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'subjects' AND indexname = 'idx_subjects_name_unique_lower'
    ) THEN
      DROP INDEX public.idx_subjects_name_unique_lower;
    END IF;

    CREATE UNIQUE INDEX idx_subjects_name_unique_lower 
      ON public.subjects (lower(trim(name)));
  END IF;
END $$;


-- ====================================================================
-- SECTION 2: Enhance public.questions
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  problem_number integer,
  platform text NOT NULL,
  subject_id uuid,
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

-- Add missing columns to questions without altering existing data types
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

-- Check for duplicate platform + problem_number pairs before creating unique index
-- Compatible with INTEGER problem_number column
DO $$
DECLARE
  col_type text;
  dup_questions text;
  idx_already_valid boolean := false;
  rec RECORD;
BEGIN
  SELECT data_type INTO col_type 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'questions' 
    AND column_name = 'problem_number';

  -- 1. Detect duplicates based on actual column type
  IF col_type = 'integer' THEN
    SELECT string_agg(format('Platform: "%s", Problem #: %s (%s records)', platform_clean, problem_num, cnt), E'\n  - ')
    INTO dup_questions
    FROM (
      SELECT lower(trim(platform)) AS platform_clean, problem_number AS problem_num, count(*) AS cnt
      FROM public.questions
      WHERE problem_number IS NOT NULL
      GROUP BY lower(trim(platform)), problem_number
      HAVING count(*) > 1
    ) q;
  ELSE
    SELECT string_agg(format('Platform: "%s", Problem #: "%s" (%s records)', platform_clean, problem_num, cnt), E'\n  - ')
    INTO dup_questions
    FROM (
      SELECT lower(trim(platform)) AS platform_clean, trim(problem_number::text) AS problem_num, count(*) AS cnt
      FROM public.questions
      WHERE problem_number IS NOT NULL AND trim(problem_number::text) <> ''
      GROUP BY lower(trim(platform)), trim(problem_number::text)
      HAVING count(*) > 1
    ) q;
  END IF;

  IF dup_questions IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Duplicate (platform, problem_number) pairs found in public.questions:%  - %
Please resolve these duplicate problems before creating the unique index. Transaction rolled back, no data was modified.', E'\n', dup_questions;
  END IF;

  -- 2. Verify unique index by definition, expression, and predicate (not name alone)
  FOR rec IN (
    SELECT c.relname, pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE i.indrelid = 'public.questions'::regclass
      AND i.indisunique = true
  ) LOOP
    IF (rec.def ILIKE '%lower(btrim(platform))%' OR rec.def ILIKE '%lower(trim(platform))%')
       AND rec.def ILIKE '%problem_number%'
       AND rec.def ILIKE '%WHERE%problem_number IS NOT NULL%' THEN
      idx_already_valid := true;
    END IF;
  END LOOP;

  IF NOT idx_already_valid THEN
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'questions' AND indexname = 'idx_questions_platform_problem_number_unique'
    ) THEN
      DROP INDEX public.idx_questions_platform_problem_number_unique;
    END IF;

    IF col_type = 'integer' THEN
      CREATE UNIQUE INDEX idx_questions_platform_problem_number_unique 
        ON public.questions (lower(trim(platform)), problem_number)
        WHERE problem_number IS NOT NULL;
    ELSE
      CREATE UNIQUE INDEX idx_questions_platform_problem_number_unique 
        ON public.questions (lower(trim(platform)), trim(problem_number::text))
        WHERE problem_number IS NOT NULL AND trim(problem_number::text) <> '';
    END IF;
  END IF;
END $$;


-- ====================================================================
-- SECTION 3: Ensure public.revisions exists (Spaced Repetition Milestones)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  milestone_day integer NOT NULL,
  due_date date NOT NULL,
  completed_at date,
  recall_rating text CHECK (recall_rating IS NULL OR recall_rating IN ('easy', 'difficult', 'forgot')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensively ensure question_id and all milestone columns exist
ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS question_id uuid,
  ADD COLUMN IF NOT EXISTS milestone_day integer,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS completed_at date,
  ADD COLUMN IF NOT EXISTS recall_rating text,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Verify data consistency: check for NULL question_id or dates on existing records
DO $$
DECLARE
  null_question_count integer;
  null_milestone_count integer;
BEGIN
  -- 1. Ensure no milestones have a NULL question_id
  SELECT count(*) INTO null_question_count
  FROM public.revisions
  WHERE question_id IS NULL;

  IF null_question_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Found % revision milestone(s) in public.revisions with NULL question_id. Spaced repetition milestones require an associated question. Please assign question_id or clean up these orphaned milestones before applying constraints. Transaction rolled back, no data was modified.', null_question_count;
  END IF;

  -- 2. Ensure no milestones have NULL milestone_day or due_date
  SELECT count(*) INTO null_milestone_count
  FROM public.revisions
  WHERE milestone_day IS NULL OR due_date IS NULL;

  IF null_milestone_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Found % revision milestone(s) in public.revisions with NULL milestone_day or due_date. All milestones require a day and due date. Transaction rolled back, no data was modified.', null_milestone_count;
  END IF;

  -- 3. Safely enforce NOT NULL on question_id, milestone_day, due_date if columns are currently nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'revisions'
      AND column_name = 'question_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.revisions ALTER COLUMN question_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'revisions'
      AND column_name = 'milestone_day'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.revisions ALTER COLUMN milestone_day SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'revisions'
      AND column_name = 'due_date'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.revisions ALTER COLUMN due_date SET NOT NULL;
  END IF;

  -- 4. Safely attach recall_rating check constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'revisions_recall_rating_check' AND conrelid = 'public.revisions'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.revisions 
      WHERE recall_rating IS NOT NULL 
        AND recall_rating NOT IN ('easy', 'difficult', 'forgot')
    ) THEN
      RAISE EXCEPTION 'MIGRATION HALTED: Found revision records with invalid recall_rating values. Allowed: easy, difficult, forgot. Transaction rolled back, no data was modified.';
    END IF;

    ALTER TABLE public.revisions
      ADD CONSTRAINT revisions_recall_rating_check 
      CHECK (recall_rating IS NULL OR recall_rating IN ('easy', 'difficult', 'forgot'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_revisions_question_id ON public.revisions (question_id);
CREATE INDEX IF NOT EXISTS idx_revisions_due_date ON public.revisions (due_date);
CREATE INDEX IF NOT EXISTS idx_revisions_completed_at ON public.revisions (completed_at);
CREATE INDEX IF NOT EXISTS idx_revisions_milestone_day ON public.revisions (milestone_day);

-- Validate unique milestones per (question_id, due_date)
DO $$
DECLARE
  dup_revisions text;
  idx_already_valid boolean := false;
  rec RECORD;
BEGIN
  -- 1. Detect duplicate milestones
  SELECT string_agg(format('Question ID: %s, Due Date: %s (%s records)', question_id, due_date, cnt), E'\n  - ')
  INTO dup_revisions
  FROM (
    SELECT question_id, due_date, count(*) AS cnt
    FROM public.revisions
    GROUP BY question_id, due_date
    HAVING count(*) > 1
  ) r;

  IF dup_revisions IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Duplicate milestones found in public.revisions for (question_id, due_date):%  - %
Please resolve duplicate milestones before creating unique index. Transaction rolled back, no data was modified.', E'\n', dup_revisions;
  END IF;

  -- 2. Verify unique index by definition
  FOR rec IN (
    SELECT c.relname, pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE i.indrelid = 'public.revisions'::regclass
      AND i.indisunique = true
  ) LOOP
    IF rec.def ILIKE '%(question_id, due_date)%' THEN
      idx_already_valid := true;
    END IF;
  END LOOP;

  IF NOT idx_already_valid THEN
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename = 'revisions' AND indexname = 'idx_revisions_question_due_date_unique'
    ) THEN
      DROP INDEX public.idx_revisions_question_due_date_unique;
    END IF;

    CREATE UNIQUE INDEX idx_revisions_question_due_date_unique 
      ON public.revisions (question_id, due_date);
  END IF;
END $$;


-- ====================================================================
-- SECTION 4: Ensure public.revision_sessions exists (Review History)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.revision_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid,
  question_id uuid NOT NULL,
  milestone_day integer,
  recall_rating text NOT NULL CHECK (recall_rating IN ('easy', 'difficult', 'forgot')),
  notes text DEFAULT '',
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE public.revision_sessions
  ADD COLUMN IF NOT EXISTS revision_id uuid,
  ADD COLUMN IF NOT EXISTS question_id uuid,
  ADD COLUMN IF NOT EXISTS milestone_day integer,
  ADD COLUMN IF NOT EXISTS recall_rating text,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS timestamp timestamptz DEFAULT now();

-- Ensure revision_sessions consistency before applying constraints
DO $$
DECLARE
  null_session_q_count integer;
  null_rating_count integer;
BEGIN
  SELECT count(*) INTO null_session_q_count
  FROM public.revision_sessions
  WHERE question_id IS NULL;

  IF null_session_q_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Found % session(s) in public.revision_sessions with NULL question_id. Transaction rolled back, no data was modified.', null_session_q_count;
  END IF;

  SELECT count(*) INTO null_rating_count
  FROM public.revision_sessions
  WHERE recall_rating IS NULL;

  IF null_rating_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Found % session(s) in public.revision_sessions with NULL recall_rating. Transaction rolled back, no data was modified.', null_rating_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'revision_sessions'
      AND column_name = 'question_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.revision_sessions ALTER COLUMN question_id SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'revision_sessions'
      AND column_name = 'recall_rating'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.revision_sessions ALTER COLUMN recall_rating SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'revision_sessions_recall_rating_check' AND conrelid = 'public.revision_sessions'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.revision_sessions 
      WHERE recall_rating NOT IN ('easy', 'difficult', 'forgot')
    ) THEN
      RAISE EXCEPTION 'MIGRATION HALTED: Found revision_sessions records with invalid recall_rating values. Allowed: easy, difficult, forgot. Transaction rolled back, no data was modified.';
    END IF;

    ALTER TABLE public.revision_sessions
      ADD CONSTRAINT revision_sessions_recall_rating_check 
      CHECK (recall_rating IN ('easy', 'difficult', 'forgot'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_revision_sessions_question_id ON public.revision_sessions (question_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_revision_id ON public.revision_sessions (revision_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_timestamp ON public.revision_sessions (timestamp DESC);


-- ====================================================================
-- SECTION 5: Ensure public.notifications exists
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  category text DEFAULT 'Revisions',
  title text NOT NULL,
  message text NOT NULL,
  question_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Revisions',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS question_id uuid,
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_question_id ON public.notifications (question_id);


-- ====================================================================
-- SECTION 6: Ensure public.user_settings exists
-- ====================================================================

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

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS time_zone text DEFAULT 'Asia/Kolkata (UTC+05:30)',
  ADD COLUMN IF NOT EXISTS reminder_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS study_goal_questions integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS custom_intervals_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_interval_days jsonb DEFAULT '[45, 60]'::jsonb,
  ADD COLUMN IF NOT EXISTS in_app_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_notifications boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start text DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end text DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS ai_demo_mode boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Seed single-user default record if absent, preserving existing customizations
INSERT INTO public.user_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;


-- ====================================================================
-- SECTION 7: Foreign Key Reconciliation Against Complete Catalog Definitions
-- ====================================================================
-- Verifies:
--   1. Referencing table & column
--   2. Referenced table & column
--   3. ON DELETE action (SET NULL = 'n', CASCADE = 'c')
--   4. Orphaned reference detection before constraint creation
-- ====================================================================

DO $$
DECLARE
  rec RECORD;
  orphan_count integer;
  fk_fully_matching boolean;
BEGIN
  -- ------------------------------------------------------------------
  -- 1. questions(subject_id) -> subjects(id) ON DELETE SET NULL ('n')
  -- ------------------------------------------------------------------
  fk_fully_matching := false;
  FOR rec IN (
    SELECT c.conname, c.confdeltype, c.confrelid, ra.attname AS ref_col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.questions'::regclass
      AND a.attname = 'subject_id'
  ) LOOP
    IF rec.confrelid = 'public.subjects'::regclass AND rec.ref_col = 'id' AND rec.confdeltype = 'n' THEN
      fk_fully_matching := true;
    ELSE
      -- Existing constraint has incorrect delete action (e.g. NO ACTION) or wrong target
      -- Safely drop constraint definition without modifying any table rows
      EXECUTE format('ALTER TABLE public.questions DROP CONSTRAINT %I', rec.conname);
    END IF;
  END LOOP;

  IF NOT fk_fully_matching THEN
    SELECT count(*) INTO orphan_count
    FROM public.questions q
    WHERE q.subject_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = q.subject_id);

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'MIGRATION HALTED: Found % question(s) in public.questions referencing non-existent subject_id. Resolve orphaned subject references before enforcing constraint. Transaction rolled back, no data was modified.', orphan_count;
    END IF;

    ALTER TABLE public.questions
      ADD CONSTRAINT questions_subject_id_fkey 
      FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;

  -- ------------------------------------------------------------------
  -- 2. revisions(question_id) -> questions(id) ON DELETE CASCADE ('c')
  -- ------------------------------------------------------------------
  fk_fully_matching := false;
  FOR rec IN (
    SELECT c.conname, c.confdeltype, c.confrelid, ra.attname AS ref_col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.revisions'::regclass
      AND a.attname = 'question_id'
  ) LOOP
    IF rec.confrelid = 'public.questions'::regclass AND rec.ref_col = 'id' AND rec.confdeltype = 'c' THEN
      fk_fully_matching := true;
    ELSE
      EXECUTE format('ALTER TABLE public.revisions DROP CONSTRAINT %I', rec.conname);
    END IF;
  END LOOP;

  IF NOT fk_fully_matching THEN
    SELECT count(*) INTO orphan_count
    FROM public.revisions r
    WHERE r.question_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = r.question_id);

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'MIGRATION HALTED: Found % revision(s) in public.revisions referencing non-existent question_id. Resolve orphaned revision references before enforcing constraint. Transaction rolled back, no data was modified.', orphan_count;
    END IF;

    ALTER TABLE public.revisions
      ADD CONSTRAINT revisions_question_id_fkey 
      FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
  END IF;

  -- ------------------------------------------------------------------
  -- 3. revision_sessions(revision_id) -> revisions(id) ON DELETE SET NULL ('n')
  -- ------------------------------------------------------------------
  fk_fully_matching := false;
  FOR rec IN (
    SELECT c.conname, c.confdeltype, c.confrelid, ra.attname AS ref_col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.revision_sessions'::regclass
      AND a.attname = 'revision_id'
  ) LOOP
    IF rec.confrelid = 'public.revisions'::regclass AND rec.ref_col = 'id' AND rec.confdeltype = 'n' THEN
      fk_fully_matching := true;
    ELSE
      EXECUTE format('ALTER TABLE public.revision_sessions DROP CONSTRAINT %I', rec.conname);
    END IF;
  END LOOP;

  IF NOT fk_fully_matching THEN
    SELECT count(*) INTO orphan_count
    FROM public.revision_sessions rs
    WHERE rs.revision_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM public.revisions r WHERE r.id = rs.revision_id);

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'MIGRATION HALTED: Found % revision session(s) referencing non-existent revision_id in public.revisions. Resolve orphaned references before enforcing constraint. Transaction rolled back, no data was modified.', orphan_count;
    END IF;

    ALTER TABLE public.revision_sessions
      ADD CONSTRAINT revision_sessions_revision_id_fkey 
      FOREIGN KEY (revision_id) REFERENCES public.revisions(id) ON DELETE SET NULL;
  END IF;

  -- ------------------------------------------------------------------
  -- 4. revision_sessions(question_id) -> questions(id) ON DELETE CASCADE ('c')
  -- ------------------------------------------------------------------
  fk_fully_matching := false;
  FOR rec IN (
    SELECT c.conname, c.confdeltype, c.confrelid, ra.attname AS ref_col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.revision_sessions'::regclass
      AND a.attname = 'question_id'
  ) LOOP
    IF rec.confrelid = 'public.questions'::regclass AND rec.ref_col = 'id' AND rec.confdeltype = 'c' THEN
      fk_fully_matching := true;
    ELSE
      EXECUTE format('ALTER TABLE public.revision_sessions DROP CONSTRAINT %I', rec.conname);
    END IF;
  END LOOP;

  IF NOT fk_fully_matching THEN
    SELECT count(*) INTO orphan_count
    FROM public.revision_sessions rs
    WHERE rs.question_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = rs.question_id);

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'MIGRATION HALTED: Found % revision session(s) referencing non-existent question_id in public.questions. Resolve orphaned references before enforcing constraint. Transaction rolled back, no data was modified.', orphan_count;
    END IF;

    ALTER TABLE public.revision_sessions
      ADD CONSTRAINT revision_sessions_question_id_fkey 
      FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
  END IF;

  -- ------------------------------------------------------------------
  -- 5. notifications(question_id) -> questions(id) ON DELETE CASCADE ('c')
  -- ------------------------------------------------------------------
  fk_fully_matching := false;
  FOR rec IN (
    SELECT c.conname, c.confdeltype, c.confrelid, ra.attname AS ref_col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.notifications'::regclass
      AND a.attname = 'question_id'
  ) LOOP
    IF rec.confrelid = 'public.questions'::regclass AND rec.ref_col = 'id' AND rec.confdeltype = 'c' THEN
      fk_fully_matching := true;
    ELSE
      EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', rec.conname);
    END IF;
  END LOOP;

  IF NOT fk_fully_matching THEN
    SELECT count(*) INTO orphan_count
    FROM public.notifications n
    WHERE n.question_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = n.question_id);

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'MIGRATION HALTED: Found % notification(s) referencing non-existent question_id in public.questions. Resolve orphaned references before enforcing constraint. Transaction rolled back, no data was modified.', orphan_count;
    END IF;

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_question_id_fkey 
      FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ====================================================================
-- SECTION 8: Row Level Security (RLS) & Service-Role Isolation
-- ====================================================================
-- Security Review:
--   - ReviseCode uses Express backend mediated access with SUPABASE_SERVICE_ROLE_KEY.
--   - Enabling RLS default-denies unauthenticated/anonymous direct queries via PostgREST.
--   - Explicit policies grant full CRUD access exclusively to the 'service_role' PostgreSQL role.
--   - Does NOT silently delete custom user policies.
--   - The service-role key itself is NEVER exposed or stored in the database.

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- subjects policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'service_role_all_subjects'
  ) THEN
    CREATE POLICY service_role_all_subjects ON public.subjects 
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- questions policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'questions' AND policyname = 'service_role_all_questions'
  ) THEN
    CREATE POLICY service_role_all_questions ON public.questions 
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- revisions policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'revisions' AND policyname = 'service_role_all_revisions'
  ) THEN
    CREATE POLICY service_role_all_revisions ON public.revisions 
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- revision_sessions policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'revision_sessions' AND policyname = 'service_role_all_revision_sessions'
  ) THEN
    CREATE POLICY service_role_all_revision_sessions ON public.revision_sessions 
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- notifications policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'service_role_all_notifications'
  ) THEN
    CREATE POLICY service_role_all_notifications ON public.notifications 
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- user_settings policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_settings' AND policyname = 'service_role_all_user_settings'
  ) THEN
    CREATE POLICY service_role_all_user_settings ON public.user_settings 
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- ====================================================================
-- SECTION 9: Force PostgREST schema cache reload
-- ====================================================================
-- Executes strictly AFTER transaction commit so PostgREST reloads its
-- internal schema cache immediately when the migration succeeds.
NOTIFY pgrst, 'reload schema';
