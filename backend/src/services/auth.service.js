import crypto from 'node:crypto';
import { getSupabaseClient } from '../config/supabase.js';
import { config, isSupabaseConfigured } from '../config/env.js';

// Fallback in-memory user registry for isolated test suites
const inMemoryUsers = new Map();

function getJwtSecret() {
  return config.supabaseServiceRoleKey || 'revisecode_fallback_secret_key_salt_2026';
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function createJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h64 = base64url(JSON.stringify(header));
  const p64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${h64}.${p64}`).digest('base64url');
  return `${h64}.${p64}.${sig}`;
}

function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h64, p64, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(`${h64}.${p64}`).digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(p64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export function computeAvatar(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'U';
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';
}

export const authService = {
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (14 * 24 * 3600) // 14 days
    };
    return createJwt(payload, getJwtSecret());
  },

  async verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    if (!cleanToken) return null;

    // 1. Verify standard internal HMAC-SHA256 JWT
    const payload = verifyJwt(cleanToken, getJwtSecret());
    if (payload && payload.id) {
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatar: computeAvatar(payload.name)
      };
    }

    // 2. Fallback: verify directly with Supabase Auth (for native Supabase access tokens)
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client?.auth?.getUser) {
          const { data, error } = await client.auth.getUser(cleanToken);
          if (!error && data?.user) {
            const u = data.user;
            const name = u.user_metadata?.name || u.user_metadata?.full_name || u.email.split('@')[0];
            return {
              id: u.id,
              email: u.email,
              name,
              avatar: computeAvatar(name)
            };
          }
        }
      } catch (err) {
        // Network or fetch error in restricted environment
      }
    }

    // 3. Test mock token fallback
    if (config.nodeEnv === 'test') {
      if (cleanToken.startsWith('test_token_')) {
        const userId = cleanToken.replace('test_token_', '');
        const user = inMemoryUsers.get(userId);
        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: computeAvatar(user.name)
          };
        }
        return {
          id: userId,
          email: `${userId}@example.com`,
          name: userId,
          avatar: computeAvatar(userId)
        };
      }
    }

    return null;
  },

  async register({ fullName, email, password }) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    let userId = null;

    // 1. Attempt Supabase Auth creation if configured
    if (isSupabaseConfigured() && config.nodeEnv !== 'test') {
      try {
        const client = getSupabaseClient();
        if (client?.auth?.admin?.createUser) {
          const { data, error } = await client.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: { name: cleanName, full_name: cleanName }
          });

          if (error) {
            if (error.message?.toLowerCase().includes('already') || error.status === 422 || error.code === 'user_already_exists') {
              const err = new Error(`An account with email "${cleanEmail}" is already registered. Please sign in.`);
              err.statusCode = 409;
              throw err;
            }
            throw new Error(`Failed to create account: ${error.message}`);
          }

          if (data?.user?.id) {
            userId = data.user.id;
          }
        }
      } catch (err) {
        if (err.statusCode === 409) throw err;
        console.warn('Supabase Auth registration fallback to managed user token:', err.message);
      }
    }

    // Fallback ID generation if Supabase Auth is bypassed in test mode or local sandbox
    if (!userId) {
      // Check if email already in memory
      for (const u of inMemoryUsers.values()) {
        if (u.email === cleanEmail) {
          const err = new Error(`An account with email "${cleanEmail}" is already registered. Please sign in.`);
          err.statusCode = 409;
          throw err;
        }
      }
      userId = crypto.randomUUID();
    }

    const user = {
      id: userId,
      email: cleanEmail,
      name: cleanName,
      avatar: computeAvatar(cleanName)
    };

    inMemoryUsers.set(userId, { ...user, password });

    const token = this.generateToken(user);
    return { user, token };
  },

  async login({ email, password }) {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Attempt Supabase Auth sign-in if configured
    if (isSupabaseConfigured() && config.nodeEnv !== 'test') {
      try {
        const client = getSupabaseClient();
        if (client?.auth?.signInWithPassword) {
          const { data, error } = await client.auth.signInWithPassword({
            email: cleanEmail,
            password
          });

          if (!error && data?.user) {
            const u = data.user;
            const name = u.user_metadata?.name || u.user_metadata?.full_name || u.email.split('@')[0];
            const user = {
              id: u.id,
              email: u.email,
              name,
              avatar: computeAvatar(name)
            };
            const token = data.session?.access_token || this.generateToken(user);
            return { user, token };
          }

          if (error) {
            const err = new Error('Invalid email or password. Please verify your credentials.');
            err.statusCode = 401;
            throw err;
          }
        }
      } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 409) throw err;
        console.warn('Supabase Auth sign-in fallback to local validation:', err.message);
      }
    }

    // 2. In-memory / Test mode validation
    for (const u of inMemoryUsers.values()) {
      if (u.email === cleanEmail) {
        if (u.password !== password) {
          const err = new Error('Invalid email or password. Please verify your credentials.');
          err.statusCode = 401;
          throw err;
        }
        const user = { id: u.id, email: u.email, name: u.name, avatar: computeAvatar(u.name) };
        const token = this.generateToken(user);
        return { user, token };
      }
    }

    const err = new Error('Invalid email or password. Please verify your credentials.');
    err.statusCode = 401;
    throw err;
  },

  resetTestUsers() {
    inMemoryUsers.clear();
  }
};
