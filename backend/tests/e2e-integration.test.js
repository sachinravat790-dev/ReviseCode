import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase, getTestDatabase } from './test-helper.js';
import { addDays, getTodayDateString } from '../src/utils/dates.js';

beforeEach(() => {
  setupTestDatabase();
});

// ====================================================================
// 1. Subject Lifecycle: Create, Retrieve, and Prevent Duplicates
// ====================================================================

test('E2E: Subject creation and retrieval lifecycle', async () => {
  // 1. Create a subject
  const createRes = await request(app, {
    method: 'POST',
    url: '/api/subjects',
    body: {
      name: 'System Design',
      description: 'Distributed architectures, caching, load balancers, rate limiters',
      color: '#10b981',
      icon: 'server',
      topics: ['Consistent Hashing', 'Rate Limiting', 'Message Queues', 'CAP Theorem']
    }
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.success, true);
  const createdSubject = createRes.body.data;
  assert.ok(createdSubject.id);
  assert.equal(createdSubject.name, 'System Design');
  assert.equal(createdSubject.color, '#10b981');
  assert.equal(createdSubject.icon, 'server');
  assert.deepEqual(createdSubject.topics, ['Consistent Hashing', 'Rate Limiting', 'Message Queues', 'CAP Theorem']);

  // 2. Retrieve by ID
  const getRes = await request(app, {
    method: 'GET',
    url: `/api/subjects/${createdSubject.id}`
  });

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.data.id, createdSubject.id);
  assert.equal(getRes.body.data.name, 'System Design');
  assert.equal(getRes.body.data.questionCount, 0);

  // 3. Attempt duplicate subject creation (case-insensitive) -> should reject with 409
  const dupRes = await request(app, {
    method: 'POST',
    url: '/api/subjects',
    body: {
      name: 'system design',
      description: 'Duplicate name test'
    }
  });

  assert.equal(dupRes.status, 409);
  assert.equal(dupRes.body.success, false);
  assert.match(dupRes.body.message, /already exists/i);
});

// ====================================================================
// 2. Question Lifecycle: Create, Retrieve, Update, and Cleanly Delete
// ====================================================================

test('E2E: Temporary question CRUD lifecycle with revision cascading', async () => {
  // 1. Create a temporary test question
  const tempPayload = {
    title: 'LRU Cache Integration Test',
    platform: 'LeetCode',
    problemNumber: '146',
    problemUrl: 'https://leetcode.com/problems/lru-cache/',
    subjectId: 'sub_dsa',
    topic: 'Design',
    difficulty: 'Medium',
    dateSolved: '2026-03-24',
    approach: 'Hash map paired with doubly linked list for O(1) get and put.',
    notes: 'Maintain dummy head and tail nodes to simplify edge insertions and evictions.',
    code: 'class LRUCache { /* implementation */ }',
    programmingLanguage: 'javascript',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(capacity)',
    tags: ['Hash Table', 'Linked List', 'Design']
  };

  const createRes = await request(app, {
    method: 'POST',
    url: '/api/questions',
    body: tempPayload
  });

  assert.equal(createRes.status, 201);
  const tempQuestionId = createRes.body.data.id;
  assert.ok(tempQuestionId);
  assert.equal(createRes.body.data.title, 'LRU Cache Integration Test');
  assert.equal(createRes.body.data.problemNumber, 146);

  // 2. Verify 5 revision milestones were automatically scheduled
  const db = getTestDatabase();
  const scheduledMilestones = db.revisions.filter(r => r.question_id === tempQuestionId);
  assert.equal(scheduledMilestones.length, 5);
  const days = scheduledMilestones.map(m => m.milestone_day).sort((a, b) => a - b);
  assert.deepEqual(days, [3, 7, 12, 20, 30]);

  // 3. Retrieve the question with its populated milestones
  const getRes = await request(app, {
    method: 'GET',
    url: `/api/questions/${tempQuestionId}`
  });

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.data.id, tempQuestionId);
  assert.equal(getRes.body.data.milestones.length, 5);

  // 4. Update the question details
  const updateRes = await request(app, {
    method: 'PUT',
    url: `/api/questions/${tempQuestionId}`,
    body: {
      notes: 'Updated notes: check doubly linked list pointer updates on cache hit.'
    }
  });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.notes, 'Updated notes: check doubly linked list pointer updates on cache hit.');

  // 5. Toggle bookmark
  const bookmarkRes1 = await request(app, {
    method: 'PATCH',
    url: `/api/questions/${tempQuestionId}/bookmark`
  });
  assert.equal(bookmarkRes1.status, 200);
  assert.equal(bookmarkRes1.body.data.bookmarked, true);

  // 6. Delete ONLY this temporary record
  const deleteRes = await request(app, {
    method: 'DELETE',
    url: `/api/questions/${tempQuestionId}`
  });

  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.body.success, true);

  // 7. Verify question is completely gone (404)
  const verifyDeletedRes = await request(app, {
    method: 'GET',
    url: `/api/questions/${tempQuestionId}`
  });
  assert.equal(verifyDeletedRes.status, 404);

  // 8. Verify all 5 scheduled milestones were cascaded and removed
  const remainingMilestones = db.revisions.filter(r => r.question_id === tempQuestionId);
  assert.equal(remainingMilestones.length, 0, 'Cascaded milestones must be 0 after question deletion');
});

