-- ====================================================================
-- Migration: 006_create_whatsapp_logs.sql
-- Path: backend/supabase/migrations/006_create_whatsapp_logs.sql
-- Description: Non-destructive storage for WhatsApp Business Platform
--              Cloud API delivery logs, duplicate tracking, and error diagnostics.
--
-- Safety Guarantees:
--   - ZERO data loss: Never drops tables or columns.
--   - Transactional atomicity: Runs within BEGIN ... COMMIT.
--   - Enables Row Level Security (RLS) with explicit service_role access.
--   - Enforces unique reminders per revision, reminder window, and date.
-- ====================================================================

BEGIN;

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

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON public.whatsapp_logs (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_revision_id ON public.whatsapp_logs (revision_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_question_id ON public.whatsapp_logs (question_id);

-- Enforce duplicate prevention per revision, window, and reminder date
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_logs_unique_window 
  ON public.whatsapp_logs (revision_id, reminder_window, reminder_date) 
  WHERE status IN ('sent', 'simulated_test_mode') AND revision_id IS NOT NULL;

-- Enable Row Level Security and service_role policy
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'whatsapp_logs' AND policyname = 'service_role_all_whatsapp_logs'
  ) THEN
    CREATE POLICY service_role_all_whatsapp_logs ON public.whatsapp_logs 
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
