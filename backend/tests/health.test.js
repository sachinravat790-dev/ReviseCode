import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase } from './test-helper.js';

beforeEach(() => {
  setupTestDatabase();
});

test('GET /api/health returns 200 and healthy status', async () => {
  const res = await request(app, { method: 'GET', url: '/api/health' });
  assert.equal(res.status, 200);

  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, 'ok');
  assert.ok(typeof res.body.data.uptime === 'number');
  assert.equal(res.body.data.version, '1.0.0');
  assert.equal(res.body.data.storageEngine, 'Supabase PostgreSQL');
});

test('GET /api/nonexistent-route returns 404 and structured JSON error', async () => {
  const res = await request(app, { method: 'GET', url: '/api/nonexistent-route' });
  assert.equal(res.status, 404);

  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Route not found/i);
});

test('POST with malformed JSON body returns 400 with clean error message', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/questions',
    headers: { 'content-type': 'application/json' },
    body: '{"title": "Broken JSON without closing bracket'
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /malformed json/i);
});

test('CORS headers allow requests from frontend origin', async () => {
  const res = await request(app, {
    method: 'GET',
    url: '/api/health',
    headers: { origin: 'http://localhost:3000' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
});
