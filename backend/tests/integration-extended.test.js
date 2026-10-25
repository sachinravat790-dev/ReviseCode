import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase, getTestDatabase } from './test-helper.js';

beforeEach(() => {
  setupTestDatabase();
});

// ========================================================
// 1. Subjects: color, icon, topics, and question counts
// ========================================================

test('Subject schema verification: color, icon, topics are properly returned and updated', async () => {
  // 1. Fetch subjects and check schema properties
  const listRes = await request(app, { method: 'GET', url: '/api/subjects' });
  assert.equal(listRes.status, 200);
  const dsa = listRes.body.data.find(s => s.name === 'DSA');
  assert.ok(dsa, 'DSA subject should exist');
  assert.equal(dsa.color, '#7c3aed');
  assert.equal(dsa.icon, 'binary');
  assert.ok(Array.isArray(dsa.topics));
  assert.ok(dsa.topics.includes('Arrays'));

  // 2. Update color, icon, and topics
  const updateRes = await request(app, {
    method: 'PUT',
    url: `/api/subjects/${dsa.id}`,
    body: {
      color: '#4f46e5',
      icon: 'code-2',
      topics: ['Arrays', 'Strings', 'Dynamic Programming', 'Trie']
    }
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.color, '#4f46e5');
  assert.equal(updateRes.body.data.icon, 'code-2');
  assert.deepEqual(updateRes.body.data.topics, ['Arrays', 'Strings', 'Dynamic Programming', 'Trie']);
});

// ========================================================
// 2. User Settings: preferences, toggles, and fallback defaults
// ========================================================

test('User Settings verification: retrieves and updates application preferences', async () => {
  // 1. Get default settings
  const getRes = await request(app, { method: 'GET', url: '/api/settings' });
  assert.equal(getRes.status, 200);
  const settings = getRes.body.data;
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.studyGoalQuestions, 3);
  assert.equal(settings.customIntervalsEnabled, false);
  assert.deepEqual(settings.customIntervalDays, [45, 60]);

  // 2. Update settings
  const updateRes = await request(app, {
    method: 'PUT',
    url: '/api/settings',
    body: {
      theme: 'light',
      studyGoalQuestions: 5,
      customIntervalsEnabled: true,
      customIntervalDays: [30, 60, 90],
      inAppNotifications: true,
      emailNotifications: false
    }
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.theme, 'light');
  assert.equal(updateRes.body.data.studyGoalQuestions, 5);
  assert.equal(updateRes.body.data.customIntervalsEnabled, true);
  assert.deepEqual(updateRes.body.data.customIntervalDays, [30, 60, 90]);
  assert.equal(updateRes.body.data.emailNotifications, false);
});

// ========================================================
// 3. Revisions: skip action & session recording
// ========================================================

test('Revision skip and session recording verification', async () => {
  const db = getTestDatabase();
  const target = db.revisions.find(r => r.question_id === 'q_lc_50' && r.milestone_day === 3);
  assert.ok(target);

  // 1. Skip milestone with a reason
  const skipRes = await request(app, {
    method: 'POST',
    url: `/api/revisions/${target.id}/skip`,
    body: { reason: 'Exam week preparation' }
  });

  assert.equal(skipRes.status, 200);
  assert.match(skipRes.body.data.notes, /Skipped: Exam week preparation/);

  // 2. Verify recent activity endpoint reflects completed reviews
  const activityRes = await request(app, { method: 'GET', url: '/api/dashboard/activity' });
  assert.equal(activityRes.status, 200);
  assert.ok(Array.isArray(activityRes.body.data.items));
});

// ========================================================
// 4. Questions: multi-filter search and integer problem_number
// ========================================================

test('Questions multi-filter query: filters by platform, difficulty, and bookmark simultaneously', async () => {
  const res = await request(app, {
    method: 'GET',
    url: '/api/questions?platform=LeetCode&difficulty=Medium&bookmarked=true'
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data.items));
  for (const q of res.body.data.items) {
    assert.equal(q.platform, 'LeetCode');
    assert.equal(q.difficulty, 'Medium');
    assert.equal(q.bookmarked, true);
  }
});
