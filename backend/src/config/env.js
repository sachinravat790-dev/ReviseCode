import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

// Load .env from backend root if present, preserving pre-set environment variables like NODE_ENV=test
const existingNodeEnv = process.env.NODE_ENV;
dotenv.config({ path: envPath, override: true });
if (existingNodeEnv) {
  process.env.NODE_ENV = existingNodeEnv;
}

let lastEnvMtime = 0;
let explicitOverride = false;

export function reloadEnvFromDisk(force = false) {
  // In automated test runs, avoid reading disk .env unless explicitly forced
  if (process.env.NODE_ENV === 'test' && !force) {
    return config._geminiApiKey || process.env.GEMINI_API_KEY || '';
  }

  try {
    if (fs.existsSync(envPath)) {
      const stat = fs.statSync(envPath);
      if (force || (!explicitOverride && stat.mtimeMs > lastEnvMtime)) {
        lastEnvMtime = stat.mtimeMs;
        const content = fs.readFileSync(envPath, 'utf8');
        const parsed = dotenv.parse(content);
        if (parsed.GEMINI_API_KEY) {
          process.env.GEMINI_API_KEY = parsed.GEMINI_API_KEY.trim();
          config._geminiApiKey = process.env.GEMINI_API_KEY;
        } else {
          config._geminiApiKey = '';
        }
        if (parsed.GOOGLE_API_KEY && !config._geminiApiKey) {
          process.env.GOOGLE_API_KEY = parsed.GOOGLE_API_KEY.trim();
          config._geminiApiKey = process.env.GOOGLE_API_KEY;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to reload .env from disk:', err.message);
  }
  return config._geminiApiKey || process.env.GEMINI_API_KEY || '';
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 5001,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // WhatsApp Business Platform Cloud API configuration
  whatsappApiToken: process.env.WHATSAPP_API_TOKEN || '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  whatsappRecipientPhoneNumber: process.env.WHATSAPP_RECIPIENT_PHONE_NUMBER || '',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  whatsappTestMode: process.env.WHATSAPP_TEST_MODE !== 'false', // Defaults to true for safety
  whatsappTemplateName: process.env.WHATSAPP_TEMPLATE_NAME || '',
  whatsappTemplateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'en_US',

  // Google Gemini API Configuration (Dynamic getter with disk sync)
  _geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  get geminiApiKey() {
    if (!explicitOverride) {
      reloadEnvFromDisk();
    }
    return this._geminiApiKey || '';
  },
  set geminiApiKey(val) {
    this._geminiApiKey = (val || '').trim();
    process.env.GEMINI_API_KEY = this._geminiApiKey;
    process.env.GOOGLE_API_KEY = this._geminiApiKey;
  }
};

/**
 * Returns true if both Supabase URL and Service Role Key are provided.
 */
export function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

/**
 * Returns true if WhatsApp Cloud API credentials are provided.
 */
export function isWhatsAppConfigured() {
  return Boolean(config.whatsappApiToken && config.whatsappPhoneNumberId && config.whatsappRecipientPhoneNumber);
}

/**
 * Returns true if Google Gemini API key is configured and not a placeholder.
 */
export function isGeminiConfigured() {
  const key = config.geminiApiKey;
  if (!key || typeof key !== 'string') return false;
  const clean = key.trim();
  if (!clean) return false;
  if (clean === 'your_actual_api_key' || clean === 'your_api_key' || clean === 'your_gemini_api_key' || clean.startsWith('your_')) {
    return false;
  }
  return true;
}

/**
 * Updates Gemini API key in runtime memory.
 */
export function updateGeminiApiKey(newKey) {
  const clean = (newKey || '').trim();
  explicitOverride = true;
  config._geminiApiKey = clean;
  process.env.GEMINI_API_KEY = clean;
  process.env.GOOGLE_API_KEY = clean;
}

/**
 * Safely persists GEMINI_API_KEY into backend/.env without altering other keys.
 */
export function saveGeminiApiKeyToEnv(newKey) {
  const cleanKey = (newKey || '').trim();
  updateGeminiApiKey(cleanKey);

  // In test environments, never mutate the disk .env file
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  explicitOverride = false;
  const envPath = path.resolve(__dirname, '../../.env');

  try {
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }

    if (/^GEMINI_API_KEY=.*$/m.test(content)) {
      content = content.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${cleanKey}`);
    } else {
      content = content.trimEnd() + `\n\n# Google Gemini API Key\nGEMINI_API_KEY=${cleanKey}\n`;
    }

    fs.writeFileSync(envPath, content, 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to write GEMINI_API_KEY to .env:', err.message);
    return false;
  }
}

/**
 * Safely masks a phone number or token for logs and diagnostic APIs.
 */
export function maskSensitive(str, visibleStart = 4, visibleEnd = 3) {
  if (!str || typeof str !== 'string') return '';
  const clean = str.trim();
  if (clean.length <= visibleStart + visibleEnd) return '****';
  return `${clean.slice(0, visibleStart)}****${clean.slice(-visibleEnd)}`;
}

/**
 * Inspects the token role of a Supabase JWT (e.g. 'anon' vs 'service_role')
 * without verifying signature or logging secret values.
 */
export function getSupabaseKeyRole(key) {
  if (!key || typeof key !== 'string') return null;
  try {
    const parts = key.trim().split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      return payload.role || null;
    }
  } catch (_) {
    return null;
  }
  return null;
}

/**
 * Validates Supabase configuration for runtime startup.
 * Never logs or reveals secret keys.
 */
export function validateSupabaseConfig() {
  const missing = [];
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      message: `[Supabase Configuration Error] Missing required environment variable(s): ${missing.join(', ')}. Please configure them in backend/.env`
    };
  }

  // Detect accidental use of anon (public) key in place of service_role (secret) key
  const detectedRole = getSupabaseKeyRole(config.supabaseServiceRoleKey);
  if (detectedRole === 'anon') {
    return {
      valid: false,
      missing: ['SUPABASE_SERVICE_ROLE_KEY'],
      isAnonKeySupplied: true,
      message: '[Supabase Configuration Error] SUPABASE_SERVICE_ROLE_KEY is set to the Supabase ANON (public) key instead of the SERVICE_ROLE (secret) key. When using the anon key, PostgreSQL Row Level Security (RLS) blocks database writes with "new row violates row-level security policy". Please replace it in your Render environment variables or backend/.env with your Supabase service_role secret key from Project Settings -> API.'
    };
  }

  // Basic URL sanity check
  try {
    const parsed = new URL(config.supabaseUrl);
    if (!parsed.protocol.startsWith('http')) {
      return {
        valid: false,
        missing: ['SUPABASE_URL'],
        message: '[Supabase Configuration Error] SUPABASE_URL must be a valid HTTP/HTTPS URL.'
      };
    }
  } catch (err) {
    return {
      valid: false,
      missing: ['SUPABASE_URL'],
      message: '[Supabase Configuration Error] SUPABASE_URL is not a valid URL.'
    };
  }

  return { valid: true, missing: [] };
}
