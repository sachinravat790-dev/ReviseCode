-- ====================================================================
-- Migration: 011_add_whatsapp_phone_to_settings.sql
-- Description: Adds optional phone_number / whatsapp_phone columns to
--              user_settings for WhatsApp spaced repetition reminders.
-- Idempotent: Safe to execute multiple times without error or data loss.
-- ====================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_settings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'whatsapp_phone') THEN
      ALTER TABLE public.user_settings ADD COLUMN whatsapp_phone text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'phone_number') THEN
      ALTER TABLE public.user_settings ADD COLUMN phone_number text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'whatsapp_api_key') THEN
      ALTER TABLE public.user_settings ADD COLUMN whatsapp_api_key text;
    END IF;
  END IF;
END $$;
