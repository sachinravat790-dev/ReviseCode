import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase } from './test-helper.js';
import { updateGeminiApiKey } from '../src/config/env.js';

beforeEach(() => {
  setupTestDatabase();
});

// ========================================================
// 1. Dashboard Tests
// ========================================================

test('GET /api/dashboard/stats returns real-time aggregated metrics', async () => {
  const res = await request(app, { method: 'GET', url: '/api/dashboard/stats' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const stats = res.body.data;
  assert.ok(typeof stats.totalQuestions === 'number');
  assert.ok(stats.totalQuestions >= 3);
  assert.ok(typeof stats.dueToday === 'number');
  assert.ok(typeof stats.overdue === 'number');
  assert.ok(typeof stats.completed === 'number');
  assert.ok(typeof stats.completionRate === 'number');
});

test('GET /api/dashboard/activity returns recent revision review sessions', async () => {
  const res = await request(app, { method: 'GET', url: '/api/dashboard/activity?limit=5' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.items));
  assert.ok(res.body.data.items.length > 0);

  const session = res.body.data.items[0];
  assert.ok(session.id);
  assert.ok(session.questionTitle);
  assert.equal(session.recallRating, 'easy');
});

test('GET /api/dashboard/progress returns subject distribution and percentages', async () => {
  const res = await request(app, { method: 'GET', url: '/api/dashboard/progress' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.items));

  const dsa = res.body.data.items.find(s => s.name === 'DSA');
  assert.ok(dsa);
  assert.ok(dsa.questionCount >= 3);
  assert.equal(dsa.percentage, 100);
});

// ========================================================
// 2. Notifications Tests
// ========================================================

test('GET /api/notifications returns system notifications', async () => {
  const res = await request(app, { method: 'GET', url: '/api/notifications' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.items));
  assert.ok(res.body.data.items.length >= 2);
});

test('PATCH /api/notifications/:id/read marks notification as read', async () => {
  const listRes = await request(app, { method: 'GET', url: '/api/notifications' });
  const notif = listRes.body.data.items[0];
  assert.ok(notif);

  const readRes = await request(app, {
    method: 'PATCH',
    url: `/api/notifications/${notif.id}/read`
  });

  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.success, true);
  assert.equal(readRes.body.data.isRead, true);
});

test('PATCH /api/notifications/:id/read returns 404 for unknown notification', async () => {
  const readRes = await request(app, {
    method: 'PATCH',
    url: '/api/notifications/unknown_id/read'
  });

  assert.equal(readRes.status, 404);
  assert.equal(readRes.body.success, false);
});

// ========================================================
// 3. User Settings Tests
// ========================================================

test('GET /api/settings returns application preferences', async () => {
  const res = await request(app, { method: 'GET', url: '/api/settings' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.theme, 'dark');
  assert.equal(res.body.data.reminderTime, '09:00');
  assert.equal(res.body.data.studyGoalQuestions, 3);
});

test('PUT /api/settings updates application preferences persistently', async () => {
  const updateRes = await request(app, {
    method: 'PUT',
    url: '/api/settings',
    body: {
      studyGoalQuestions: 5,
      theme: 'light',
      reminderTime: '10:00'
    }
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.success, true);
  assert.equal(updateRes.body.data.studyGoalQuestions, 5);
  assert.equal(updateRes.body.data.theme, 'light');

  // Verify persistence with a fresh GET
  const getRes = await request(app, { method: 'GET', url: '/api/settings' });
  assert.equal(getRes.body.data.studyGoalQuestions, 5);
  assert.equal(getRes.body.data.theme, 'light');
  assert.equal(getRes.body.data.reminderTime, '10:00');
});

// ========================================================
// 4. AI Assistant Tests
// ========================================================

test('GET /api/assistant/capabilities returns deterministic mode metadata', async () => {
  updateGeminiApiKey('');
  const res = await request(app, { method: 'GET', url: '/api/assistant/capabilities' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.mode, 'deterministic_mock');
  assert.ok(Array.isArray(res.body.data.supportedCommands));
});

test('POST /api/assistant/command executes "show_due_revisions"', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/command',
    body: { command: 'show_due_revisions' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.items));
});

test('POST /api/assistant/command executes "add_question" and schedules milestones', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/command',
    body: {
      command: 'add_question',
      payload: {
        title: 'Trapping Rain Water',
        platform: 'LeetCode',
        problemNumber: '42',
        difficulty: 'Hard',
        subject: 'DSA',
        topic: 'Two Pointers'
      }
    }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.question);
  assert.equal(res.body.data.question.title, 'Trapping Rain Water');

  // Check it is saved in persistent repository
  const checkRes = await request(app, {
    method: 'GET',
    url: `/api/questions/${res.body.data.question.id}`
  });
  assert.equal(checkRes.status, 200);
  assert.equal(checkRes.body.data.milestones.length, 5);
});

test('POST /api/assistant/command returns 400 for unsupported or missing commands', async () => {
  // Empty command
  const res1 = await request(app, {
    method: 'POST',
    url: '/api/assistant/command',
    body: {}
  });
  assert.equal(res1.status, 400);
  assert.equal(res1.body.success, false);

  // Unsupported command (the expected 400 fallback used by frontend chat)
  const res2 = await request(app, {
    method: 'POST',
    url: '/api/assistant/command',
    body: { command: 'hello from user' }
  });
  assert.equal(res2.status, 400);
  assert.equal(res2.body.success, false);
  assert.match(res2.body.message, /Unsupported command/i);
});

test('POST /api/assistant/command returns 400 when required payload is missing', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/command',
    body: {
      command: 'add_question',
      payload: { topic: 'Arrays' } // missing title and platform
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Missing required details/i);
});
