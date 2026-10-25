-- ====================================================================
-- Migration: 003_create_notifications_and_settings.sql
-- Description: Creates persistent storage for user notifications and
--              single-user application preferences/settings.
-- Idempotent: Safe to execute multiple times.
-- ====================================================================

-- 1. Create public.notifications
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


-- 2. Create public.user_settings
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

-- Seed default user configuration if missing
INSERT INTO public.user_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
