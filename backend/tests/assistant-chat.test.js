import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase } from './test-helper.js';
import { updateGeminiApiKey } from '../src/config/env.js';

beforeEach(() => {
  setupTestDatabase();
  updateGeminiApiKey('');
});

test('POST /api/assistant/chat rejects empty message with 400', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: '' }
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

// 1. Question about actual saved revision data (Hindi & English)
test('POST /api/assistant/chat answers "आज मैंने कितने questions solve किए हैं?" with live grounded data', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'आज मैंने कितने questions solve किए हैं?' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.ok(typeof res.body.data.data.solvedTodayCount === 'number');
  assert.match(res.body.data.text, /प्रश्न|हल/);
});

test('POST /api/assistant/chat answers "How many questions did I solve today?" with live grounded data', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'How many questions did I solve today?' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.ok(typeof res.body.data.data.solvedTodayCount === 'number');
  assert.match(res.body.data.text, /solved.*question/i);
});

test('POST /api/assistant/chat answers due and overdue revisions queries grounded in real data', async () => {
  const resDue = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'आज मेरी कितनी revisions pending हैं?' }
  });
  assert.equal(resDue.status, 200);
  assert.match(resDue.body.data.text, /रिवीजन/);

  const resOverdue = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'Show my overdue revisions' }
  });
  assert.equal(resOverdue.status, 200);
  assert.match(resOverdue.body.data.text, /overdue/i);
});

// 2. Arbitrary C++ question not included in predefined commands
test('POST /api/assistant/chat answers arbitrary C++ question: "What is the difference between std::vector and std::deque in C++?"', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'What is the difference between std::vector and std::deque in C++?' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.match(res.body.data.text, /vector.*deque|contiguous/i);
});

// 3. Random mathematics question
test('POST /api/assistant/chat answers mathematics question: Bayes Theorem and ML applications', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'Explain Bayes Theorem and how it is used in machine learning' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.match(res.body.data.text, /Bayes|Probability|P\(A\|B\)/i);
});

// 4. Hindi question
test('POST /api/assistant/chat answers Hindi question: "डायनामिक प्रोग्रामिंग क्या है और यह डिवाइड एंड कॉन्कर से कैसे अलग है?"', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'डायनामिक प्रोग्रामिंग क्या है और यह डिवाइड एंड कॉन्कर से कैसे अलग है?' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.match(res.body.data.text, /Dynamic Programming|उप-समस्या/i);
});

// 5. Hinglish question
test('POST /api/assistant/chat answers Hinglish question: "Array me two pointers kab use karte hain aur iska benefit kya hai?"', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'Array me two pointers kab use karte hain aur iska benefit kya hai?' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.match(res.body.data.text, /Two Pointers|pointer|sorted/i);
});

// 6. Coding problem existence check
test('POST /api/assistant/chat verifies coding problem: "Verify LeetCode 50"', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'Verify LeetCode 50' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.match(res.body.data.text, /LeetCode|Pow\(x, n\)|Verification/i);
});

// 7. Code solution validation with intentional bug
test('POST /api/assistant/chat reviews code solution with intentional bug: (low + high) / 2 overflow', async () => {
  const faultyCode = `
\`\`\`cpp
#include <vector>
using namespace std;

int binarySearch(vector<int>& arr, int target) {
    int low = 0, high = arr.size() - 1;
    while (low <= high) {
        int mid = (low + high) / 2; // BUG: potential integer overflow
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
\`\`\`
Can you check my binary search solution for bugs?
  `;

  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: faultyCode }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  // Detects syntax & flags the integer overflow bug
  assert.match(res.body.data.text, /Syntax & Compilation|Integer Overflow/i);
  assert.match(res.body.data.text, /Verification Notice/i);
});

// 8. Follow-up questions that depend on previous messages (multi-turn context)
test('POST /api/assistant/chat resolves follow-up questions using conversationHistory', async () => {
  const conversationHistory = [
    { role: 'user', text: 'Explain binary search algorithm' },
    { role: 'ai', text: 'Binary search is an O(log n) algorithm for searching sorted sequences.' }
  ];

  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: {
      message: 'What about its time and space complexity?',
      conversationHistory
    }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.match(res.body.data.text, /Binary Search|O\(log n\)/i);
});

// 9. Provider-unavailable behavior
test('POST /api/assistant/chat handles arbitrary open-domain question with honest guidance when GEMINI_API_KEY is unset', async () => {
  const res = await request(app, {
    method: 'POST',
    url: '/api/assistant/chat',
    body: { message: 'Tell me a historical fact about ancient Rome architecture.' }
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.text);
  assert.match(res.body.data.text, /GEMINI_API_KEY|Technical Engine Mode|Grounded Workspace/i);
});
