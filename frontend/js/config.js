/**
/**
 * ReviseCode Frontend Environment & API Configuration (frontend/js/config.js)
 * Resolves the backend API Base URL dynamically across local development and production.
 */

export function getApiBaseUrl() {
  // 1. Explicit window runtime variable (e.g. injected via script tag or Vercel edge/HTML)
  if (typeof window !== 'undefined' && window.__REVISECODE_API_URL__) {
    return String(window.__REVISECODE_API_URL__).trim().replace(/\/+$/, '');
  }

  // 2. Local storage override (allows switching target backend without code rebuilds)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem('revisecode_api_base_url');
      if (stored && typeof stored === 'string') {
        const clean = stored.trim().replace(/\/+$/, '');
        if (clean) return clean;
      }
    } catch (_) {
      // localStorage may be disabled in private/sandboxed iframe modes
    }
  }

  // 3. Dynamic browser environment detection
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    // Local development or test mock environment without domain
    if (hostname === 'localhost' || hostname === '127.0.0.1' || !hostname) {
      return `http://${hostname || 'localhost'}:5001/api`;
    }

    // Production (Vercel deployment or custom domain):
    // Use relative '/api', which Vercel proxies to the deployed Render backend via vercel.json rewrites.
    return '/api';
  }

  // 4. Default fallback for headless test runners / SSR
  return 'http://localhost:5001/api';
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Helper to dynamically set and persist a custom backend URL (useful in QA/staging).
 * @param {string} url - Target backend base URL (e.g. 'https://revisecode-backend.onrender.com/api')
 */
export function setCustomApiBaseUrl(url) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (!url) {
      window.localStorage.removeItem('revisecode_api_base_url');
    } else {
      window.localStorage.setItem('revisecode_api_base_url', url.trim().replace(/\/+$/, ''));
    }
  }
}
