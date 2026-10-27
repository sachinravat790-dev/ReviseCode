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

test('POST /api/questions with authenticated user token associates user_id with question and scheduled milestones', async () => {
  const { authService } = await import('../src/services/auth.service.js');
  const user = { id: 'usr_rls_test_1', email: 'rls_user@example.com', name: 'RLS User' };
  const token = authService.generateToken(user);

  const res = await request(app, {
    method: 'POST',
    url: '/api/questions',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'Trapping Rain Water',
      platform: 'LeetCode',
      problemNumber: '42',
      difficulty: 'Hard',
      subjectId: 'sub_dsa'
    }
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user_id, 'usr_rls_test_1');

  // Verify scheduled milestones also inherit user_id
  const db = getTestDatabase();
  const userMilestones = db.revisions.filter(r => r.question_id === res.body.data.id);
  assert.equal(userMilestones.length, 5);
  userMilestones.forEach(m => {
    assert.equal(m.user_id, 'usr_rls_test_1');
  });
});

test('POST /api/questions rejects unauthenticated requests when strict authentication is enforced', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/questions',
    headers: { 'x-strict-auth': 'true' },
    body: {
      title: 'Subsets',
      platform: 'LeetCode',
      problemNumber: '78',
      difficulty: 'Medium'
    }
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('Cross-user question protection: User B cannot read, update, or delete User A question', async () => {
  const { authService } = await import('../src/services/auth.service.js');
  const userA = { id: 'user_owner_a', email: 'owner_a@example.com', name: 'Owner A' };
  const userB = { id: 'user_attacker_b', email: 'attacker_b@example.com', name: 'User B' };
  const tokenA = authService.generateToken(userA);
  const tokenB = authService.generateToken(userB);

  // User A creates a question
  const createRes = await request(app, {
    method: 'POST',
    url: '/api/questions',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: {
      title: 'Valid Palindrome',
      platform: 'LeetCode',
      problemNumber: '125',
      difficulty: 'Easy'
    }
  });
  assert.equal(createRes.status, 201);
  const qId = createRes.body.data.id;

  // User B attempts to read User A question -> 404
  const getRes = await request(app, {
    method: 'GET',
    url: `/api/questions/${qId}`,
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.equal(getRes.status, 404);

  // User B attempts to update User A question -> 404
  const putRes = await request(app, {
    method: 'PUT',
    url: `/api/questions/${qId}`,
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { notes: 'Malicious modification attempt' }
  });
  assert.equal(putRes.status, 404);

  // User B attempts to delete User A question -> 404
  const delRes = await request(app, {
    method: 'DELETE',
    url: `/api/questions/${qId}`,
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.equal(delRes.status, 404);

  // User A can still retrieve their own question
  const verifyRes = await request(app, {
    method: 'GET',
    url: `/api/questions/${qId}`,
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.data.title, 'Valid Palindrome');
});

test('Supabase Configuration: getSupabaseKeyRole detects anon vs service_role tokens and flags anon key', async () => {
  const { getSupabaseKeyRole, validateSupabaseConfig, config } = await import('../src/config/env.js');

  // Mock JWTs
  const makeJwt = role => {
    const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url');
    return `${h}.${p}.dummy_signature`;
  };

  const anonToken = makeJwt('anon');
  const serviceRoleToken = makeJwt('service_role');

  assert.equal(getSupabaseKeyRole(anonToken), 'anon');
  assert.equal(getSupabaseKeyRole(serviceRoleToken), 'service_role');
  assert.equal(getSupabaseKeyRole('not_a_jwt'), null);

  // Test validation error when anon key is provided as service role key
  const prevKey = config.supabaseServiceRoleKey;
  const prevUrl = config.supabaseUrl;
  try {
    config.supabaseUrl = 'https://mock-proj.supabase.co';
    config.supabaseServiceRoleKey = anonToken;
    const result = validateSupabaseConfig();
    assert.equal(result.valid, false);
    assert.equal(result.isAnonKeySupplied, true);
    assert.match(result.message, /SUPABASE_SERVICE_ROLE_KEY is set to the Supabase ANON/);
  } finally {
    config.supabaseServiceRoleKey = prevKey;
    config.supabaseUrl = prevUrl;
  }
});

test('User isolation on revisions: User B cannot access or complete User A scheduled revision milestones', async () => {
  const { authService } = await import('../src/services/auth.service.js');
  const userA = { id: 'usr_owner_rev_a', email: 'owner_rev@example.com', name: 'Owner Rev' };
  const userB = { id: 'usr_intruder_rev_b', email: 'intruder_rev@example.com', name: 'Intruder Rev' };
  const tokenA = authService.generateToken(userA);
  const tokenB = authService.generateToken(userB);

  // User A creates a question (which creates 5 milestones)
  const createRes = await request(app, {
    method: 'POST',
    url: '/api/questions',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: {
      title: 'Course Schedule',
      platform: 'LeetCode',
      problemNumber: '207',
      difficulty: 'Medium'
    }
  });
  assert.equal(createRes.status, 201);
  const questionId = createRes.body.data.id;

  const db = getTestDatabase();
  const aMilestones = db.revisions.filter(r => r.question_id === questionId);
  assert.equal(aMilestones.length, 5);
  const milestoneToAttack = aMilestones[0];

  // User B lists revisions -> User A's milestone must NOT appear in User B's list
  const listRes = await request(app, {
    method: 'GET',
    url: '/api/revisions',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.equal(listRes.status, 200);
  const bVisibleIds = listRes.body.data.map(m => m.id);
  assert.ok(!bVisibleIds.includes(milestoneToAttack.id));

  // User B attempts to complete User A's milestone -> must be rejected with 404
  const completeRes = await request(app, {
    method: 'POST',
    url: `/api/revisions/${milestoneToAttack.id}/complete`,
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { recallRating: 'easy', notes: 'Unauthorized completion attempt' }
  });
  assert.equal(completeRes.status, 404);

  // User A successfully completes their own milestone
  const ownerCompleteRes = await request(app, {
    method: 'POST',
    url: `/api/revisions/${milestoneToAttack.id}/complete`,
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { recallRating: 'easy', notes: 'Completed by real owner' }
  });
  assert.equal(ownerCompleteRes.status, 200);
  assert.equal(ownerCompleteRes.body.data.status, 'completed');
});

test('Supabase Configuration: validateSupabaseConfig safely reports missing URL or key without leaking secrets', async () => {
  const { validateSupabaseConfig, config } = await import('../src/config/env.js');

  const prevKey = config.supabaseServiceRoleKey;
  const prevUrl = config.supabaseUrl;

  try {
    // Missing URL
    config.supabaseUrl = '';
    config.supabaseServiceRoleKey = 'some_key';
    const missingUrlRes = validateSupabaseConfig();
    assert.equal(missingUrlRes.valid, false);
    assert.ok(missingUrlRes.missing.includes('SUPABASE_URL'));

    // Missing Key
    config.supabaseUrl = 'https://valid-url.supabase.co';
    config.supabaseServiceRoleKey = '';
    const missingKeyRes = validateSupabaseConfig();
    assert.equal(missingKeyRes.valid, false);
    assert.ok(missingKeyRes.missing.includes('SUPABASE_SERVICE_ROLE_KEY'));

    // Invalid URL protocol
    config.supabaseUrl = 'ftp://invalid-url.supabase.co';
    config.supabaseServiceRoleKey = 'some_key';
    const invalidUrlRes = validateSupabaseConfig();
    assert.equal(invalidUrlRes.valid, false);
    assert.match(invalidUrlRes.message, /valid HTTP\/HTTPS URL/);
  } finally {
    config.supabaseServiceRoleKey = prevKey;
    config.supabaseUrl = prevUrl;
  }
});
