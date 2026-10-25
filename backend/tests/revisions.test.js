import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase, getTestDatabase } from './test-helper.js';

beforeEach(() => {
  setupTestDatabase();
});

test('GET /api/revisions returns all revision milestones with calculated statuses', async () => {
  const res = await request(app, { method: 'GET', url: '/api/revisions' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 10);
});

test('GET /api/revisions/today returns milestones due today', async () => {
  const res = await request(app, { method: 'GET', url: '/api/revisions/today' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));

  // Every item in today must have status 'due'
  for (const item of res.body.data) {
    assert.equal(item.status, 'due');
  }
});

test('GET /api/revisions/upcoming returns future milestones', async () => {
  const res = await request(app, { method: 'GET', url: '/api/revisions/upcoming' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);

  for (const item of res.body.data) {
    assert.equal(item.status, 'upcoming');
  }
});

test('GET /api/revisions/completed returns finished milestones', async () => {
  const res = await request(app, { method: 'GET', url: '/api/revisions/completed' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);

  for (const item of res.body.data) {
    assert.equal(item.status, 'completed');
    assert.ok(item.completedAt);
  }
});

test('POST /api/revisions/:id/complete marks milestone as completed with recall rating and preserves other milestones', async () => {
  const db = getTestDatabase();
  // Find Day 3 milestone of q_lc_50 which is due today
  const target = db.revisions.find(
    r => r.question_id === 'q_lc_50' && r.milestone_day === 3
  );
  assert.ok(target, 'Target milestone for q_lc_50 Day 3 must exist');

  // Record dueDate of Day 7 milestone to verify it does not shift
  const day7MilestoneBefore = db.revisions.find(
    r => r.question_id === 'q_lc_50' && r.milestone_day === 7
  );
  const day7DueDateBefore = day7MilestoneBefore.due_date;

  const res = await request(app, {
    method: 'POST',
    url: `/api/revisions/${target.id}/complete`,
    body: {
      recallRating: 'easy',
      notes: 'Solved smoothly using binary exponentiation.'
    }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'completed');
  assert.equal(res.body.data.recallRating, 'easy');
  assert.ok(res.body.data.completedAt);

  // Verify other milestones for this question remain completely unshifted
  const day7MilestoneAfter = db.revisions.find(
    r => r.question_id === 'q_lc_50' && r.milestone_day === 7
  );
  assert.equal(day7MilestoneAfter.due_date, day7DueDateBefore);
});

test('POST /api/revisions/:id/complete rejects already completed milestone with 400', async () => {
  const db = getTestDatabase();
  // Find an already completed milestone in seed data
  const completed = db.revisions.find(r => r.completed_at !== null);
  assert.ok(completed);

  const res = await request(app, {
    method: 'POST',
    url: `/api/revisions/${completed.id}/complete`,
    body: { recallRating: 'easy' }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /already completed/i);
});

test('POST /api/revisions/:id/reschedule updates dueDate for that milestone only', async () => {
  const db = getTestDatabase();
  const target = db.revisions.find(
    r => r.question_id === 'q_lc_50' && r.milestone_day === 7
  );
  assert.ok(target);

  const res = await request(app, {
    method: 'POST',
    url: `/api/revisions/${target.id}/reschedule`,
    body: { newDueDate: '2026-05-01' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.dueDate, '2026-05-01');

  // Verify stored in persistent repository
  const updatedInRepo = db.revisions.find(r => r.id === target.id);
  assert.equal(updatedInRepo.due_date, '2026-05-01');
});

test('POST /api/revisions/:id/reschedule rejects invalid date format with 400', async () => {
  const db = getTestDatabase();
  const target = db.revisions[0];

  const res = await request(app, {
    method: 'POST',
    url: `/api/revisions/${target.id}/reschedule`,
    body: { newDueDate: 'invalid-date-format' }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/revisions/custom creates a custom milestone successfully', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/revisions/custom',
    body: {
      questionId: 'q_lc_50',
      milestoneDay: 45,
      dueDate: '2026-06-15',
      notes: 'Final pre-interview review'
    }
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.milestoneDay, 45);
  assert.equal(res.body.data.dueDate, '2026-06-15');
});
