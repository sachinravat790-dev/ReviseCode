/**
 * Two-User Data Isolation Verification Suite (tests/two-user-isolation.test.js)
 * Proves rigorous multi-tenant security and zero data leakage between independent registered users.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import { request, setupTestDatabase } from './test-helper.js';

test('Multi-User Data Isolation: Independent accounts, zero leakage, and cross-user access prevention', async () => {
  setupTestDatabase();

  // ==============================================================
  // STEP 1: Register and login User A (Alice Coder)
  // ==============================================================
  const regUserARes = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Alice Coder',
      email: 'alice@example.com',
      password: 'AlicePassword123!'
    }
  });

  assert.equal(regUserARes.status, 201, `User A registration should succeed: ${JSON.stringify(regUserARes.body)}`);
  const tokenA = regUserARes.body.data?.token || regUserARes.body.token;
  const userAId = regUserARes.body.data?.user?.id || regUserARes.body.user?.id;
  assert.ok(tokenA, 'User A should receive JWT token on registration');
  const authHeaderA = { Authorization: `Bearer ${tokenA}` };

  // Verify User A /api/auth/me
  const meARes = await request(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: authHeaderA
  });
  assert.equal(meARes.status, 200);
  assert.equal(meARes.body.data.user.email, 'alice@example.com');
  assert.equal(meARes.body.data.user.id, userAId);

  // ==============================================================
  // STEP 2: User A creates a question and completes a revision
  // ==============================================================
  const createQRes = await request(app, {
    method: 'POST',
    url: '/api/questions',
    headers: authHeaderA,
    body: {
      title: 'Two Sum',
      platform: 'LeetCode',
      problemNumber: '1',
      subjectId: 'sub_dsa',
      topic: 'Arrays',
      difficulty: 'Easy',
      statement: 'Given an array of integers nums and an integer target, return indices of two numbers that add up to target.',
      solution: 'function twoSum() {}',
      notes: 'Use hash map for O(n) lookup'
    }
  });

  assert.equal(createQRes.status, 201);
  const qAId = createQRes.body.data.id;
  assert.ok(qAId);

  // User A gets revisions
  const revARes = await request(app, {
    method: 'GET',
    url: '/api/revisions',
    headers: authHeaderA
  });
  assert.equal(revARes.status, 200);
  const revAList = Array.isArray(revARes.body.data) ? revARes.body.data : revARes.body.data.items;
  assert.equal(revAList.length, 5, 'User A should have 5 scheduled milestones');
  const revA1 = revAList[0];

  // User A completes milestone 1
  const completeARes = await request(app, {
    method: 'POST',
    url: `/api/revisions/${revA1.id}/complete`,
    headers: authHeaderA,
    body: {
      recallRating: 'easy',
      notes: 'Recalled hash map pattern immediately.'
    }
  });
  assert.equal(completeARes.status, 200);
  assert.equal(completeARes.body.data.status, 'completed');

  // Verify User A's dashboard stats reflect their question and revision
  const statsARes = await request(app, {
    method: 'GET',
    url: '/api/dashboard/stats',
    headers: authHeaderA
  });
  assert.equal(statsARes.status, 200);
  assert.equal(statsARes.body.data.totalQuestions, 1, 'User A should have 1 question');
  assert.equal(statsARes.body.data.completed, 1, 'User A should have 1 completed revision');
  assert.ok(statsARes.body.data.streak >= 1, 'User A streak should be active');

  // ==============================================================
  // STEP 3: Register and login User B (Bob Newbie) - Brand New User
  // ==============================================================
  const regUserBRes = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Bob Newbie',
      email: 'bob@example.com',
      password: 'BobPassword123!'
    }
  });

  assert.equal(regUserBRes.status, 201, `User B registration should succeed: ${JSON.stringify(regUserBRes.body)}`);
  const tokenB = regUserBRes.body.data?.token || regUserBRes.body.token;
  const userBId = regUserBRes.body.data?.user?.id || regUserBRes.body.user?.id;
  assert.ok(tokenB, 'User B should receive JWT token on registration');
  const authHeaderB = { Authorization: `Bearer ${tokenB}` };

  assert.notEqual(userAId, userBId, 'User A and User B must have distinct user IDs');

  // ==============================================================
  // STEP 4: Brand-New User B Dashboard Verification
  // Requirement:
  // - Solved-question count starts at zero.
  // - Revision streak starts at zero.
  // - Completed revisions start at zero.
  // - Questions and revision history are empty.
  // - Personal activity and analytics start empty.
  // - User settings use safe application defaults.
  // ==============================================================

  // A. Dashboard stats for User B must be strictly ZERO
  const statsBRes = await request(app, {
    method: 'GET',
    url: '/api/dashboard/stats',
    headers: authHeaderB
  });
  assert.equal(statsBRes.status, 200);
  assert.equal(statsBRes.body.data.totalQuestions, 0, 'New User B question count must start at 0');
  assert.equal(statsBRes.body.data.dueToday, 0, 'New User B due revisions must start at 0');
  assert.equal(statsBRes.body.data.overdue, 0, 'New User B overdue revisions must start at 0');
  assert.equal(statsBRes.body.data.completed, 0, 'New User B completed revisions must start at 0');
  assert.equal(statsBRes.body.data.streak, 0, 'New User B streak must start at 0');

  // B. Questions list for User B must be EMPTY
  const questionsBRes = await request(app, {
    method: 'GET',
    url: '/api/questions',
    headers: authHeaderB
  });
  assert.equal(questionsBRes.status, 200);
  assert.equal(questionsBRes.body.data.items.length, 0, 'New User B questions list must be empty');
  assert.equal(questionsBRes.body.data.pagination.total, 0);

  // C. Revisions for User B must be EMPTY
  const revisionsBRes = await request(app, {
    method: 'GET',
    url: '/api/revisions',
    headers: authHeaderB
  });
  assert.equal(revisionsBRes.status, 200);
  const revBList = Array.isArray(revisionsBRes.body.data) ? revisionsBRes.body.data : revisionsBRes.body.data?.items;
  assert.equal(revBList?.length, 0, 'New User B revisions list must be empty');

  const revisionsTodayBRes = await request(app, {
    method: 'GET',
    url: '/api/revisions/today',
    headers: authHeaderB
  });
  assert.equal(revisionsTodayBRes.status, 200);
  assert.equal(revisionsTodayBRes.body.data.length, 0, 'New User B revisions due today must be empty');

  // D. Activity feed for User B must be EMPTY
  const activityBRes = await request(app, {
    method: 'GET',
    url: '/api/dashboard/activity',
    headers: authHeaderB
  });
  assert.equal(activityBRes.status, 200);
  assert.equal(activityBRes.body.data.items.length, 0, 'New User B revision activity must be empty');

  // E. Notifications for User B must be EMPTY
  const notifBRes = await request(app, {
    method: 'GET',
    url: '/api/notifications',
    headers: authHeaderB
  });
  assert.equal(notifBRes.status, 200);
  assert.equal(notifBRes.body.data.items.length, 0, 'New User B notifications must be empty');

  // F. User settings for User B must have safe application defaults
  const settingsBRes = await request(app, {
    method: 'GET',
    url: '/api/settings',
    headers: authHeaderB
  });
  assert.equal(settingsBRes.status, 200);
  assert.equal(settingsBRes.body.data.theme, 'dark');
  assert.equal(settingsBRes.body.data.studyGoalQuestions, 3);
  assert.equal(settingsBRes.body.data.whatsAppNotifications, false);

  // ==============================================================
  // STEP 5: Cross-User Attack & Access Control Verification
  // User B cannot read, update, or delete User A's data
  // ==============================================================

  // A. User B cannot read User A's question
  const crossGetQ = await request(app, {
    method: 'GET',
    url: `/api/questions/${qAId}`,
    headers: authHeaderB
  });
  assert.equal(crossGetQ.status, 404, 'User B must receive 404 when querying User A question');

  // B. User B cannot update User A's question
  const crossUpdateQ = await request(app, {
    method: 'PUT',
    url: `/api/questions/${qAId}`,
    headers: authHeaderB,
    body: { title: 'Hacked by User B' }
  });
  assert.equal(crossUpdateQ.status, 404, 'User B must receive 404 when updating User A question');

  // C. User B cannot toggle bookmark on User A's question
  const crossBookmarkQ = await request(app, {
    method: 'PATCH',
    url: `/api/questions/${qAId}/bookmark`,
    headers: authHeaderB
  });
  assert.equal(crossBookmarkQ.status, 404, 'User B must receive 404 when toggling bookmark on User A question');

  // D. User B cannot delete User A's question
  const crossDeleteQ = await request(app, {
    method: 'DELETE',
    url: `/api/questions/${qAId}`,
    headers: authHeaderB
  });
  assert.equal(crossDeleteQ.status, 404, 'User B must receive 404 when attempting to delete User A question');

  // E. User B cannot complete User A's revision
  const crossCompleteRev = await request(app, {
    method: 'POST',
    url: `/api/revisions/${revA1.id}/complete`,
    headers: authHeaderB,
    body: { recallRating: 'difficult' }
  });
  assert.equal(crossCompleteRev.status, 404, 'User B must receive 404 when attempting to complete User A revision');

  // ==============================================================
  // STEP 6: Multi-Tenant Problem Number Uniqueness
  // User B can create the exact same problem number (LeetCode #1) without duplicate collision
  // ==============================================================
  const userBCreateSameProblemRes = await request(app, {
    method: 'POST',
    url: '/api/questions',
    headers: authHeaderB,
    body: {
      title: 'Two Sum (Bob Edition)',
      platform: 'LeetCode',
      problemNumber: '1',
      subjectId: 'sub_dsa',
      topic: 'Arrays',
      difficulty: 'Easy'
    }
  });

  assert.equal(userBCreateSameProblemRes.status, 201, 'User B should be able to create LeetCode #1 independently');
  const qBId = userBCreateSameProblemRes.body.data.id;
  assert.notEqual(qAId, qBId, 'Question IDs must be different');

  // Now User B's dashboard shows exactly 1 question
  const statsBAfterRes = await request(app, {
    method: 'GET',
    url: '/api/dashboard/stats',
    headers: authHeaderB
  });
  assert.equal(statsBAfterRes.body.data.totalQuestions, 1, "User B's count updates to 1 only after adding their own question");

  // ==============================================================
  // STEP 7: Verify User A's data was completely untouched
  // ==============================================================
  const checkQAOriginal = await request(app, {
    method: 'GET',
    url: `/api/questions/${qAId}`,
    headers: authHeaderA
  });
  assert.equal(checkQAOriginal.status, 200);
  assert.equal(checkQAOriginal.body.data.title, 'Two Sum', "User A's question title was not overwritten");

  const statsACheck = await request(app, {
    method: 'GET',
    url: '/api/dashboard/stats',
    headers: authHeaderA
  });
  assert.equal(statsACheck.body.data.totalQuestions, 1, "User A's question count remains 1");
  assert.equal(statsACheck.body.data.completed, 1, "User A's completed revisions remain 1");

  // ==============================================================
  // STEP 8: Switching Accounts in the Same Client Flow
  // ==============================================================
  // 1. User logs in as User B
  const loginB = await request(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'bob@example.com', password: 'BobPassword123!' }
  });
  assert.equal(loginB.status, 200);
  const switchedTokenB = loginB.body.data.token;
  const switchedStatsB = await request(app, {
    method: 'GET',
    url: '/api/dashboard/stats',
    headers: { Authorization: `Bearer ${switchedTokenB}` }
  });
  assert.equal(switchedStatsB.status, 200);
  assert.equal(switchedStatsB.body.data.totalQuestions, 1);

  // 2. User logs out and logs in as User A
  const logoutRes = await request(app, { method: 'POST', url: '/api/auth/logout' });
  assert.equal(logoutRes.status, 200);

  const loginA = await request(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'alice@example.com', password: 'AlicePassword123!' }
  });
  assert.equal(loginA.status, 200);
  const switchedTokenA = loginA.body.data.token;
  const switchedStatsA = await request(app, {
    method: 'GET',
    url: '/api/dashboard/stats',
    headers: { Authorization: `Bearer ${switchedTokenA}` }
  });
  assert.equal(switchedStatsA.status, 200);
  assert.equal(switchedStatsA.body.data.totalQuestions, 1);
  assert.equal(switchedStatsA.body.data.completed, 1);

  // ==============================================================
  // STEP 9: Unauthenticated Requests Must Not Access Private Data
  // ==============================================================
  // An invalid or forged token must be rejected with 401
  const forgedTokenRes = await request(app, {
    method: 'GET',
    url: '/api/dashboard/stats',
    headers: { Authorization: 'Bearer forged.invalid.jwt_token_signature' }
  });
  assert.equal(forgedTokenRes.status, 401, 'Invalid session token must be rejected with 401');

  // Verify production unauthenticated rejection
  const origEnv = config.nodeEnv;
  try {
    config.nodeEnv = 'production';
    const noTokenRes = await request(app, {
      method: 'GET',
      url: '/api/dashboard/stats'
    });
    assert.equal(noTokenRes.status, 401, 'Unauthenticated requests must be rejected with 401');

    const noTokenQuestions = await request(app, {
      method: 'GET',
      url: '/api/questions'
    });
    assert.equal(noTokenQuestions.status, 401, 'Unauthenticated requests to /api/questions must be rejected with 401');

    const noTokenRevisions = await request(app, {
      method: 'GET',
      url: '/api/revisions'
    });
    assert.equal(noTokenRevisions.status, 401, 'Unauthenticated requests to /api/revisions must be rejected with 401');
  } finally {
    config.nodeEnv = origEnv;
  }
});
