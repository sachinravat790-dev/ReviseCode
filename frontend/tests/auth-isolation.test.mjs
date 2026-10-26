import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Setup browser globals before importing modules
const storageMap = new Map();
const sessionStorageMap = new Map();

globalThis.localStorage = {
  getItem: (k) => storageMap.get(k) || null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};

globalThis.sessionStorage = {
  getItem: (k) => sessionStorageMap.get(k) || null,
  setItem: (k, v) => sessionStorageMap.set(k, String(v)),
  removeItem: (k) => sessionStorageMap.delete(k),
  clear: () => sessionStorageMap.clear()
};

globalThis.window = {
  location: { origin: 'http://localhost:3000', pathname: '/dashboard.html', href: '' },
  addEventListener: () => {},
  lucide: { createIcons: () => {} }
};

globalThis.document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => []
};

// Mock fetch for API client tests
let lastFetchUrl = null;
let lastFetchOptions = null;
let mockFetchResponse = {
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({ success: true, data: {} })
};

globalThis.fetch = async (url, options) => {
  lastFetchUrl = url;
  lastFetchOptions = options;
  return mockFetchResponse;
};

const { AuthService } = await import('../js/auth.js');
const { StorageManager } = await import('../js/storage.js');
const { api } = await import('../js/api.js');

describe('Frontend Multi-User Auth & State Isolation', () => {
  beforeEach(() => {
    storageMap.clear();
    sessionStorageMap.clear();
    lastFetchUrl = null;
    lastFetchOptions = null;
  });

  test('Brand-new visitor has no active session and no hardcoded profile fallback', () => {
    assert.equal(AuthService.getToken(), null);
    assert.equal(AuthService.getCurrentUser(), null);
    assert.equal(AuthService.isAuthenticated(), false);

    const profile = StorageManager.getProfile();
    assert.equal(profile.name, 'Learner');
    assert.equal(profile.streakDays, 0);
  });

  test('StorageManager.init() creates clean empty queues and does not inject fake streak or questions', () => {
    StorageManager.init();

    const questions = StorageManager.getQuestions();
    assert.deepEqual(questions, []);

    const milestones = StorageManager.getMilestones();
    assert.deepEqual(milestones, []);

    const metrics = StorageManager.getDashboardMetrics();
    assert.equal(metrics.totalQuestions, 0);
    assert.equal(metrics.streakDays, 0);
    assert.equal(metrics.dueTodayCount, 0);
    assert.equal(metrics.completedSessionsCount, 0);
  });

  test('AuthService.login() calls /api/auth/login, clears demo residue, and saves token', async () => {
    // Pre-populate old demo residue
    localStorage.setItem('revisecode_questions', JSON.stringify([{ id: 'old_q' }]));
    localStorage.setItem('revisecode_milestones', JSON.stringify([{ id: 'old_m' }]));

    mockFetchResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: {
          token: 'mock-jwt-bob-token',
          user: {
            id: 'bob-newbie-uuid',
            email: 'bob@example.com',
            name: 'Bob Newbie',
            avatar: 'BN'
          }
        }
      })
    };

    const res = await AuthService.login({
      email: 'bob@example.com',
      password: 'BobPassword123!',
      rememberMe: true
    });

    assert.equal(res.success, true);
    assert.equal(res.user.name, 'Bob Newbie');
    assert.equal(AuthService.getToken(), 'mock-jwt-bob-token');
    assert.equal(AuthService.isAuthenticated(), true);

    // Verify demo residue was wiped out
    assert.equal(localStorage.getItem('revisecode_questions'), null);
    assert.equal(localStorage.getItem('revisecode_milestones'), null);
  });

  test('api requests include Authorization header with active Bearer token', async () => {
    localStorage.setItem('revisecode_token', 'active-session-token-xyz');

    mockFetchResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: { totalQuestions: 0, streak: 0 }
      })
    };

    await api.get('/dashboard/stats');

    assert.ok(lastFetchOptions);
    assert.equal(lastFetchOptions.headers['Authorization'], 'Bearer active-session-token-xyz');
  });

  test('AuthService.logout() purges user session, token, and cached profile', async () => {
    localStorage.setItem('revisecode_token', 'active-token');
    localStorage.setItem('revisecode_user', JSON.stringify({ name: 'Bob' }));
    localStorage.setItem('revisecode_profile', JSON.stringify({ name: 'Bob' }));

    await AuthService.logout();

    assert.equal(AuthService.getToken(), null);
    assert.equal(AuthService.getCurrentUser(), null);
    assert.equal(AuthService.isAuthenticated(), false);
    assert.equal(localStorage.getItem('revisecode_profile'), null);
  });

  test('Switching accounts in the same browser isolates account data completely', async () => {
    // 1. User A logs in
    mockFetchResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: {
          token: 'token-user-a',
          user: { id: 'user-a-id', email: 'alice@example.com', name: 'Alice Coder' }
        }
      })
    };
    await AuthService.login({ email: 'alice@example.com', password: 'PasswordA1!' });
    assert.equal(AuthService.getCurrentUser().email, 'alice@example.com');
    assert.equal(AuthService.getToken(), 'token-user-a');

    // Simulate User A having stored local questions
    localStorage.setItem('revisecode_questions', JSON.stringify([{ id: 'q_alice_1', title: 'Two Sum' }]));

    // 2. User A logs out
    await AuthService.logout();
    assert.equal(AuthService.getToken(), null);
    assert.equal(AuthService.getCurrentUser(), null);
    assert.equal(localStorage.getItem('revisecode_questions'), null);

    // 3. User B logs in
    mockFetchResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: {
          token: 'token-user-b',
          user: { id: 'user-b-id', email: 'bob@example.com', name: 'Bob Newbie' }
        }
      })
    };
    await AuthService.login({ email: 'bob@example.com', password: 'PasswordB1!' });
    assert.equal(AuthService.getCurrentUser().email, 'bob@example.com');
    assert.equal(AuthService.getToken(), 'token-user-b');

    // User B must NOT see User A's questions in storage
    const bQuestions = StorageManager.getQuestions();
    assert.deepEqual(bQuestions, [], 'User B must not see User A questions');
  });
});
