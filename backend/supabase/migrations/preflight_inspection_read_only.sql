-- ====================================================================
-- SCRIPT: preflight_inspection_read_only.sql
-- Path: backend/supabase/migrations/preflight_inspection_read_only.sql
-- Description: Strictly READ-ONLY comprehensive schema and data audit
--              for ReviseCode Supabase PostgreSQL database.
--
-- Safety Guarantees:
--   - 100% READ-ONLY: ZERO INSERTs, UPDATEs, DELETEs, ALTERs, or DROPs on persistent tables.
--   - Crash-proof: Uses system catalogs and dynamic relation checks (to_regclass)
--     so the script succeeds even if some tables do not exist yet.
--   - Inspects table existence, column data types, nullability, defaults,
--     foreign keys (columns + ON DELETE action), unique indexes & expressions,
--     Row Level Security (RLS) policies, duplicate records, and orphaned references.
-- ====================================================================

-- --------------------------------------------------------------------
-- REPORT 1: Table Existence & Live Row Counts
-- --------------------------------------------------------------------
SELECT 
  expected_table AS table_name,
  (to_regclass('public.' || expected_table) IS NOT NULL) AS table_exists,
  CASE 
    WHEN expected_table = 'subjects' AND to_regclass('public.subjects') IS NOT NULL
      THEN (SELECT count(*)::text FROM public.subjects)
    WHEN expected_table = 'questions' AND to_regclass('public.questions') IS NOT NULL
      THEN (SELECT count(*)::text FROM public.questions)
    WHEN expected_table = 'revisions' AND to_regclass('public.revisions') IS NOT NULL
      THEN (SELECT count(*)::text FROM public.revisions)
    WHEN expected_table = 'revision_sessions' AND to_regclass('public.revision_sessions') IS NOT NULL
      THEN (SELECT count(*)::text FROM public.revision_sessions)
    WHEN expected_table = 'notifications' AND to_regclass('public.notifications') IS NOT NULL
      THEN (SELECT count(*)::text FROM public.notifications)
    WHEN expected_table = 'user_settings' AND to_regclass('public.user_settings') IS NOT NULL
      THEN (SELECT count(*)::text FROM public.user_settings)
    ELSE 'TABLE NOT YET CREATED'
  END AS live_row_count
FROM (
  VALUES 
    ('subjects'),
    ('questions'),
    ('revisions'),
    ('revision_sessions'),
    ('notifications'),
    ('user_settings')
) AS t(expected_table)
ORDER BY expected_table;


-- --------------------------------------------------------------------
-- REPORT 2: Column Inventory, Data Types, Nullability, and Defaults
-- --------------------------------------------------------------------
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('subjects', 'questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings')
ORDER BY table_name, ordinal_position;


