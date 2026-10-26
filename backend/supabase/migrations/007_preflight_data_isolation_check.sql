-- ====================================================================
-- ReviseCode Multi-User Data Isolation Preflight Inspection Script
-- File: backend/supabase/migrations/007_preflight_data_isolation_check.sql
-- 
-- PURPOSE:
--   Comprehensive, strictly 100% read-only preflight diagnostic audit to
--   inspect database metadata, row counts, NULL user_id counts, constraints,
--   indexes, RLS policies, duplicate records, orphaned references, and
--   registered Supabase auth accounts BEFORE applying migration 007.
--
-- STRICT SAFETY GUARANTEES:
--   - 100% READ-ONLY: ZERO INSERT, UPDATE, DELETE, MERGE, CREATE, ALTER,
--     DROP, or TRUNCATE operations.
--   - ZERO TEMPORARY TABLES: Absolutely no CREATE TEMP TABLE, DROP TABLE,
--     or table mutations of any kind.
--   - ZERO PROCEDURAL DO BLOCKS: Pure standalone SELECT queries only.
--   - Non-Destructive & Schema-Guarded: Uses system catalog queries and
--     to_jsonb(t) ->> 'user_id' syntax so queries never fail parse or
--     execution even if the user_id column has not yet been added.
--   - No Ownership Assumptions: Does NOT assume which account owns legacy
--     records. Safely lists real Supabase auth.users accounts (UUID & email)
--     so the owner can verify their exact UUID before any manual backfill.
--   - No Secret Exposure: Never selects passwords, tokens, or sensitive hashes.
--
-- HOW TO RUN IN SUPABASE SQL EDITOR:
--   1. Open Supabase Project Dashboard -> SQL Editor.
--   2. Paste the entire contents of this file into a query tab.
--   3. Click "Run".
--   4. Review the returned diagnostic result sets for:
--        - Query 1:  Table Inventory & Row Estimates
--        - Query 2:  Column Inventory, Data Types & Nullability
--        - Query 3:  Primary Keys and Unique Constraints
--        - Query 4:  Index Definitions, Expressions & Predicates
--        - Query 5:  Foreign Keys (Ordered Columns, ON DELETE & ON UPDATE)
--        - Query 6:  Row Level Security (RLS) Status & Active Policies
--        - Query 7:  Ownership Column & Foreign Key Status
--        - Query 8:  Registered Supabase Auth Accounts (Verified UUID Lookup)
--        - Query 9:  Row Counts & Ownership Health Across All 6 Affected Tables
--        - Query 10: Duplicate Questions Check (Intended Unique Constraint)
--        - Query 11: Duplicate Revisions Check (Intended Unique Rule)
--        - Query 12: Cross-User Revisions Check (Ownership Integrity)
--        - Query 13: User Settings Health & Duplicate Inspection
--        - Query 14: Orphaned Referential Integrity Inspection
-- ====================================================================


-- ====================================================================
-- QUERY 1: TABLE INVENTORY & ROW ESTIMATES
-- ====================================================================
-- Checks existence, row estimates, and RLS flags for all affected tables.
SELECT 
  c.relname AS table_name,
  n.nspname AS schema_name,
  c.reltuples::bigint AS estimated_rows,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs', 'subjects')
  AND c.relkind = 'r'
ORDER BY c.relname;


-- ====================================================================
-- QUERY 2: COLUMN INVENTORY, DATA TYPES & NULLABILITY
-- ====================================================================
-- Inspects schema structure for all columns in the 6 affected tables.
SELECT 
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
ORDER BY table_name, ordinal_position;


-- ====================================================================
-- QUERY 3: PRIMARY KEYS AND UNIQUE CONSTRAINTS
-- ====================================================================
-- Audits all existing primary keys and unique constraints across affected tables.
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS constrained_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name 
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name, tc.constraint_type DESC, tc.constraint_name;


