import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase, getTestDatabase } from './test-helper.js';

beforeEach(() => {
  setupTestDatabase();
});

test('GET /api/questions returns seed questions with pagination and metadata', async () => {
  const res = await request(app, { method: 'GET', url: '/api/questions' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.items));
  assert.ok(res.body.data.items.length >= 3);
  assert.ok(res.body.data.pagination);
  assert.equal(res.body.data.pagination.page, 1);
});

test('GET /api/questions supports filtering by difficulty and search', async () => {
  const res = await request(app, {
    method: 'GET',
    url: '/api/questions?difficulty=Easy&search=Stock'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.items.length, 1);
  assert.equal(res.body.data.items[0].title, 'Best Time to Buy and Sell Stock');

  // Verify numeric search for problem_number
  const numSearchRes = await request(app, {
    method: 'GET',
    url: '/api/questions?search=50'
  });
  assert.equal(numSearchRes.status, 200);
  assert.equal(numSearchRes.body.data.items.length, 1);
  assert.equal(numSearchRes.body.data.items[0].title, 'Pow(x, n)');
});

test('POST /api/questions creates a question and automatically schedules 5 revision milestones', async () => {
  const newQuestion = {
    title: 'Container With Most Water',
    platform: 'LeetCode',
    problemNumber: '11',
    problemUrl: 'https://leetcode.com/problems/container-with-most-water/',
    subjectId: 'sub_dsa',
    topic: 'Two Pointers',
    difficulty: 'Medium',
    dateSolved: '2026-03-20',
    description: 'Find two lines that together with x-axis forms a container that holds the most water.',
    approach: 'Two pointer approach starting from outer bounds inward.',
    notes: 'Move the shorter line pointer at each step.',
    code: 'var maxArea = function(height) { /* ... */ };',
    programmingLanguage: 'javascript',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    tags: ['array', 'two-pointers', 'greedy']
  };

  const res = await request(app, {
    method: 'POST',
    url: '/api/questions',
    body: newQuestion
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.title, 'Container With Most Water');
  assert.ok(res.body.data.id);

  // Verify scheduled milestones in persistent repository
  const db = getTestDatabase();
  const scheduled = db.revisions.filter(r => r.question_id === res.body.data.id);
  assert.equal(scheduled.length, 5);
  const milestoneDays = scheduled.map(r => r.milestone_day).sort((a, b) => a - b);
  assert.deepEqual(milestoneDays, [3, 7, 12, 20, 30]);

  // Check expected due dates: 2026-03-20 + offsets
  assert.equal(scheduled.find(r => r.milestone_day === 3).due_date, '2026-03-23');
  assert.equal(scheduled.find(r => r.milestone_day === 7).due_date, '2026-03-27');
  assert.equal(scheduled.find(r => r.milestone_day === 12).due_date, '2026-04-01');
  assert.equal(scheduled.find(r => r.milestone_day === 20).due_date, '2026-04-09');
  assert.equal(scheduled.find(r => r.milestone_day === 30).due_date, '2026-04-19');
});

test('POST /api/questions rejects missing required fields with 400', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/questions',
    body: {
      topic: 'Arrays'
      // missing title and platform
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(Array.isArray(res.body.errors));
  assert.ok(res.body.errors.some(e => e.field === 'title'));
});

test('POST /api/questions rejects duplicate platform + problemNumber with 409', async () => {
  const duplicate = {
    title: 'Duplicate Pow(x, n)',
    platform: 'LeetCode',
    problemNumber: '50',
    subjectId: 'sub_dsa',
    difficulty: 'Medium'
  };

  const res = await request(app, {
    method: 'POST',
    url: '/api/questions',
    body: duplicate
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /already exists/i);
});

test('PUT /api/questions/:id updates question details cleanly', async () => {
  const res = await request(app, {
    method: 'PUT',
    url: '/api/questions/q_lc_50',
    body: {
      notes: 'Updated binary exponentiation review notes'
    }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.notes, 'Updated binary exponentiation review notes');
});

test('PATCH /api/questions/:id/bookmark toggles bookmark status', async () => {
  const res = await request(app, {
    method: 'PATCH',
    url: '/api/questions/q_lc_50/bookmark'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(typeof res.body.data.bookmarked, 'boolean');

  // Second toggle should reverse state
  const res2 = await request(app, {
    method: 'PATCH',
    url: '/api/questions/q_lc_50/bookmark'
  });
  assert.equal(res2.body.data.bookmarked, !res.body.data.bookmarked);
});

test('DELETE /api/questions/:id removes question and cascades milestone deletion', async () => {
  const db = getTestDatabase();
  const initialMilestones = db.revisions.filter(r => r.question_id === 'q_lc_50');
  assert.ok(initialMilestones.length > 0);

  const res = await request(app, {
    method: 'DELETE',
    url: '/api/questions/q_lc_50'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // Question should no longer exist
  const getRes = await request(app, {
    method: 'GET',
    url: '/api/questions/q_lc_50'
  });
  assert.equal(getRes.status, 404);

  // All associated milestones must be removed
  const remainingMilestones = db.revisions.filter(r => r.question_id === 'q_lc_50');
  assert.equal(remainingMilestones.length, 0);
});
