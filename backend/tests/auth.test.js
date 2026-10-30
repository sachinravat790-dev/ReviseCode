import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase } from './test-helper.js';
import { authService } from '../src/services/auth.service.js';

test('POST /api/auth/register creates a new user and returns 201 with JWT', async () => {
  setupTestDatabase();
  authService.resetTestUsers();

  const res = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'John Doe',
      email: 'john@example.com',
      password: 'SecurePassword123!'
    }
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.user);
  assert.equal(res.body.data.user.email, 'john@example.com');
  assert.equal(res.body.data.user.name, 'John Doe');
  assert.ok(res.body.data.token);
  assert.equal(typeof res.body.data.token, 'string');
});

test('POST /api/auth/register rejects missing fullName with 400', async () => {
  setupTestDatabase();
  const res = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      email: 'missingname@example.com',
      password: 'SecurePassword123!'
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/auth/register rejects invalid email format with 400', async () => {
  setupTestDatabase();
  const res = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Test User',
      email: 'not-an-email',
      password: 'SecurePassword123!'
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/auth/register rejects short password (<6 chars) with 400', async () => {
  setupTestDatabase();
  const res = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Test User',
      email: 'shortpass@example.com',
      password: '123'
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('POST /api/auth/register rejects duplicate email with 409 Conflict', async () => {
  setupTestDatabase();
  authService.resetTestUsers();

  const firstRes = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Primary User',
      email: 'duplicate@example.com',
      password: 'SecurePassword123!'
    }
  });
  assert.equal(firstRes.status, 201);

  const secondRes = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Clone User',
      email: 'duplicate@example.com',
      password: 'AnotherPassword456!'
    }
  });

  assert.equal(secondRes.status, 409);
  assert.equal(secondRes.body.success, false);
  assert.match(secondRes.body.message, /already registered/i);
});

test('POST /api/auth/login signs in with valid credentials and returns 200 with JWT', async () => {
  setupTestDatabase();
  authService.resetTestUsers();

  await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Bob Smith',
      email: 'bob@example.com',
      password: 'BobSecretPassword99'
    }
  });

  const loginRes = await request(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: 'bob@example.com',
      password: 'BobSecretPassword99'
    }
  });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.success, true);
  assert.equal(loginRes.body.data.user.email, 'bob@example.com');
  assert.ok(loginRes.body.data.token);
});

test('POST /api/auth/login rejects wrong password with 401', async () => {
  setupTestDatabase();
  authService.resetTestUsers();

  await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Bob Smith',
      email: 'bob@example.com',
      password: 'CorrectPassword123'
    }
  });

  const badPassRes = await request(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: 'bob@example.com',
      password: 'WrongPassword456'
    }
  });

  assert.equal(badPassRes.status, 401);
  assert.equal(badPassRes.body.success, false);
});

test('POST /api/auth/login rejects unknown email with 401', async () => {
  setupTestDatabase();
  authService.resetTestUsers();

  const unknownRes = await request(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: 'doesnotexist@example.com',
      password: 'SomePassword123'
    }
  });

  assert.equal(unknownRes.status, 401);
  assert.equal(unknownRes.body.success, false);
});

test('GET /api/auth/me returns current user identity with valid token', async () => {
  setupTestDatabase();
  authService.resetTestUsers();

  const regRes = await request(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Carol Danvers',
      email: 'carol@example.com',
      password: 'CaptainMarvelPass123'
    }
  });

  const token = regRes.body.data.token;

  const meRes = await request(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.data.user.email, 'carol@example.com');
  assert.equal(meRes.body.data.user.name, 'Carol Danvers');
});

test('GET /api/auth/me rejects missing token with 401', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'GET',
    url: '/api/auth/me'
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('GET /api/auth/me rejects invalid token with 401', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { Authorization: 'Bearer totally_invalid_token_123' }
  });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('POST /api/auth/logout succeeds with 200', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/auth/logout'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('POST /api/auth/reset-password dispatches reset instructions', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'POST',
    url: '/api/auth/reset-password',
    body: { email: 'reset_user@example.com' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.message);
});

test('POST /api/auth/reset-password rejects invalid email format with 400', async () => {
  setupTestDatabase();

  const res = await request(app, {
    method: 'POST',
    url: '/api/auth/reset-password',
    body: { email: 'invalid-email-string' }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('authService.verifyToken verifies unexpired native Supabase JWT token', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'supabase-user-12345',
    email: 'sachinravat790@gmail.com',
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    user_metadata: {
      name: 'Sachin Kumar',
      full_name: 'Sachin Kumar'
    }
  })).toString('base64url');
  const fakeSig = 'mock_signature_part';
  const supabaseToken = `${header}.${payload}.${fakeSig}`;

  const verified = await authService.verifyToken(supabaseToken);
  assert.ok(verified);
  assert.equal(verified.id, 'supabase-user-12345');
  assert.equal(verified.email, 'sachinravat790@gmail.com');
  assert.equal(verified.name, 'Sachin Kumar');
});

test('POST /api/auth/exchange-token exchanges Supabase token for internal compact JWT', async () => {
  setupTestDatabase();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'oauth-user-7788',
    email: 'sachinravat790@gmail.com',
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    user_metadata: {
      name: 'Sachin Kumar',
      full_name: 'Sachin Kumar'
    }
  })).toString('base64url');
  const supabaseToken = `${header}.${payload}.sig`;

  const res = await request(app, {
    method: 'POST',
    url: '/api/auth/exchange-token',
    body: { accessToken: supabaseToken }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, 'sachinravat790@gmail.com');
  assert.ok(res.body.data.token);
  assert.ok(res.body.data.token.length < 500);
});
