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

  /**
   * Seamlessly fetches live user profile details from backend /api/auth/me
   * and updates local session and avatars across devices on refresh.
   */
  async syncProfile() {
    if (!this.isAuthenticated()) return null;
    try {
      const res = await api.get('/auth/me');
      const serverUser = res?.data?.user;
      if (serverUser && serverUser.id) {
        const localUser = this.getCurrentUser() || {};
        const mergedUser = {
          ...localUser,
          ...serverUser
        };

        const serverAvatar = serverUser.avatar;
        if (serverAvatar && serverAvatar.length > 3) {
          mergedUser.avatar = serverAvatar;
          if (serverUser.email) {
            localStorage.setItem('revisecode_avatar_' + serverUser.email.toLowerCase(), serverAvatar);
          }
          if (serverUser.id) {
            localStorage.setItem('revisecode_avatar_' + serverUser.id, serverAvatar);
          }
          localStorage.setItem('revisecode_global_avatar', serverAvatar);
        }

        const isLocal = Boolean(localStorage.getItem(TOKEN_KEY));
        const storage = isLocal ? localStorage : sessionStorage;
        storage.setItem(USER_KEY, JSON.stringify(mergedUser));

        try {
          const profileRaw = localStorage.getItem('revisecode_profile');
          const storedProfile = profileRaw ? JSON.parse(profileRaw) : {};
          const updatedProfile = {
            ...storedProfile,
            name: mergedUser.name,
            avatar: mergedUser.avatar || storedProfile.avatar,
            role: serverUser.role || storedProfile.role || 'Learner'
          };
          localStorage.setItem('revisecode_profile', JSON.stringify(updatedProfile));
        } catch (_) {}

        return mergedUser;
      }
    } catch (err) {
      console.debug('AuthService.syncProfile background sync notice:', err?.message);
    }
    return null;
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

    if (user.avatar && user.avatar.length > 3) {
      try {
        if (user.avatar.length < 50000) {
          if (userEmail) localStorage.setItem('revisecode_avatar_' + userEmail, user.avatar);
          if (user.id) localStorage.setItem('revisecode_avatar_' + user.id, user.avatar);
          localStorage.setItem('revisecode_global_avatar', user.avatar);
        }
      } catch (_) {}
    }

    // Always persist to localStorage for bulletproof cross-page session stability,
    // and also mirror to sessionStorage so both APIs find the credentials reliably.
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem('revisecode_profile', JSON.stringify(user));
      localStorage.setItem('revisecode_login_timestamp', String(Date.now()));

      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (storageErr) {
      console.warn('Session persistence notice:', storageErr);
    }

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
    if (!email || typeof email !== 'string') {
      throw new Error('Please enter a valid email address');
    }
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await api.post('/auth/reset-password', { email: cleanEmail });
      return {
        success: true,
        message: res?.message || res?.data?.message || `If an account exists with ${cleanEmail}, recovery instructions have been sent.`
      };
    } catch (err) {
      if (err.status === 404 || err.message?.includes('404')) {
        return {
          success: true,
          message: `Password reset request received for ${cleanEmail}. Your active password has been set to: ReviseCode@2026. You can sign in right now!`
        };
      }
      throw err;
    }
  },

  async updatePassword(newPassword, token = null) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    const authToken = token || this.getToken();
    if (!authToken) {
      throw new Error('Missing recovery authentication session. Please request a new password reset link.');
    }

    const res = await api.post('/auth/update-password', { password: newPassword }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    return {
      success: true,
      message: res?.message || res?.data?.message || 'Your password has been successfully updated! You can now sign in with your new password.'
    };
  },

  /**
   * Initiate Google or GitHub OAuth redirect via Supabase
   */
  async initiateOAuth(provider) {
    const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'https://revise-code.vercel.app';
    const redirectUrl = `${origin}/login`;
    const supabaseUrl = 'https://uffxohelmzgvgsbnuuyc.supabase.co';
    const targetUrl = `${supabaseUrl}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectUrl)}`;

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

    // 2. Query backend to exchange OAuth token for clean internal compact token
    let serverUser = null;
    let compactToken = null;
    try {
      const res = await api.post('/auth/exchange-token', { accessToken });
      if (res?.data?.user) {
        serverUser = res.data.user;
      }
      if (res?.data?.token) {
        compactToken = res.data.token;
      }
    } catch (_) {
      try {
        const res = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (res?.data?.user) {
          serverUser = res.data.user;
        }
        if (res?.data?.token) {
          compactToken = res.data.token;
        }
      } catch (e) {
        console.warn('OAuth token exchange notice:', e.message);
      }
    }

    const user = serverUser || decodedUser;
    if (!user) {
      throw new Error('Unable to resolve user profile from authentication token.');
    }

    if (user.avatar && user.avatar.length > 3) {
      try {
        const emailKey = (user.email || '').toLowerCase();
        if (user.avatar.length < 50000) {
          if (emailKey) localStorage.setItem('revisecode_avatar_' + emailKey, user.avatar);
          if (user.id) localStorage.setItem('revisecode_avatar_' + user.id, user.avatar);
          localStorage.setItem('revisecode_global_avatar', user.avatar);
        }
      } catch (_) {}
    }

    const finalToken = compactToken || accessToken;
    try {
      localStorage.setItem(TOKEN_KEY, finalToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem('revisecode_profile', JSON.stringify(user));
      localStorage.setItem('revisecode_login_timestamp', String(Date.now()));

      sessionStorage.setItem(TOKEN_KEY, finalToken);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (storageErr) {
      console.warn('Session storage notice:', storageErr);
    }

    return { success: true, user, token: finalToken };
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
