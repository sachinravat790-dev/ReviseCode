import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase } from './test-helper.js';
import { SupabaseRepository } from '../src/repositories/supabase.repository.js';
import { setSupabaseClient } from '../src/config/supabase.js';

beforeEach(() => {
  setupTestDatabase();
});

// ========================================================
// 1. Persistence Across Restart Verification
// ========================================================

test('Persistence verification: created question and milestones survive across client re-initialization', async () => {
  // 1. Create a question
  const createRes = await request(app, {
    method: 'POST',
    url: '/api/questions',
    body: {
      title: 'Persistent Merge Intervals',
      platform: 'LeetCode',
      problemNumber: '56',
      problemUrl: 'https://leetcode.com/problems/merge-intervals/',
      subjectId: 'sub_dsa',
      topic: 'Intervals',
      difficulty: 'Medium',
      dateSolved: '2026-03-22',
      approach: 'Sort intervals by start time and merge overlaps.'
    }
  });

  assert.equal(createRes.status, 201);
  const questionId = createRes.body.data.id;

  // 2. Simulate Backend Restart by re-instantiating the repository pointing to the same database
  const repo = new SupabaseRepository();
  const fetchedQuestion = await repo.getQuestionById(questionId);

  assert.ok(fetchedQuestion, 'Question must survive backend restart');
  assert.equal(fetchedQuestion.title, 'Persistent Merge Intervals');
  assert.equal(fetchedQuestion.milestones.length, 5, '5 milestones must survive backend restart');

  // 3. Complete a milestone and verify session persistence
  const milestoneToComplete = fetchedQuestion.milestones[0];
  const completeRes = await request(app, {
    method: 'POST',
    url: `/api/revisions/${milestoneToComplete.id}/complete`,
    body: { recallRating: 'easy', notes: 'Recalled interval sorting pattern' }
  });
  assert.equal(completeRes.status, 200);

  // 4. Verify dashboard stats reflect the new question and completion
  const statsRes = await request(app, { method: 'GET', url: '/api/dashboard/stats' });
  assert.equal(statsRes.status, 200);
  assert.ok(statsRes.body.data.totalQuestions >= 4);
});

// ========================================================
// 2. Database Failure & Error Handling
// ========================================================

test('Handles database failure gracefully with 500 error response', async () => {
  // Create a mock client that simulates a real PostgreSQL server error
  const failingClient = {
    from() {
      const errorBuilder = {
        select() { return errorBuilder; },
        insert() { return errorBuilder; },
        update() { return errorBuilder; },
        delete() { return errorBuilder; },
        eq() { return errorBuilder; },
        ilike() { return errorBuilder; },
        or() { return errorBuilder; },
        order() { return errorBuilder; },
        range() { return errorBuilder; },
        single() { return errorBuilder; },
        maybeSingle() { return errorBuilder; },
        then(resolve) {
          return resolve({ data: null, error: new Error('PostgreSQL connection terminated unexpectedly') });
        }
      };
      return errorBuilder;
    }
  };

  setSupabaseClient(failingClient);

  // Request should be caught by centralized errorHandler and return clean 500 JSON
  const res = await request(app, { method: 'GET', url: '/api/questions' });
  assert.equal(res.status, 500);
  assert.equal(res.body.success, false);
  assert.ok(res.body.message);
  assert.match(res.body.message, /PostgreSQL connection terminated/i);
});
