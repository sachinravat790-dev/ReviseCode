-- ====================================================================
-- ReviseCode Migration Preflight Script: 008_preflight_rls_check.sql
-- Description: Strictly 100% read-only diagnostic inspection script to audit
--              Row Level Security (RLS) configuration, table existence,
--              column definitions, indexes, foreign keys, duplicate records,
--              NULL ownership counts, and orphaned references BEFORE applying
--              migration 008.
--
-- Safety Guarantees:
-- - 100% READ-ONLY: ZERO INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE.
-- - ZERO TEMP TABLES: Pure SELECT statements only.
-- - Safe against missing tables or missing user_id columns (uses information_schema,
--   pg_catalog, and jsonb conversion to prevent syntax/runtime errors).
-- - Never exposes secret keys, passwords, or authentication hashes.
--
-- How to run:
-- 1. Open Supabase Project Dashboard -> SQL Editor.
-- 2. Paste the entire content of this file and click "Run".
-- 3. Review each result set.
-- ====================================================================


-- ====================================================================
-- QUERY 1: TABLE INVENTORY & RLS STATUS
-- ====================================================================
-- Verifies whether each required table exists, row estimates, whether RLS
-- is enabled (relrowsecurity), and whether RLS is forced (relforcerowsecurity).
SELECT 
  c.relname AS table_name,
  n.nspname AS schema_name,
  c.reltuples::bigint AS estimated_rows,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('questions', 'subjects', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
  AND c.relkind = 'r'
ORDER BY c.relname;


-- ====================================================================
-- QUERY 2: ACTIVE ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
-- Lists all active RLS policies on ReviseCode tables, showing command
-- (SELECT, INSERT, UPDATE, DELETE, ALL), targeted roles, and expressions.
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
  AND tablename IN ('questions', 'subjects', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
ORDER BY tablename, policyname;


-- ====================================================================
-- QUERY 3: AUDIT PERMISSIVE OR CONFLICTING RLS POLICIES
-- ====================================================================
-- Identifies any policy that might accidentally grant unrestricted access
-- (e.g. WITH CHECK (true) for non-service_role) or cause service-role blockage
-- (e.g. policies assigned to PUBLIC that check auth.uid()).
SELECT 
  tablename,
  policyname,
  roles,
  cmd,
  CASE 
    WHEN 'public' = ANY(roles) AND with_check LIKE '%auth.uid()%' THEN 
      'WARNING: Policy on PUBLIC checks auth.uid() which fails for service_role inserts'
    WHEN ('authenticated' = ANY(roles) OR 'anon' = ANY(roles) OR 'public' = ANY(roles)) 
         AND (with_check = 'true' OR qual = 'true') AND tablename != 'subjects' THEN
      'WARNING: Overly permissive policy permits cross-user access or unowned inserts'
    WHEN 'service_role' = ANY(roles) AND with_check = 'true' THEN 
      'OK: Standard backend service_role full access policy'
    WHEN 'authenticated' = ANY(roles) AND with_check LIKE '%user_id%' THEN 
      'OK: User-scoped isolation policy'
    ELSE 'INFORMATIONAL: Custom policy'
  END AS security_assessment
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
ORDER BY tablename, policyname;


-- ====================================================================
-- QUERY 4: SERVICE ROLE ACCESS COVERAGE CHECK
-- ====================================================================
-- Confirms whether service_role has an explicit full-access policy on each table.
SELECT 
  t.table_name,
  CASE 
    WHEN p.policyname IS NOT NULL THEN 'CONFIGURED'
    ELSE 'MISSING - Service role lacks explicit bypass policy'
  END AS service_role_policy_status,
  COALESCE(p.policyname, 'None') AS policy_name
FROM (
  SELECT unnest(ARRAY['questions', 'subjects', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs']) AS table_name
) t
LEFT JOIN pg_catalog.pg_policies p 
  ON p.schemaname = 'public' 
  AND p.tablename = t.table_name 
  AND 'service_role' = ANY(p.roles)
ORDER BY t.table_name;


-- ====================================================================
-- QUERY 5: COLUMN INVENTORY FOR USER OWNERSHIP (user_id)
-- ====================================================================
-- Verifies whether user_id column exists on each table, its type, and nullability.
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
  AND column_name = 'user_id'
ORDER BY table_name;


-- ====================================================================
-- QUERY 6: FOREIGN KEYS ON USER OWNERSHIP (REFERENCES auth.users)
-- ====================================================================
-- Verifies that user_id columns correctly reference auth.users(id) and checks ON DELETE rule.
SELECT 
  tc.table_name,
  kcu.column_name AS local_column,
  ccu.table_schema AS foreign_schema,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column,
  rc.delete_rule,
  rc.update_rule,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc 
  ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu 
  ON rc.unique_constraint_name = ccu.constraint_name AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('questions', 'revisions', 'revision_sessions', 'notifications', 'user_settings', 'whatsapp_logs')
  AND kcu.column_name = 'user_id'
ORDER BY tc.table_name;


-- ====================================================================
-- QUERY 7: UNIQUE INDEXES & CONSTRAINTS ON QUESTIONS
-- ====================================================================
-- Inspects existing unique indexes on questions table (global vs user-scoped).
SELECT 
  i.relname AS index_name,
  ix.indisunique AS is_unique,
  pg_get_indexdef(ix.indexrelid) AS index_definition,
  COALESCE(pg_get_expr(ix.indpred, ix.indrelid), 'None') AS partial_predicate
FROM pg_catalog.pg_index ix
JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'questions'
  AND ix.indisunique = true
ORDER BY i.relname;


-- ====================================================================
-- QUERY 8: ROW COUNTS AND NULL USER_ID COUNTS
-- ====================================================================
-- Safely audits data volume and unowned record counts across all tables
-- without failing if a table or column does not yet exist.
SELECT 
  'questions' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NULL) AS null_user_id_count,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NOT NULL) AS owned_row_count
FROM public.questions t
UNION ALL
SELECT 
  'revisions' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NULL) AS null_user_id_count,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NOT NULL) AS owned_row_count