-- ====================================================================
-- QUERY 4: INDEX DEFINITIONS, EXPRESSIONS & PREDICATES
-- ====================================================================
-- Inspects actual PostgreSQL index definitions, uniqueness, and partial WHERE clauses.
SELECT 
  t.relname AS table_name,
  i.relname AS index_name,
  ix.indisunique AS is_unique,
  ix.indisprimary AS is_primary,
  pg_get_indexdef(ix.indexrelid) AS index_definition,
  pg_get_expr(ix.indpred, ix.indrelid) AS filter_predicate
FROM pg_catalog.pg_index ix
JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
ORDER BY t.relname, i.relname;


-- ====================================================================
-- QUERY 5: FOREIGN KEYS WITH ORDERED COLUMNS, ON DELETE & ON UPDATE
-- ====================================================================
-- Audits all foreign key relationships, target tables, and cascade rules.
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name AS local_column,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name 
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc 
  ON tc.constraint_name = rc.constraint_name 
  AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu 
  ON rc.unique_constraint_name = ccu.constraint_name 
  AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;


-- ====================================================================
-- QUERY 6: ROW LEVEL SECURITY (RLS) STATUS & ACTIVE POLICIES
-- ====================================================================
-- Inspects all active RLS policies, commands (SELECT/INSERT/UPDATE/DELETE),
-- roles (authenticated/service_role), and security expressions.
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
ORDER BY tablename, policyname;


-- ====================================================================
-- QUERY 7: OWNERSHIP COLUMN & FOREIGN KEY STATUS
-- ====================================================================
-- Verifies whether user_id exists and is linked to auth.users for each table.
SELECT 
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  CASE 
    WHEN fk.constraint_name IS NOT NULL THEN 'REFERENCES auth.users(id)'
    ELSE 'NO FOREIGN KEY TO auth.users'
  END AS foreign_key_status,
  fk.delete_rule
FROM information_schema.columns c
LEFT JOIN (
  SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
  JOIN information_schema.constraint_column_usage ccu 
    ON rc.unique_constraint_name = ccu.constraint_name AND rc.unique_constraint_schema = ccu.constraint_schema
  WHERE tc.table_schema = 'public'
    AND ccu.table_schema = 'auth'
    AND ccu.table_name = 'users'
    AND ccu.column_name = 'id'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE c.table_schema = 'public'
  AND c.table_name IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
  AND c.column_name = 'user_id'
ORDER BY c.table_name;


-- ====================================================================
-- QUERY 8: REGISTERED SUPABASE AUTH ACCOUNTS (VERIFIED UUID LOOKUP)
-- ====================================================================
-- Safely lists registered auth.users accounts so the project owner can identify
-- their exact UUID for verified administration. Zero secret exposure.
SELECT 
  id AS auth_user_uuid,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at,
  is_anonymous,
  raw_app_meta_data ->> 'provider' AS auth_provider
FROM auth.users
ORDER BY created_at ASC;


-- ====================================================================
-- QUERY 9: ROW COUNTS & OWNERSHIP HEALTH ACROSS ALL 6 AFFECTED TABLES
-- ====================================================================
-- Uses to_jsonb(t) ->> 'user_id' so this query runs safely even before
-- migration 007 has added the user_id column to tables.
SELECT 
  'questions' AS table_name,
  count(*)::bigint AS total_rows,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NULL)::bigint AS null_or_unassigned_user_id_count,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NOT NULL)::bigint AS assigned_user_id_count,
  count(DISTINCT to_jsonb(t) ->> 'user_id')::bigint AS distinct_assigned_users
FROM public.questions t

UNION ALL

SELECT 
  'revisions' AS table_name,
  count(*)::bigint AS total_rows,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NULL)::bigint AS null_or_unassigned_user_id_count,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NOT NULL)::bigint AS assigned_user_id_count,
  count(DISTINCT to_jsonb(t) ->> 'user_id')::bigint AS distinct_assigned_users
