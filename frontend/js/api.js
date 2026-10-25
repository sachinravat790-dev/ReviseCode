import { getApiBaseUrl } from './config.js';

/**
 * ReviseCode API Client (frontend/js/api.js)
 * Central HTTP client for frontend-to-backend communication.
 * Base URL: dynamically resolved by getApiBaseUrl() (local 5001/api or production /api)
 */

export const API_BASE_URL = getApiBaseUrl();

const inFlightRequests = new Map();
const responseCache = new Map();
const CACHE_TTL_MS = 3000;

/**
 * Clears the client-side read cache (triggered automatically on any mutation).
 */
export function invalidateApiCache() {
  responseCache.clear();
}

/**
 * Universal request wrapper around window.fetch
 * @param {string} endpoint - API path (e.g. '/questions')
 * @param {object} options - Fetch options (method, headers, body)
 * @returns {Promise<any>} - Resolves with response JSON
 */
export async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${cleanEndpoint}`;

  // Invalidate cache on mutations
  if (method !== 'GET') {
    invalidateApiCache();
  } else {
    // 1. Check short-lived cache for rapid repeated GET calls
    const cached = responseCache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return JSON.parse(JSON.stringify(cached.data));
    }

    // 2. Coalesce in-flight GET requests to prevent duplicate network traffic
    if (inFlightRequests.has(url)) {
      return inFlightRequests.get(url);
    }
  }

  const defaultHeaders = {
    'Accept': 'application/json'
  };

  let body = options.body;
  if (body !== undefined && body !== null) {
    if (typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
      body = JSON.stringify(body);
      defaultHeaders['Content-Type'] = 'application/json';
    } else if (typeof body === 'string') {
      defaultHeaders['Content-Type'] = 'application/json';
    }
  }

  const config = {
    ...options,
    body,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, config);
      
      // Parse response body safely
      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { success: response.ok, message: text };
      }

      if (!response.ok) {
        let errorMessage = data?.message || `HTTP ${response.status}: Request failed`;
        if (Array.isArray(data?.errors) && data.errors.length > 0) {
          const fieldErrors = data.errors.map(err => {
            if (typeof err === 'string') return err;
            return err.field ? `${err.field}: ${err.message}` : err.message;
          }).join(', ');
          errorMessage += ` (${fieldErrors})`;
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        error.errors = data?.errors || [];
        throw error;
      }

      if (method === 'GET') {
        responseCache.set(url, { timestamp: Date.now(), data });
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        const networkError = new Error(`Cannot connect to ReviseCode backend (${baseUrl}). Please verify the backend server is running (if on Render free tier, waking from sleep may take ~30 seconds).`);
        networkError.status = 0;
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw err;
    } finally {
      if (method === 'GET') {
        inFlightRequests.delete(url);
      }
    }
  })();

  if (method === 'GET') {
    inFlightRequests.set(url, fetchPromise);
  }

  return fetchPromise;
}

/**
 * Builds a query string from an object, omitting undefined, null, or 'all'
 */
function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      searchParams.append(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

function appendQuery(endpoint, params) {
  const qs = buildQueryString(params);
  if (!qs) return endpoint;
  return endpoint.includes('?') ? `${endpoint}&${qs.slice(1)}` : `${endpoint}${qs}`;
}

export const api = {
  get: (endpoint, query) => apiRequest(appendQuery(endpoint, query), { method: 'GET' }),
  post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: (endpoint, body) => apiRequest(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),

  // Health check helper
  checkHealth: async () => {
    try {
      const res = await apiRequest('/health', { method: 'GET' });
      return res?.data?.status === 'ok';
    } catch (e) {
      return false;
    }
  }
};