FROM public.revisions t
UNION ALL
SELECT 
  'revision_sessions' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NULL) AS null_user_id_count,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NOT NULL) AS owned_row_count
FROM public.revision_sessions t
UNION ALL
SELECT 
  'notifications' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NULL) AS null_user_id_count,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NOT NULL) AS owned_row_count
FROM public.notifications t
UNION ALL
SELECT 
  'user_settings' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NULL) AS null_user_id_count,
  COUNT(*) FILTER (WHERE to_jsonb(t)->>'user_id' IS NOT NULL) AS owned_row_count
FROM public.user_settings t
ORDER BY table_name;


-- ====================================================================
-- QUERY 9: DUPLICATE QUESTIONS UNDER USER-SCOPED UNIQUENESS
-- ====================================================================
-- Detects if any user already has duplicate entries for the same problem.
SELECT 
  to_jsonb(t)->>'user_id' AS user_id,
  lower(trim(t.platform)) AS normalized_platform,
  t.problem_number,
  COUNT(*) AS duplicate_count,
  string_agg(t.title, ' | ') AS question_titles
FROM public.questions t
WHERE t.problem_number IS NOT NULL 
  AND to_jsonb(t)->>'user_id' IS NOT NULL
GROUP BY to_jsonb(t)->>'user_id', lower(trim(t.platform)), t.problem_number
HAVING COUNT(*) > 1;


-- ====================================================================
-- QUERY 10: ORPHANED REVISIONS AND SESSIONS
-- ====================================================================
-- Checks referential integrity between questions and milestones/sessions.
SELECT 
  'orphaned_revisions' AS check_name,
  COUNT(*) AS orphaned_count
FROM public.revisions r
LEFT JOIN public.questions q ON r.question_id = q.id
WHERE q.id IS NULL
UNION ALL
SELECT 
  'orphaned_sessions' AS check_name,
  COUNT(*) AS orphaned_count
FROM public.revision_sessions s
LEFT JOIN public.questions q ON s.question_id = q.id
WHERE q.id IS NULL;


-- ====================================================================
-- QUERY 11: REGISTERED SUPABASE AUTH ACCOUNTS (NON-SENSITIVE)
-- ====================================================================
-- Safely lists registered auth.users accounts (UUID, email, creation time)
-- to identify valid account IDs without exposing any passwords, tokens, or hashes.
SELECT 
  id AS auth_user_id,
  email,
  created_at,
  last_sign_in_at,
  confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users
ORDER BY created_at ASC;
