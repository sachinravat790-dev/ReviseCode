/**
 * Dedicated Test Suite for Hindi, English, and Hinglish Voice Input & Intent Detection.
 * Tests:
 * 1. Intent detector mapping all variations to 'today_solved_questions'
 * 2. Count-retrieval flow using Asia/Kolkata timezone
 * 3. Ensuring revision completions are NOT counted as newly solved questions
 * 4. Honest error reporting when database retrieval fails
 * 5. Ensuring Gemini language understanding does not bypass real database retrieval
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { request, setupTestDatabase } from './test-helper.js';
import { assistantService, isTodaySolvedQuestionsQuery } from '../src/services/assistant.service.js';
import { questionsService } from '../src/services/questions.service.js';
import { supabaseRepository } from '../src/repositories/supabase.repository.js';
import { getTodayDateString } from '../src/utils/dates.js';
import { updateGeminiApiKey } from '../src/config/env.js';

describe('Hindi, English & Hinglish Voice Intent Detection', () => {
  const targetPhrasings = [
    { text: 'आज मैंने कितने questions solve किए?', lang: 'hi' },
    { text: 'आज मैंने कितने सवाल हल किए?', lang: 'hi' },
    { text: 'आज कितने questions solve हुए?', lang: 'hi' },
    { text: 'Maine aaj kitne questions solve kiye?', lang: 'hinglish' },
    { text: 'Aaj maine kitne question solve kiye hain?', lang: 'hinglish' },
    { text: 'How many questions did I solve today?', lang: 'en' },
    { text: 'मैंने आज कितने सवाल हल किए?', lang: 'hi' },
    { text: 'आज मैंने कितने questions solve किए हैं?', lang: 'hi' },
    { text: 'how many problems did i solve today?', lang: 'en' },
    { text: 'questions solved today', lang: 'en' },
    { text: 'aaj kitne sawal hal kiye', lang: 'hinglish' }
  ];

  for (const item of targetPhrasings) {
    test(`detectIntent correctly routes "${item.text}" to "today_solved_questions" intent`, () => {
      const lower = item.text.toLowerCase();
      assert.equal(isTodaySolvedQuestionsQuery(item.text, lower), true, `Should match isTodaySolvedQuestionsQuery for: ${item.text}`);
      
      const detected = assistantService.detectIntent(item.text, lower);
      assert.ok(detected, `detectIntent returned null for: ${item.text}`);
      assert.equal(detected.intent, 'today_solved_questions', `Intent should be today_solved_questions for: ${item.text}`);
    });
  }

  test('Distinguishes today_solved_questions from revision queries', () => {
    const revisionQueries = [
      "Show today's pending revisions",
      'आज के रिवीजन दिखाओ',
      'Show my overdue revisions',
      'कौन से प्रश्न बाकी हैं?'
    ];

    for (const q of revisionQueries) {
      const detected = assistantService.detectIntent(q, q.toLowerCase());
      assert.notEqual(detected?.intent, 'today_solved_questions', `Revision query "${q}" should not match today_solved_questions`);
    }
  });
});

describe('Database Count-Retrieval Flow & Asia/Kolkata Timezone', () => {
  beforeEach(() => {
    setupTestDatabase();
    updateGeminiApiKey('');
  });

  test('Calculates today date in Asia/Kolkata timezone correctly', () => {
    const kolkataDate = getTodayDateString('Asia/Kolkata');
    assert.match(kolkataDate, /^\d{4}-\d{2}-\d{2}$/);
    
    // Check Intl formatting match
    const expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    assert.equal(kolkataDate, expected);
  });

  test('Count retrieval returns 0 when no questions solved today', async () => {
    const result = await questionsService.getTodaySolvedQuestions('Asia/Kolkata');
    assert.equal(result.count, 0);
    assert.equal(result.items.length, 0);
    assert.equal(result.timeZone, 'Asia/Kolkata');
    assert.equal(result.today, getTodayDateString('Asia/Kolkata'));
  });

  test('Strictly counts newly solved questions, NOT revision milestone completions', async () => {
    const today = getTodayDateString('Asia/Kolkata');

    // 1. Create a question solved today
    const q1 = await questionsService.createQuestion({
      title: 'Valid Palindrome',
      platform: 'LeetCode',
      problemNumber: '125',
      subject: 'DSA',
      difficulty: 'Easy',
      dateSolved: today
    });

    // 2. Create a question solved 10 days ago (past date)
    const qPast = await questionsService.createQuestion({
      title: 'Two Sum',
      platform: 'LeetCode',
      problemNumber: '1',
      subject: 'DSA',
      difficulty: 'Easy',
      dateSolved: '2026-01-01'
    });

    // 3. Mark a revision milestone of qPast as completed today
    const revisions = await supabaseRepository.getAllRevisions({ questionId: qPast.id });
    if (revisions && revisions.length > 0) {
      await supabaseRepository.completeRevision(revisions[0].id, {
        recallRating: 'good'
      });
    }

    // 4. Query today solved questions
    const result = await questionsService.getTodaySolvedQuestions('Asia/Kolkata');
    // Only q1 must be counted, NOT the revision completion on qPast
    assert.equal(result.count, 1, 'Only questions with date_solved === today should be counted');
    assert.equal(result.items[0].id, q1.id);
  });

  test('POST /api/assistant/chat answers all required Hindi, English, and Hinglish phrasings with live data', async () => {
    const today = getTodayDateString('Asia/Kolkata');
    
    // Add 1 question solved today
    await questionsService.createQuestion({
      title: 'Binary Search',
      platform: 'LeetCode',
      problemNumber: '704',
      subject: 'DSA',
      difficulty: 'Easy',
      dateSolved: today
    });

    const testPhrasings = [
      { q: 'How many questions did I solve today?', isHindi: false },
      { q: 'आज मैंने कितने questions solve किए हैं?', isHindi: true },
      { q: 'मैंने आज कितने सवाल हल किए?', isHindi: true },
      { q: 'आज मैंने कितने questions solve किए?', isHindi: true },
      { q: 'आज कितने questions solve हुए?', isHindi: true },
      { q: 'Maine aaj kitne questions solve kiye?', isHindi: true },
      { q: 'Aaj maine kitne question solve kiye hain?', isHindi: true }
    ];

    for (const item of testPhrasings) {
      const res = await request(app, {
        method: 'POST',
        url: '/api/assistant/chat',
        body: { message: item.q }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.intent, 'today_solved_questions');
      assert.equal(res.body.data.data.solvedTodayCount, 1);
      assert.equal(res.body.data.data.date, today);
      assert.equal(res.body.data.data.timeZone, 'Asia/Kolkata');
      assert.match(res.body.data.text, /Binary Search/);
    }
  });

  test('Returns honest, understandable error when database fails (Requirement 8)', async () => {
    // Temporarily mock getAllQuestions to simulate database outage
    const origGetAll = supabaseRepository.getAllQuestions;
    supabaseRepository.getAllQuestions = async () => {
      throw new Error('Connection refused: Supabase PostgreSQL pool exhausted');
    };

    try {
      const res = await request(app, {
        method: 'POST',
        url: '/api/assistant/chat',
        body: { message: 'मैंने आज कितने सवाल हल किए?' }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.handled, false);
      assert.equal(res.body.data.mode, 'database_error');
      assert.match(res.body.data.text, /डेटाबेस से आज.*हल किए गए प्रश्नों की संख्या प्राप्त नहीं की जा सकी/);
      assert.match(res.body.data.text, /pool exhausted/);
    } finally {
      supabaseRepository.getAllQuestions = origGetAll;
    }
  });

  test('Gemini API key configuration never replaces or bypasses real database count (Requirement 9)', async () => {
    // Configure an active key in memory
    updateGeminiApiKey('AIzaSy_MOCK_VALID_KEY_9999');

    const today = getTodayDateString('Asia/Kolkata');
    await questionsService.createQuestion({
      title: 'Climbing Stairs',
      platform: 'LeetCode',
      problemNumber: '70',
      subject: 'DSA',
      difficulty: 'Easy',
      dateSolved: today
    });

    const res = await request(app, {
      method: 'POST',
      url: '/api/assistant/chat',
      body: { message: 'आज मैंने कितने questions solve किए?' }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.intent, 'today_solved_questions');
    // Grounded database record is preserved, not bypassed by Gemini
    assert.equal(res.body.data.data.solvedTodayCount, 1);
    assert.match(res.body.data.text, /Climbing Stairs/);

    updateGeminiApiKey('');
  });
});
