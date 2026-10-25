import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase } from './test-helper.js';

beforeEach(() => {
  setupTestDatabase();
});

test('GET /api/subjects returns subjects with questionCount and pendingCount', async () => {
  const res = await request(app, { method: 'GET', url: '/api/subjects' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 5);

  const dsa = res.body.data.find(s => s.name === 'DSA');
  assert.ok(dsa);
  assert.ok(typeof dsa.questionCount === 'number');
  assert.ok(typeof dsa.pendingCount === 'number');
  assert.ok(dsa.questionCount >= 1);
});

test('GET /api/subjects/:id returns specific subject by ID', async () => {
  const res = await request(app, { method: 'GET', url: '/api/subjects/sub_dsa' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, 'DSA');
});

test('GET /api/subjects/:id returns 404 for unknown subject', async () => {
  const res = await request(app, { method: 'GET', url: '/api/subjects/nonexistent_sub' });
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('POST /api/subjects creates a new subject successfully', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/subjects',
    body: {
      name: 'Operating Systems',
      description: 'Processes, Threads, Memory Management, CPU Scheduling',
      color: '#0ea5e9',
      icon: 'cpu',
      topics: ['Processes', 'Threads', 'Deadlocks', 'Paging']
    }
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.name, 'Operating Systems');
  assert.ok(res.body.data.id);
});

test('POST /api/subjects rejects missing name with 400', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/subjects',
    body: {
      description: 'No name provided'
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('PUT /api/subjects/:id updates existing subject', async () => {
  const res = await request(app, {
    method: 'PUT',
    url: '/api/subjects/sub_dsa',
    body: {
      description: 'Updated Data Structures, Algorithms & Advanced Graph Patterns'
    }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.description, 'Updated Data Structures, Algorithms & Advanced Graph Patterns');
});

test('DELETE /api/subjects/:id protects against deleting subject with assigned questions', async () => {
  // sub_dsa has seed questions assigned
  const res = await request(app, {
    method: 'DELETE',
    url: '/api/subjects/sub_dsa'
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Cannot delete subject/i);
});

test('DELETE /api/subjects/:id deletes an empty subject cleanly', async () => {
  // First create an empty subject
  const created = await request(app, {
    method: 'POST',
    url: '/api/subjects',
    body: { name: 'Temporary Subject', description: 'Will be deleted' }
  });
  const subId = created.body.data.id;

  const res = await request(app, {
    method: 'DELETE',
    url: `/api/subjects/${subId}`
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  // Check it is gone
  const getRes = await request(app, { method: 'GET', url: `/api/subjects/${subId}` });
  assert.equal(getRes.status, 404);
});
