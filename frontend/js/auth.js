/**
 * ReviseCode Authentication Service (js/auth.js)
 * Clean architecture ready for Firebase Authentication provider integration.
 * Runs in transparent Development/Demo mode when Firebase is not connected.
 */

const SESSION_KEY = 'revisecode_demo_session';

export const AuthService = {
  isConfiguredWithFirebase() {
    // Check if Firebase Auth is initialized and configured in window
    return typeof window.firebase !== 'undefined' && Boolean(window.firebase?.auth);
  },

  getCurrentUser() {
    try {
      const data = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      // Fallback
    }
    // Return standard demo user profile for quick preview
    return {
      id: 'demo_user_1',
      name: 'Sachin Kumar',
      email: 'sachin@example.com',
      avatar: 'SK',
      isDemo: true
    };
  },

  async login({ email, password, rememberMe = false }) {
    if (this.isConfiguredWithFirebase()) {
      // Real Firebase integration point
      throw new Error('Firebase Authentication is not yet configured with project API keys.');
    }

    // Demo Mode Simulation
    await new Promise(r => setTimeout(r, 600)); // simulate brief network latency

    const user = {
      id: 'user_' + Date.now(),
      name: email.split('@')[0],
      email: email,
      avatar: email.substring(0, 2).toUpperCase(),
      isDemo: true,
      signedInAt: new Date().toISOString()
    };

    const storageTarget = rememberMe ? localStorage : sessionStorage;
    storageTarget.setItem(SESSION_KEY, JSON.stringify(user));
    return { success: true, user, isDemo: true };
  },

  async register({ fullName, email, password }) {
    if (this.isConfiguredWithFirebase()) {
      throw new Error('Firebase Authentication is not yet configured with project API keys.');
    }

    await new Promise(r => setTimeout(r, 600));

    const user = {
      id: 'user_' + Date.now(),
      name: fullName,
      email: email,
      avatar: fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U',
      isDemo: true,
      signedInAt: new Date().toISOString()
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return { success: true, user, isDemo: true };
  },

  async resetPassword(email) {
    if (this.isConfiguredWithFirebase()) {
      throw new Error('Firebase Authentication is not yet configured with project API keys.');
    }

    await new Promise(r => setTimeout(r, 500));
    return {
      success: true,
      message: `Demo mode: Password reset instructions simulated for ${email}. In production, Firebase will dispatch an actual verification email.`
    };
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
  }
};
