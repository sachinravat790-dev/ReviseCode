import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request } from './test-helper.js';
import { updateGeminiApiKey } from '../src/config/env.js';

test('GET /api/assistant/status returns configuration and mode metadata', async () => {
  // Reset key to empty for clean baseline
  updateGeminiApiKey('');
  const res = await request(app, {
    method: 'GET',
    url: '/api/assistant/status'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.configured, false);
  assert.equal(res.body.data.provider, 'Google Gemini');
  assert.equal(res.body.data.mode, 'grounded_workspace');
  assert.equal(res.body.data.activeModel, 'Grounded Workspace & Technical Engine');
  assert.equal(res.body.data.apiKeyMasked, '');
});

test('POST /api/assistant/test reports unconfigured when key is empty', async () => {
  updateGeminiApiKey('');
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/test',
    body: {}
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.success, false);
  assert.equal(res.body.data.configured, false);
  assert.match(res.body.data.message, /GEMINI_API_KEY is not configured/i);
});

test('POST /api/assistant/test catches error when testing invalid API key', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/test',
    body: {
      apiKey: 'invalid_dummy_key_12345'
    }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.success, false);
  assert.equal(res.body.data.configured, true);
  assert.match(res.body.data.message, /Gemini API connection test failed/i);
});

test('POST /api/assistant/configure updates in-memory key and masks sensitive token', async () => {
  const testKey = 'AIzaSyA_TEST_KEY_FOR_REVISECODE_TESTING_9988';
  const configRes = await request(app, {
    method: 'POST',
    url: '/api/assistant/configure',
    body: {
      apiKey: testKey,
      persist: false // In test, do not overwrite filesystem .env
    }
  });

  assert.equal(configRes.status, 200);
  assert.equal(configRes.body.data.configured, true);

  // Verify status reflects configuration and masks key
  const statusRes = await request(app, {
    method: 'GET',
    url: '/api/assistant/status'
  });
  assert.equal(statusRes.body.data.configured, true);
  assert.equal(statusRes.body.data.mode, 'gemini_llm');
  assert.equal(statusRes.body.data.activeModel, 'gemini-3-flash-preview');
  assert.equal(statusRes.body.data.apiKeyMasked.startsWith('AIzaSy'), true);
  assert.equal(statusRes.body.data.apiKeyMasked.endsWith('9988'), true);
  assert.equal(statusRes.body.data.apiKeyMasked.includes('****'), true);
  assert.notEqual(statusRes.body.data.apiKeyMasked, testKey);

  // Capabilities also reflects Gemini active
  const capRes = await request(app, {
    method: 'GET',
    url: '/api/assistant/capabilities'
  });
  assert.equal(capRes.body.data.aiProviderConnected, true);
  assert.equal(capRes.body.data.mode, 'gemini_llm');

  // Reset back to empty
  updateGeminiApiKey('');
});

test('DELETE /api/assistant/configure resets key to Grounded Workspace Mode', async () => {
  updateGeminiApiKey('temporary_key_to_delete');
  const delRes = await request(app, {
    method: 'DELETE',
    url: '/api/assistant/configure'
  });

  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.data.configured, false);

  const statusRes = await request(app, {
    method: 'GET',
    url: '/api/assistant/status'
  });
  assert.equal(statusRes.body.data.configured, false);
  assert.equal(statusRes.body.data.mode, 'grounded_workspace');
});
