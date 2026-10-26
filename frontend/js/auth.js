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
