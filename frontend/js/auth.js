/**
 * ReviseCode Authentication Service (js/auth.js)
 * Production JWT authentication client communicating with backend /api/auth endpoints.
 * Supports persistent login sessions, multi-user isolation, and clean state reset.
 */

import { api, invalidateApiCache } from './api.js';

const TOKEN_KEY = 'revisecode_token';
const USER_KEY = 'revisecode_user';
const LEGACY_SESSION_KEY = 'revisecode_demo_session';

export const AuthService = {
  isConfiguredWithFirebase() {
    return typeof window !== 'undefined' && typeof window.firebase !== 'undefined' && Boolean(window.firebase?.auth);
  },

  getToken() {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
    } catch (_) {
      return null;
    }
  },

  getCurrentUser() {
    try {
      if (typeof window === 'undefined') return null;
      const data = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || localStorage.getItem(LEGACY_SESSION_KEY) || sessionStorage.getItem(LEGACY_SESSION_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (_) {}
    return null;
  },

  isAuthenticated() {
    return Boolean(this.getToken() && this.getCurrentUser());
  },

  _clearUserData() {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(USER_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      localStorage.removeItem('revisecode_profile');
      // Wipe out local cached questions/milestones so no stale data leaks across users
      localStorage.removeItem('revisecode_questions');
      localStorage.removeItem('revisecode_milestones');
      localStorage.removeItem('revisecode_sessions');
      localStorage.removeItem('revisecode_notifications');
      localStorage.removeItem('revisecode_settings');
      invalidateApiCache();
    } catch (_) {}
  },

  async login({ email, password, rememberMe = false }) {
    this._clearUserData();

    const res = await api.post('/auth/login', { email, password });
    const user = res.data?.user;
    const token = res.data?.token;

    if (!token || !user) {
      throw new Error(res.message || 'Login failed: missing token or user data');
    }

    // Restore persistent user avatar if server returned initials
    const userEmail = (user.email || email).toLowerCase();
    const cachedPhoto = localStorage.getItem('revisecode_avatar_' + userEmail) || 
                        (user.id && localStorage.getItem('revisecode_avatar_' + user.id)) ||
                        localStorage.getItem('revisecode_global_avatar');

    if (cachedPhoto && (!user.avatar || user.avatar.length <= 3)) {
      user.avatar = cachedPhoto;
    }

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem('revisecode_profile', JSON.stringify(user));

    return { success: true, user, token };
  },

  async register({ fullName, email, password }) {
    this._clearUserData();

    const res = await api.post('/auth/register', { fullName, email, password });
    const user = res.data?.user;
    const token = res.data?.token;

    if (!token || !user) {
      throw new Error(res.message || 'Registration failed: missing token or user data');
    }

    // Default to persistent storage for registration
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem('revisecode_profile', JSON.stringify(user));

    return { success: true, user, token };
  },

  async resetPassword(email) {
    try {
      await api.post('/auth/reset-password', { email });
    } catch (_) {}
    return {
      success: true,
      message: `If an account exists with ${email}, password reset instructions have been sent.`
    };
  },

  /**
   * Initiate Google or GitHub OAuth redirect via Supabase
   */
  async initiateOAuth(provider) {
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://revise-code.vercel.app';
    const redirectUrl = `${origin}/login`;

    let targetUrl = null;
    try {
      const res = await api.get(`/auth/oauth-url/${provider}?redirectTo=${encodeURIComponent(redirectUrl)}`);
      if (res && res.data && res.data.url) {
        targetUrl = res.data.url;
      }
    } catch (_) {}

    if (!targetUrl) {
      const supabaseUrl = 'https://uffxohelmzgvgsbnuuyc.supabase.co';
      targetUrl = `${supabaseUrl}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectUrl)}`;
    }

    if (typeof window !== 'undefined') {
      window.location.href = targetUrl;
    }
  },

  /**
   * Process OAuth response from URL hash fragment (#access_token=... or #error=...)
   */
  async handleOAuthCallback() {
    if (typeof window === 'undefined' || !window.location.hash) return null;

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      if (typeof window.history?.replaceState === 'function') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      const rawDesc = errorDescription || error;
      const cleanDesc = decodeURIComponent(rawDesc.replace(/\+/g, ' '));
      throw new Error(cleanDesc);
    }

    const accessToken = params.get('access_token');
    if (!accessToken) return null;

    if (typeof window.history?.replaceState === 'function') {
      window.history.replaceState(null, '', window.location.pathname);
    }

    this._clearUserData();

    // 1. Try to extract basic user details directly from JWT payload as instant fallback
    let decodedUser = null;
    try {
      const parts = accessToken.split('.');
      if (parts.length >= 2) {
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = (typeof atob === 'function') ? atob(payloadBase64) : Buffer.from(payloadBase64, 'base64').toString('utf8');
        const p = JSON.parse(payloadJson);
        const name = p.user_metadata?.full_name || p.user_metadata?.name || (p.email ? p.email.split('@')[0] : 'User');
        decodedUser = {
          id: p.sub,
          email: p.email,
          name: name,
          avatar: name.substring(0, 2).toUpperCase()
        };
      }
    } catch (_) {}

    // 2. Query backend /api/auth/me using this access token
    let serverUser = null;
    try {
      const res = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res?.data?.user) {
        serverUser = res.data.user;
      }
    } catch (_) {}

    const user = serverUser || decodedUser;
    if (!user) {
      throw new Error('Unable to resolve user profile from authentication token.');
    }

    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem('revisecode_profile', JSON.stringify(user));

    return { success: true, user, token: accessToken };
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    this._clearUserData();
    if (typeof window !== 'undefined') {
      window.location.href = 'login.html';
    }
  }
};
