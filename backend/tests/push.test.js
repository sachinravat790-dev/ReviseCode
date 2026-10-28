/**
 * Web Push Notification Test Suite (tests/push.test.js)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { setupTestDatabase, request } from './test-helper.js';
import { pushService } from '../src/services/push.service.js';
import { supabaseRepository } from '../src/repositories/supabase.repository.js';
import { getTodayDateString } from '../src/utils/dates.js';

test('GET /api/push/public-key returns configured VAPID public key', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'GET',
    url: '/api/push/public-key'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.publicKey);
  assert.equal(typeof res.body.data.publicKey, 'string');
});

test('POST /api/push/subscribe rejects invalid subscription payload with 400', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'POST',
    url: '/api/push/subscribe',
    body: { endpoint: '' }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/push/subscribe saves subscription and makes it retrievable', async () => {
  setupTestDatabase();

  const mockSub = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
    keys: {
      p256dh: 'mock-p256dh-key-xyz',
      auth: 'mock-auth-secret-abc'
    }
  };

  const res = await request(app, {
    method: 'POST',
    url: '/api/push/subscribe',
    body: mockSub
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const savedSubs = await supabaseRepository.getPushSubscriptions();
  assert.ok(savedSubs.some(s => s.endpoint === mockSub.endpoint));
});

test('pushService.processMilestonePushReminders runs cleanly across revisions', async () => {
  setupTestDatabase();

  const result = await pushService.processMilestonePushReminders(getTodayDateString());
  assert.equal(typeof result.candidates, 'number');
  assert.equal(typeof result.sentCount, 'number');
});
