/**
 * Dedicated Supabase Client Module (src/config/supabase.js)
 * Manages official @supabase/supabase-js client singleton with backend service role key.
 * Never logs or exposes credentials.
 */

import { createClient } from '@supabase/supabase-js';
import { config, validateSupabaseConfig } from './env.js';

let supabaseClientInstance = null;

/**
 * Retrieves the active Supabase client singleton.
 * Throws a descriptive startup error if required credentials are not configured.
 */
export function getSupabaseClient() {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const validation = validateSupabaseConfig();
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  supabaseClientInstance = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return supabaseClientInstance;
}

/**
 * Injects a mock or custom Supabase client (primarily for isolated automated test suites).
 */
export function setSupabaseClient(client) {
  supabaseClientInstance = client;
}

/**
 * Resets the client instance (useful between test runs).
 */
export function resetSupabaseClient() {
  supabaseClientInstance = null;
}