-- --------------------------------------------------------------------
-- REPORT 3: Primary Keys and Foreign Keys Definition Audit
-- --------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name AS referencing_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.delete_rule AS on_delete_action,
  CASE
    WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'OK: Primary Key'
    WHEN tc.table_name = 'questions' AND kcu.column_name = 'subject_id' AND ccu.table_name = 'subjects' AND rc.delete_rule = 'SET NULL' THEN 'OK: Expected SET NULL'
    WHEN tc.table_name = 'questions' AND kcu.column_name = 'subject_id' AND rc.delete_rule <> 'SET NULL' THEN 'ACTION NEEDED: Expected ON DELETE SET NULL'
    WHEN tc.table_name = 'revisions' AND kcu.column_name = 'question_id' AND ccu.table_name = 'questions' AND rc.delete_rule = 'CASCADE' THEN 'OK: Expected CASCADE'
    WHEN tc.table_name = 'revisions' AND kcu.column_name = 'question_id' AND rc.delete_rule <> 'CASCADE' THEN 'ACTION NEEDED: Expected ON DELETE CASCADE'
    WHEN tc.table_name = 'revision_sessions' AND kcu.column_name = 'revision_id' AND ccu.table_name = 'revisions' AND rc.delete_rule = 'SET NULL' THEN 'OK: Expected SET NULL'
    WHEN tc.table_name = 'revision_sessions' AND kcu.column_name = 'revision_id' AND rc.delete_rule <> 'SET NULL' THEN 'ACTION NEEDED: Expected ON DELETE SET NULL'
    WHEN tc.table_name = 'revision_sessions' AND kcu.column_name = 'question_id' AND ccu.table_name = 'questions' AND rc.delete_rule = 'CASCADE' THEN 'OK: Expected CASCADE'
    WHEN tc.table_name = 'revision_sessions' AND kcu.column_name = 'question_id' AND rc.delete_rule <> 'CASCADE' THEN 'ACTION NEEDED: Expected ON DELETE CASCADE'
    WHEN tc.table_name = 'notifications' AND kcu.column_name = 'question_id' AND ccu.table_name = 'questions' AND rc.delete_rule = 'CASCADE' THEN 'OK: Expected CASCADE'
    WHEN tc.table_name = 'notifications' AND kcu.column_name = 'question_id' AND rc.delete_rule <> 'CASCADE' THEN 'ACTION NEEDED: Expected ON DELETE CASCADE'
    ELSE 'OTHER CONSTRAINT'
  END AS audit_status
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name AND rc.constraint_schema = ccu.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('subjects', 'questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;


-- --------------------------------------------------------------------
-- REPORT 4: Existing Indexes & Expressions Audit
-- --------------------------------------------------------------------
SELECT 
  pi.tablename AS table_name,
  pi.indexname AS index_name,
  i.indisunique AS is_unique,
  pg_get_indexdef(i.indexrelid) AS full_index_definition
FROM pg_indexes pi
JOIN pg_class c ON c.relname = pi.indexname AND c.relnamespace = 'public'::regnamespace
JOIN pg_index i ON i.indexrelid = c.oid
WHERE pi.schemaname = 'public'
  AND pi.tablename IN ('subjects', 'questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings')
ORDER BY pi.tablename, pi.indexname;


-- --------------------------------------------------------------------
-- REPORT 5: Row Level Security (RLS) & Policy Audit
-- --------------------------------------------------------------------
SELECT 
  t.tablename AS table_name,
  t.rowsecurity AS rls_enabled,
  p.policyname AS policy_name,
  p.roles AS permitted_roles,
  p.cmd AS command_type,
  p.permissive,
  p.qual AS using_expression,
  p.with_check AS check_expression,
  CASE
    WHEN t.rowsecurity IS FALSE THEN 'WARNING: RLS is disabled on this table!'
    WHEN p.policyname IS NULL THEN 'INFO: Table has RLS enabled with Default Deny (no policies)'
    WHEN 'anon' = ANY(p.roles) OR 'public' = ANY(p.roles) THEN 'SECURITY RISK: Policy grants permissive access to anon/public!'
    WHEN 'service_role' = ANY(p.roles) THEN 'OK: Restricted to backend service_role'
    ELSE 'CUSTOM ROLE POLICY'
  END AS security_assessment
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN ('subjects', 'questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings')
ORDER BY t.tablename, p.policyname;


-- --------------------------------------------------------------------
-- REPORT 6: Safe Dynamic Data Integrity Audit (Duplicates, Nulls, Orphans)
-- --------------------------------------------------------------------
DROP TABLE IF EXISTS pg_temp.preflight_data_audit;
CREATE TEMP TABLE pg_temp.preflight_data_audit (
  check_type text,
  target_relation text,
  issue_found boolean,
  record_count integer,
  details text
);

DO $$
DECLARE
  v_cnt integer;
  v_details text;
BEGIN
  -- 1. Check subjects (duplicates & nulls)
  IF to_regclass('public.subjects') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM (SELECT lower(trim(name)) FROM public.subjects GROUP BY lower(trim(name)) HAVING count(*) > 1) s' INTO v_cnt;
    IF v_cnt > 0 THEN
      EXECUTE 'SELECT string_agg(format(''"%s" (%s records)'', dup, cnt), '', '') FROM (SELECT lower(trim(name)) AS dup, count(*) AS cnt FROM public.subjects GROUP BY lower(trim(name)) HAVING count(*) > 1) s' INTO v_details;
      INSERT INTO pg_temp.preflight_data_audit VALUES ('DUPLICATE CHECK', 'subjects(lower(trim(name)))', true, v_cnt, 'Duplicate subject names found: ' || v_details);
    ELSE
      INSERT INTO pg_temp.preflight_data_audit VALUES ('DUPLICATE CHECK', 'subjects(lower(trim(name)))', false, 0, 'No duplicates found (Clean)');
    END IF;

    EXECUTE 'SELECT count(*) FROM public.subjects WHERE name IS NULL' INTO v_cnt;
    INSERT INTO pg_temp.preflight_data_audit VALUES ('NULL CHECK', 'subjects(name)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Subjects found with NULL name' ELSE 'All subject names non-null (Clean)' END);
  ELSE
    INSERT INTO pg_temp.preflight_data_audit VALUES ('TABLE STATUS', 'public.subjects', false, 0, 'Table does not exist yet');
  END IF;

  -- 2. Check questions (duplicates, nulls, orphans)
  IF to_regclass('public.questions') IS NOT NULL THEN
    -- Check column type of problem_number
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'problem_number' AND data_type = 'integer'
    ) THEN
      EXECUTE 'SELECT count(*) FROM (SELECT lower(trim(platform)), problem_number FROM public.questions WHERE problem_number IS NOT NULL GROUP BY lower(trim(platform)), problem_number HAVING count(*) > 1) q' INTO v_cnt;
    ELSE
      EXECUTE 'SELECT count(*) FROM (SELECT lower(trim(platform)), trim(problem_number::text) FROM public.questions WHERE problem_number IS NOT NULL AND trim(problem_number::text) <> '''' GROUP BY lower(trim(platform)), trim(problem_number::text) HAVING count(*) > 1) q' INTO v_cnt;
    END IF;

    IF v_cnt > 0 THEN
      INSERT INTO pg_temp.preflight_data_audit VALUES ('DUPLICATE CHECK', 'questions(platform, problem_number)', true, v_cnt, 'Duplicate (platform, problem_number) pairs exist');
    ELSE
      INSERT INTO pg_temp.preflight_data_audit VALUES ('DUPLICATE CHECK', 'questions(platform, problem_number)', false, 0, 'No duplicate problem numbers (Clean)');
    END IF;

    -- Orphaned subject_id check
    IF to_regclass('public.subjects') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.questions q WHERE q.subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = q.subject_id)' INTO v_cnt;
      INSERT INTO pg_temp.preflight_data_audit VALUES ('ORPHAN CHECK', 'questions -> subjects(id)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Found questions with invalid subject_id' ELSE 'All subject_ids valid (Clean)' END);
    END IF;
  ELSE
    INSERT INTO pg_temp.preflight_data_audit VALUES ('TABLE STATUS', 'public.questions', false, 0, 'Table does not exist yet');
  END IF;

  -- 3. Check revisions
  IF to_regclass('public.revisions') IS NOT NULL THEN
    -- NULL question_id
    EXECUTE 'SELECT count(*) FROM public.revisions WHERE question_id IS NULL' INTO v_cnt;
    INSERT INTO pg_temp.preflight_data_audit VALUES ('NULL CHECK', 'revisions(question_id)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Milestones found with NULL question_id' ELSE 'All question_ids non-null (Clean)' END);

    -- NULL milestone_day or due_date
    EXECUTE 'SELECT count(*) FROM public.revisions WHERE milestone_day IS NULL OR due_date IS NULL' INTO v_cnt;
    INSERT INTO pg_temp.preflight_data_audit VALUES ('NULL CHECK', 'revisions(milestone_day/due_date)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Milestones found with NULL day or due_date' ELSE 'All milestone days/due_dates non-null (Clean)' END);

    -- Duplicate (question_id, due_date)
    EXECUTE 'SELECT count(*) FROM (SELECT question_id, due_date FROM public.revisions GROUP BY question_id, due_date HAVING count(*) > 1) r' INTO v_cnt;
    INSERT INTO pg_temp.preflight_data_audit VALUES ('DUPLICATE CHECK', 'revisions(question_id, due_date)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Duplicate milestones for same question on same date' ELSE 'No duplicate milestones (Clean)' END);

    -- Orphaned question_id
    IF to_regclass('public.questions') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.revisions r WHERE r.question_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = r.question_id)' INTO v_cnt;
      INSERT INTO pg_temp.preflight_data_audit VALUES ('ORPHAN CHECK', 'revisions -> questions(id)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Revisions reference non-existent question_id' ELSE 'All question references valid (Clean)' END);
    END IF;

    -- Invalid recall_rating
    EXECUTE 'SELECT count(*) FROM public.revisions WHERE recall_rating IS NOT NULL AND recall_rating NOT IN (''easy'', ''difficult'', ''forgot'')' INTO v_cnt;
    INSERT INTO pg_temp.preflight_data_audit VALUES ('DOMAIN CHECK', 'revisions(recall_rating)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Found invalid recall_rating values' ELSE 'All recall_ratings valid (Clean)' END);
  ELSE
    INSERT INTO pg_temp.preflight_data_audit VALUES ('TABLE STATUS', 'public.revisions', false, 0, 'Table does not exist yet (Will be created by migration 005)');
  END IF;

  -- 4. Check revision_sessions
  IF to_regclass('public.revision_sessions') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.revision_sessions WHERE question_id IS NULL OR recall_rating IS NULL' INTO v_cnt;
    INSERT INTO pg_temp.preflight_data_audit VALUES ('NULL CHECK', 'revision_sessions(question_id/rating)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Sessions have NULL question_id or recall_rating' ELSE 'All session fields non-null (Clean)' END);

    IF to_regclass('public.questions') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.revision_sessions rs WHERE rs.question_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = rs.question_id)' INTO v_cnt;
      INSERT INTO pg_temp.preflight_data_audit VALUES ('ORPHAN CHECK', 'revision_sessions -> questions(id)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Sessions reference non-existent question_id' ELSE 'All question references valid (Clean)' END);
    END IF;

    IF to_regclass('public.revisions') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.revision_sessions rs WHERE rs.revision_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.revisions r WHERE r.id = rs.revision_id)' INTO v_cnt;
      INSERT INTO pg_temp.preflight_data_audit VALUES ('ORPHAN CHECK', 'revision_sessions -> revisions(id)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Sessions reference non-existent revision_id' ELSE 'All revision references valid (Clean)' END);
    END IF;
  ELSE
    INSERT INTO pg_temp.preflight_data_audit VALUES ('TABLE STATUS', 'public.revision_sessions', false, 0, 'Table does not exist yet (Will be created by migration 005)');
  END IF;

  -- 5. Check notifications
  IF to_regclass('public.notifications') IS NOT NULL THEN
    IF to_regclass('public.questions') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.notifications n WHERE n.question_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.id = n.question_id)' INTO v_cnt;
      INSERT INTO pg_temp.preflight_data_audit VALUES ('ORPHAN CHECK', 'notifications -> questions(id)', v_cnt > 0, v_cnt, CASE WHEN v_cnt > 0 THEN 'Notifications reference non-existent question_id' ELSE 'All question references valid (Clean)' END);
    END IF;
  ELSE
    INSERT INTO pg_temp.preflight_data_audit VALUES ('TABLE STATUS', 'public.notifications', false, 0, 'Table does not exist yet (Will be created by migration 005)');
  END IF;

  -- 6. Check user_settings
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.user_settings WHERE id = ''default''' INTO v_cnt;
    INSERT INTO pg_temp.preflight_data_audit VALUES ('SETTINGS CHECK', 'user_settings(default)', false, v_cnt, CASE WHEN v_cnt > 0 THEN 'Default user settings row exists' ELSE 'Default row absent (will be created by migration)' END);
  ELSE
    INSERT INTO pg_temp.preflight_data_audit VALUES ('TABLE STATUS', 'public.user_settings', false, 0, 'Table does not exist yet (Will be created by migration 005)');
  END IF;
