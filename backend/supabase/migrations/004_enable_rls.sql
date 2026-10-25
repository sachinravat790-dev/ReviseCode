-- ====================================================================
-- Migration: 004_enable_rls.sql
-- Description: Enables PostgreSQL Row Level Security (RLS) on all tables.
-- Security Note:
-- ReviseCode is currently a single-user application. All database access
-- is mediated exclusively by the Express backend using SUPABASE_SERVICE_ROLE_KEY.
-- Enabling RLS prevents unauthorized direct client access through Supabase PostgREST
-- while allowing the Express backend service role full controlled access.
-- ====================================================================

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