// ====================================================================
// 3. Revision Lifecycle: Scheduling, Due Calculation, and Completion
// ====================================================================

test('E2E: Revision scheduling, active recall completion, and session history', async () => {
  const today = getTodayDateString();
  const threeDaysAgo = addDays(today, -3);

  // 1. Create a question solved 3 days ago so milestone Day 3 is due today
  const createQRes = await request(app, {
    method: 'POST',
    url: '/api/questions',
    body: {
      title: 'Active Recall Due Question',
      platform: 'LeetCode',
      problemNumber: '999',
      subjectId: 'sub_dsa',
      topic: 'Algorithms',
      difficulty: 'Easy',
      dateSolved: threeDaysAgo
    }
  });

  assert.equal(createQRes.status, 201);
  const qId = createQRes.body.data.id;

  // 2. Fetch revisions due today
  const todayRes = await request(app, {
    method: 'GET',
    url: '/api/revisions/today'
  });

  assert.equal(todayRes.status, 200);
  const dueItem = todayRes.body.data.find(r => r.questionId === qId && r.milestoneDay === 3);
  assert.ok(dueItem, 'Day 3 milestone must be due today');
  assert.equal(dueItem.status, 'due');

  // 3. Complete the revision milestone with recall rating and review notes
  const completeRes = await request(app, {
    method: 'POST',
    url: `/api/revisions/${dueItem.id}/complete`,
    body: {
      recallRating: 'easy',
      notes: 'Recalled full solution with clean edge case handling.'
    }
  });

  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.data.status, 'completed');
  assert.equal(completeRes.body.data.completedAt, today);
  assert.equal(completeRes.body.data.recallRating, 'easy');

  // 4. Verify review session is recorded in revision_sessions
  const activityRes = await request(app, {
    method: 'GET',
    url: '/api/dashboard/activity'
  });

  assert.equal(activityRes.status, 200);
  const recordedSession = activityRes.body.data.items.find(s => s.questionId === qId);
  assert.ok(recordedSession, 'Session must be logged in recent activity');
  assert.equal(recordedSession.recallRating, 'easy');
  assert.equal(recordedSession.milestoneDay, 3);

  // 5. Verify completion notification was created
  const notifRes = await request(app, {
    method: 'GET',
    url: '/api/notifications'
  });

  assert.equal(notifRes.status, 200);
  const completionNotif = notifRes.body.data.items.find(n => n.questionId === qId && n.type === 'revision_completed');
  assert.ok(completionNotif, 'Revision completed notification must be emitted');

  // Clean up temporary question
  await request(app, { method: 'DELETE', url: `/api/questions/${qId}` });
});

// ====================================================================
// 4. Settings and Analytics Endpoints
// ====================================================================

test('E2E: Settings persistence and analytics consistency', async () => {
  // 1. Update settings
  const updateSettingsRes = await request(app, {
    method: 'PUT',
    url: '/api/settings',
    body: {
      theme: 'dark',
      studyGoalQuestions: 4,
      customIntervalsEnabled: true,
      customIntervalDays: [45, 60],
      reminderTime: '08:30',
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00'
    }
  });

  assert.equal(updateSettingsRes.status, 200);
  assert.equal(updateSettingsRes.body.data.studyGoalQuestions, 4);
  assert.equal(updateSettingsRes.body.data.reminderTime, '08:30');

  // 2. Retrieve settings to verify persistence
  const getSettingsRes = await request(app, {
    method: 'GET',
    url: '/api/settings'
  });

  assert.equal(getSettingsRes.status, 200);
  assert.equal(getSettingsRes.body.data.studyGoalQuestions, 4);
  assert.equal(getSettingsRes.body.data.reminderTime, '08:30');
  assert.equal(getSettingsRes.body.data.quietHoursStart, '23:00');

  // 3. Verify dashboard statistics endpoint
  const statsRes = await request(app, {
    method: 'GET',
    url: '/api/dashboard/stats'
  });

  assert.equal(statsRes.status, 200);
  assert.ok(typeof statsRes.body.data.totalQuestions === 'number');
  assert.ok(typeof statsRes.body.data.completionRate === 'number');
});

// ====================================================================
// 5. Error Handling and Defensive Constraints
// ====================================================================

test('E2E: Structured error handling across validation and constraints', async () => {
  // 1. Missing required fields on question creation
  const badQuestionRes = await request(app, {
    method: 'POST',
    url: '/api/questions',
    body: { topic: 'Arrays' } // missing title and platform
  });

  assert.equal(badQuestionRes.status, 400);
  assert.equal(badQuestionRes.body.success, false);
  assert.ok(Array.isArray(badQuestionRes.body.errors));

  // 2. Rescheduling with malformed date format
  const badDateRes = await request(app, {
    method: 'POST',
    url: '/api/revisions/some_id/reschedule',
    body: { newDueDate: 'invalid-date' }
  });

  assert.equal(badDateRes.status, 400);
  assert.equal(badDateRes.body.success, false);

  // 3. Delete subject blocked when associated questions exist
  const protectedSubjectRes = await request(app, {
    method: 'DELETE',
    url: '/api/subjects/sub_dsa'
  });

  assert.equal(protectedSubjectRes.status, 400);
  assert.equal(protectedSubjectRes.body.success, false);
  assert.match(protectedSubjectRes.body.message, /Cannot delete subject/);
});