FROM public.revisions t

UNION ALL

SELECT 
  'revision_sessions' AS table_name,
  count(*)::bigint AS total_rows,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NULL)::bigint AS null_or_unassigned_user_id_count,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NOT NULL)::bigint AS assigned_user_id_count,
  count(DISTINCT to_jsonb(t) ->> 'user_id')::bigint AS distinct_assigned_users
FROM public.revision_sessions t

UNION ALL

SELECT 
  'notifications' AS table_name,
  count(*)::bigint AS total_rows,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NULL)::bigint AS null_or_unassigned_user_id_count,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NOT NULL)::bigint AS assigned_user_id_count,
  count(DISTINCT to_jsonb(t) ->> 'user_id')::bigint AS distinct_assigned_users
FROM public.notifications t

UNION ALL

SELECT 
  'user_settings' AS table_name,
  count(*)::bigint AS total_rows,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NULL)::bigint AS null_or_unassigned_user_id_count,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NOT NULL)::bigint AS assigned_user_id_count,
  count(DISTINCT to_jsonb(t) ->> 'user_id')::bigint AS distinct_assigned_users
FROM public.user_settings t

UNION ALL

SELECT 
  'whatsapp_logs' AS table_name,
  count(*)::bigint AS total_rows,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NULL)::bigint AS null_or_unassigned_user_id_count,
  count(*) FILTER (WHERE to_jsonb(t) ->> 'user_id' IS NOT NULL)::bigint AS assigned_user_id_count,
  count(DISTINCT to_jsonb(t) ->> 'user_id')::bigint AS distinct_assigned_users
FROM public.whatsapp_logs t

ORDER BY table_name;


-- ====================================================================
-- QUERY 10: DUPLICATE QUESTIONS CHECK (INTENDED UNIQUE CONSTRAINT)
-- ====================================================================
-- Evaluates duplicate questions against the intended unique constraint:
--   UNIQUE (user_id, lower(trim(platform)), problem_number)
--   WHERE problem_number IS NOT NULL AND user_id IS NOT NULL.
-- Also audits legacy duplicates where problem_number IS NOT NULL.
SELECT 
  COALESCE(to_jsonb(q) ->> 'user_id', '(unassigned)') AS user_id_scope,
  lower(trim(COALESCE(to_jsonb(q) ->> 'platform', ''))) AS normalized_platform,
  to_jsonb(q) ->> 'problem_number' AS problem_number,
  count(*)::bigint AS duplicate_count,
  string_agg((to_jsonb(q) ->> 'id')::text, ', ') AS question_ids,
  string_agg(to_jsonb(q) ->> 'title', ' | ') AS question_titles
FROM public.questions q
WHERE to_jsonb(q) ->> 'problem_number' IS NOT NULL
GROUP BY 
  COALESCE(to_jsonb(q) ->> 'user_id', '(unassigned)'),
  lower(trim(COALESCE(to_jsonb(q) ->> 'platform', ''))),
  to_jsonb(q) ->> 'problem_number'
HAVING count(*) > 1
ORDER BY duplicate_count DESC;


-- ====================================================================
-- QUERY 11: DUPLICATE REVISIONS CHECK (INTENDED UNIQUE RULE)
-- ====================================================================
-- Checks for multiple revision records for the same question and milestone day.
SELECT 
  to_jsonb(r) ->> 'question_id' AS question_id,
  to_jsonb(r) ->> 'milestone_day' AS milestone_day,
  count(*)::bigint AS duplicate_count,
  string_agg((to_jsonb(r) ->> 'id')::text, ', ') AS duplicate_revision_ids
FROM public.revisions r
GROUP BY 
  to_jsonb(r) ->> 'question_id',
  to_jsonb(r) ->> 'milestone_day'
HAVING count(*) > 1
ORDER BY duplicate_count DESC;


