import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createMockSupabaseClient } from './mocks/supabase.mock.js';
import { setSupabaseClient } from '../src/config/supabase.js';

let currentMockClient = null;

/**
 * Initializes a fresh in-memory Supabase mock client before each test.
 */
export function setupTestDatabase() {
  currentMockClient = createMockSupabaseClient();
  setSupabaseClient(currentMockClient);
  return currentMockClient;
}

export function getTestDatabase() {
  return currentMockClient ? currentMockClient._db : null;
}

/**
 * Lightweight in-memory request dispatcher for Express applications.
 * Executes full Express middleware, routing, body parsing, and error pipelines
 * without requiring external network socket permissions.
 */
export function request(app, { method = 'GET', url = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve) => {
    const payload = body !== null && body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const req = Readable.from(payload !== null ? [Buffer.from(payload)] : []);
    
    req.method = method.toUpperCase();
    req.url = url;
    req.originalUrl = url;
    req.headers = {};
    
    for (const [k, v] of Object.entries(headers)) {
      req.headers[k.toLowerCase()] = v;
    }
    
    if (payload !== null) {
      if (!req.headers['content-type']) {
        req.headers['content-type'] = 'application/json';
      }
      req.headers['content-length'] = String(Buffer.byteLength(payload));
    }

    let status = 200;
    const resHeaders = {};
    let responseBody = '';

    const res = new EventEmitter();
    res.statusCode = 200;
    res.setHeader = (k, v) => {
      resHeaders[k.toLowerCase()] = v;
    };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.get = res.getHeader;
    res.status = (code) => {
      status = code;
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      resHeaders['content-type'] = 'application/json';
      responseBody = JSON.stringify(data);
      res.end(responseBody);
    };
    res.send = (data) => {
      responseBody = typeof data === 'string' ? data : JSON.stringify(data);
      res.end(responseBody);
    };
    res.end = (chunk) => {
      if (chunk && !responseBody) {
        responseBody = chunk.toString();
      }
      let parsed = null;
      try {
        parsed = JSON.parse(responseBody);
      } catch (e) {
        parsed = responseBody;
      }
      resolve({
        status,
        headers: resHeaders,
        body: parsed,
        text: responseBody
      });
    };

    app(req, res);
  });
}