END $$;

SELECT * FROM pg_temp.preflight_data_audit
ORDER BY check_type, target_relation;


-- --------------------------------------------------------------------
-- REPORT 7: Executive Pre-Flight Migration Readiness Summary
-- --------------------------------------------------------------------
SELECT 
  (SELECT count(*) FROM pg_temp.preflight_data_audit WHERE check_type = 'TABLE STATUS' AND record_count = 0) AS missing_tables_count,
  (SELECT coalesce(sum(record_count), 0) FROM pg_temp.preflight_data_audit WHERE check_type = 'DUPLICATE CHECK' AND issue_found IS TRUE) AS total_duplicate_records,
  (SELECT coalesce(sum(record_count), 0) FROM pg_temp.preflight_data_audit WHERE check_type = 'NULL CHECK' AND issue_found IS TRUE) AS total_null_required_fields,
  (SELECT coalesce(sum(record_count), 0) FROM pg_temp.preflight_data_audit WHERE check_type = 'ORPHAN CHECK' AND issue_found IS TRUE) AS total_orphaned_references,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_temp.preflight_data_audit WHERE issue_found IS TRUE) THEN 'BLOCKING ISSUES DETECTED: Review Report 6 details before applying migration'
    ELSE 'READY TO APPLY: Migration 005 can be safely applied without rollback'
  END AS migration_verdict;