-- ====================================================================
-- QUERY 12: CROSS-USER REVISIONS CHECK (OWNERSHIP INTEGRITY)
-- ====================================================================
-- Checks whether any revision is assigned to a user different from the question owner.
SELECT 
  (to_jsonb(r) ->> 'id')::text AS revision_id,
  (to_jsonb(r) ->> 'user_id')::text AS revision_user_id,
  (to_jsonb(q) ->> 'id')::text AS question_id,
  (to_jsonb(q) ->> 'user_id')::text AS question_user_id,
  (to_jsonb(q) ->> 'title')::text AS question_title
FROM public.revisions r
JOIN public.questions q ON (to_jsonb(r) ->> 'question_id')::text = (to_jsonb(q) ->> 'id')::text
WHERE (to_jsonb(r) ->> 'user_id') IS NOT NULL
  AND (to_jsonb(q) ->> 'user_id') IS NOT NULL
  AND (to_jsonb(r) ->> 'user_id') <> (to_jsonb(q) ->> 'user_id');


-- ====================================================================
-- QUERY 13: USER SETTINGS HEALTH & DUPLICATE INSPECTION
-- ====================================================================
-- Inspects user_settings rows, ownership, duplicate settings per user, and null fields.
SELECT 
  (to_jsonb(s) ->> 'id')::text AS settings_row_id,
  COALESCE(to_jsonb(s) ->> 'user_id', '(unassigned)') AS user_id,
  to_jsonb(s) ->> 'theme' AS theme,
  to_jsonb(s) ->> 'reminder_time' AS reminder_time,
  to_jsonb(s) ->> 'study_goal_questions' AS study_goal_questions,
  to_jsonb(s) ->> 'whatsapp_notifications' AS whatsapp_notifications,
  to_jsonb(s) ->> 'custom_intervals_enabled' AS custom_intervals_enabled,
  to_jsonb(s) ->> 'in_app_notifications' AS in_app_notifications,
  to_jsonb(s) ->> 'email_notifications' AS email_notifications
FROM public.user_settings s
ORDER BY settings_row_id;


-- ====================================================================
-- QUERY 14: ORPHANED REFERENTIAL INTEGRITY INSPECTION
-- ====================================================================
-- Inspects any records referencing non-existent parent records across relationships.
SELECT 
  'revisions -> questions' AS relationship,
  count(*)::bigint AS orphaned_record_count
FROM public.revisions r
LEFT JOIN public.questions q ON (to_jsonb(r) ->> 'question_id')::text = (to_jsonb(q) ->> 'id')::text
WHERE (to_jsonb(r) ->> 'question_id') IS NOT NULL 
  AND q.id IS NULL

UNION ALL

SELECT 
  'revision_sessions -> questions' AS relationship,
  count(*)::bigint AS orphaned_record_count
FROM public.revision_sessions s
LEFT JOIN public.questions q ON (to_jsonb(s) ->> 'question_id')::text = (to_jsonb(q) ->> 'id')::text
WHERE (to_jsonb(s) ->> 'question_id') IS NOT NULL 
  AND q.id IS NULL

UNION ALL

SELECT 
  'notifications -> questions' AS relationship,
  count(*)::bigint AS orphaned_record_count
FROM public.notifications n
LEFT JOIN public.questions q ON (to_jsonb(n) ->> 'question_id')::text = (to_jsonb(q) ->> 'id')::text
WHERE (to_jsonb(n) ->> 'question_id') IS NOT NULL 
  AND q.id IS NULL

UNION ALL

SELECT 
  'whatsapp_logs -> questions' AS relationship,
  count(*)::bigint AS orphaned_record_count
FROM public.whatsapp_logs w
LEFT JOIN public.questions q ON (to_jsonb(w) ->> 'question_id')::text = (to_jsonb(q) ->> 'id')::text
WHERE (to_jsonb(w) ->> 'question_id') IS NOT NULL 
  AND q.id IS NULL

ORDER BY relationship;
