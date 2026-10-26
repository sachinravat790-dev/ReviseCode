/**
 * Assistant Service: Full Natural-Language AI Chatbot with Grounded Workspace Data,
 * Multi-Turn Dialog Context, Problem Verification, and Code Review.
 *
 * Integrates Google Gemini API (gemini-2.5-flash / gemini-1.5-flash) with safe fallback to
 * local grounded analysis and technical knowledge base when the provider is unconfigured.
 */

import { questionsService } from './questions.service.js';
import { revisionsService } from './revisions.service.js';
import { supabaseRepository } from '../repositories/supabase.repository.js';
import { problemVerifierService } from './problem-verifier.service.js';
import { codeReviewerService } from './code-reviewer.service.js';
import { knowledgeBaseService } from './knowledge-base.service.js';
import { getTodayDateString, formatDate } from '../utils/dates.js';
import { config, isGeminiConfigured, maskSensitive, saveGeminiApiKeyToEnv, updateGeminiApiKey } from '../config/env.js';
import { GoogleGenAI } from '@google/genai';

export const GEMINI_SUPPORTED_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-2.5-flash'
];

export function isTodaySolvedQuestionsQuery(text, lower) {
  return assistantService.isTodaySolvedQuestionsQuery(text, lower);
}

export const assistantService = {
  getCapabilities() {
    const geminiActive = isGeminiConfigured();
    return {
      mode: geminiActive ? 'gemini_llm' : 'deterministic_mock',
      aiProviderConnected: geminiActive,
      model: geminiActive ? 'Google Gemini 3 Flash' : 'Grounded Workspace & Technical Engine',
      features: [
        'Full natural-language conversation (Hindi, English, Hinglish)',
        'Multi-turn context memory for follow-up questions',
        'Real-time Supabase tracking queries (questions solved today, due revisions, overdue revisions, stats)',
        'Official coding problem verification (LeetCode, Codeforces)',
        'Compiler-grade syntax & logic review for C++, JavaScript, Python',
        'Spaced repetition milestone scheduling'
      ],
      supportedCommands: [
        {
          command: 'show_due_revisions',
          description: "List all coding questions with revision milestones due today"
        },
        {
          command: 'show_overdue_revisions',
          description: "List all overdue revision milestones requiring catch-up"
        },
        {
          command: 'list_questions',
          description: "Retrieve questions filtered by subject or keyword"
        },
        {
          command: 'add_question',
          description: "Create a new question and schedule its 5 mandatory revision milestones",
          requiredPayload: ['title', 'platform']
        },
        {
          command: 'explain_solution',
          description: "Retrieve approach and complexity explanation for a saved question",
          requiredPayload: ['questionId or title']
        }
      ],
      notice: geminiActive
        ? 'Connected to Google Gemini API for natural-language reasoning and coding assistance.'
        : 'Operating in Grounded Workspace & Technical Engine Mode. Configure GEMINI_API_KEY in backend/.env for live Gemini conversational reasoning.'
    };
  },

  /**
   * Retrieves current status and configuration of Google Gemini integration.
   */
  getStatus() {
    const configured = isGeminiConfigured();
    return {
      configured,
      provider: 'Google Gemini',
      activeModel: configured ? 'gemini-3-flash-preview' : 'Grounded Workspace & Technical Engine',
      apiKeyMasked: configured ? maskSensitive(config.geminiApiKey, 6, 4) : '',
      mode: configured ? 'gemini_llm' : 'grounded_workspace',
      description: configured
        ? 'Connected to Google Gemini API (gemini-3-flash-preview) for arbitrary natural-language conversation and deep coding reasoning.'
        : 'Operating in Grounded Workspace Mode using live Supabase database records and local technical engine.'
    };
  },

  /**
   * Performs an active connection test against Google Gemini API using @google/genai.
   */
  async testGeminiConnection(customApiKey) {
    const key = (customApiKey || config.geminiApiKey || '').trim();
    if (!key) {
      return {
        success: false,
        configured: false,
        message: 'GEMINI_API_KEY is not configured. Provide an API key or configure it in backend/.env',
        details: 'Missing GEMINI_API_KEY'
      };
    }

    const modelsToTest = GEMINI_SUPPORTED_MODELS.slice(0, 2);
    let lastError = null;

    for (const model of modelsToTest) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const requestPromise = ai.models.generateContent({
          model,
          contents: 'Please reply with exactly: "Gemini API connected successfully."',
          config: {
            maxOutputTokens: 60,
            temperature: 0.1
          }
        });

        const timeoutPromise = new Promise((_, reject) => {
          const timer = setTimeout(() => reject(new Error('Connection timed out after 3500ms')), 3500);
          if (timer.unref) timer.unref();
        });

        const response = await Promise.race([requestPromise, timeoutPromise]);

        const reply = response.text ? response.text.trim() : '';
        return {
          success: true,
          configured: true,
          model,
          reply,
          message: `Google Gemini API (${model}) connected and responded successfully!`
        };
      } catch (err) {
        lastError = err;
        console.warn(`Gemini test connection failed with model ${model}:`, err.message?.slice(0, 100));
        if (err.status === 400 || err.status === 403 || /fetch failed|timed out|API key not valid|INVALID_ARGUMENT|PERMISSION_DENIED/i.test(err.message)) {
          break;
        }
      }
    }

    return {
      success: false,
      configured: true,
      message: `Gemini API connection test failed: ${lastError?.message || 'Unknown error'}`,
      details: lastError?.message || 'Unknown error'
    };
  },

  /**
   * Configures or updates the Gemini API key in runtime and optionally persists to .env.
   */
  async configureGeminiKey(apiKey, persist = true) {
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      if (persist) {
        saveGeminiApiKeyToEnv('');
      } else {
        updateGeminiApiKey('');
      }
      return {
        success: true,
        configured: false,
        message: 'Gemini API key cleared. Reverted to Grounded Workspace Mode.'
      };
    }

    // Run connection test with the provided key
    const testResult = await this.testGeminiConnection(cleanKey);

    if (persist) {
      saveGeminiApiKeyToEnv(cleanKey);
    } else {
      updateGeminiApiKey(cleanKey);
    }

    return {
      success: testResult.success,
      configured: true,
      model: testResult.model || 'gemini-3-flash-preview',
      testResult,
      message: testResult.success
        ? 'Gemini API key configured and verified successfully!'
        : `Gemini API key updated, but connection test failed: ${testResult.message}`
    };
  },

  /**
   * Main conversational handler for natural-language chat queries (Hindi, English, Hinglish).
   */
  async handleChatMessage(message, options = {}) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      return {
        text: 'Please provide a question or command.',
        mode: isGeminiConfigured() ? 'gemini_llm' : 'grounded_workspace',
        handled: false
      };
    }

    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();
    const conversationHistory = Array.isArray(options.conversationHistory) ? options.conversationHistory : [];

    // Language identification: Hindi (Devanagari), Hinglish, or English
    const isDevanagari = /[\u0900-\u097F]/.test(trimmed);
    const isHinglish = /\b(aaj|kitne|kitna|kitni|baki|kare|hai|kya|dikhao|kaise|karo|batao|samjhao|kyun|hota|karna|me|mein|sawal|hal|kiye|hue|karte|hain)\b/i.test(lower);
    const isHindi = isDevanagari || isHinglish;

    // 1. Check if user is asking to verify problem existence on LeetCode/Codeforces
    const problemCheck = this.detectProblemVerificationIntent(trimmed, lower);
    let problemVerification = null;
    if (problemCheck) {
      problemVerification = await problemVerifierService.verifyProblem(problemCheck.platform, problemCheck.query);
    }

    // 2. Check if user submitted a code solution for review
    const hasCode = codeReviewerService.hasCodeSnippet(trimmed);
    let codeReview = null;
    if (hasCode) {
      codeReview = await codeReviewerService.reviewSolution(trimmed);
    }

    // 3. Grounded Database Tracking Intents:
    // Guarantees real database queries for questions solved today, due revisions, and overdue items
    // are executed with Asia/Kolkata timezone and NEVER bypassed or replaced by LLM hallucinations.
    const userId = options.userId || null;
    const intent = this.detectIntent(trimmed, lower);
    if (intent) {
      if (intent.intent === 'today_solved_questions') {
        return await this.handleTodaySolvedQuestionsIntent(isHindi, 'Asia/Kolkata', userId);
      }
      if (intent.intent === 'due_revisions') {
        return await this.handleDueRevisionsIntent(isHindi, userId);
      }
      if (intent.intent === 'overdue_revisions') {
        return await this.handleOverdueRevisionsIntent(isHindi, userId);
      }
    }

    // 4. If Gemini is configured, invoke Gemini with workspace context, verified data, and multi-turn history
    let geminiError = null;
    if (isGeminiConfigured()) {
      try {
        const geminiResult = await this.callGeminiWithContext(trimmed, {
          isHindi,
          isHinglish,
          conversationHistory,
          problemVerification,
          codeReview
        });

        if (geminiResult && geminiResult.text) {
          return {
            text: geminiResult.text,
            actionCardHtml: geminiResult.actionCardHtml || (problemVerification?.verified ? this.createProblemActionCard(problemVerification) : ''),
            mode: 'gemini_llm',
            handled: true,
            provider: 'Google Gemini',
            model: geminiResult.model || 'gemini-3-flash-preview',
            problemVerification,
            codeReview
          };
        }
      } catch (geminiErr) {
        geminiError = geminiErr;
        console.warn('Gemini API call failed, falling back to local grounded engine:', geminiErr.message);
      }
    }

    // 4. Grounded Local Engine: Handles queries using live Supabase data, compiler review, verifier, and technical knowledge base
    return await this.executeGroundedWorkspaceQuery(trimmed, lower, isHindi, {
      ...options,
      conversationHistory,
      problemVerification,
      codeReview,
      geminiError
    });
  },

  /**
   * Detects if the prompt is asking to check/verify problem existence on a platform.
   */
  detectProblemVerificationIntent(text, lower) {
    const isVerifyIntent = lower.includes('verify') || lower.includes('check') || lower.includes('exist') ||
      lower.includes('problem') || lower.includes('question') || lower.includes('hai kya') ||
      lower.includes('leetcode') || lower.includes('codeforces') || lower.includes('gfg');

    if (!isVerifyIntent) return null;

    // Match LeetCode: "LeetCode 50", "LeetCode Pow(x, n)", "LeetCode problem 1"
    const lcMatch = text.match(/leetcode\s*(?:problem|question|#)?\s*([a-zA-Z0-9_\-\(\),\s]+)/i);
    if (lcMatch) {
      const q = lcMatch[1].trim().replace(/(?:exists\??|hai kya\??|verify|check|please)$/i, '').trim();
      if (q) return { platform: 'LeetCode', query: q };
    }

    // Match Codeforces: "Codeforces 4A", "Codeforces 71A", "Codeforces Watermelon"
    const cfMatch = text.match(/codeforces\s*(?:problem|#)?\s*([a-zA-Z0-9_\-\s]+)/i);
    if (cfMatch) {
      const q = cfMatch[1].trim().replace(/(?:exists\??|hai kya\??|verify|check|please)$/i, '').trim();
      if (q) return { platform: 'Codeforces', query: q };
    }

    // Match GeeksforGeeks
    const gfgMatch = text.match(/(?:geeksforgeeks|gfg)\s*(?:problem|#)?\s*([a-zA-Z0-9_\-\s]+)/i);
    if (gfgMatch) {
      const q = gfgMatch[1].trim().replace(/(?:exists\??|hai kya\??|verify|check|please)$/i, '').trim();
      if (q) return { platform: 'GeeksforGeeks', query: q };
    }

    return null;
  },

  /**
   * Universal intent detector for ReviseCode Assistant.
   * Maps Hindi, English, and Hinglish phrasings to canonical system intents.
   */
  detectIntent(text, lower) {
    if (!text || typeof text !== 'string') return null;
    const raw = text.trim();
    const cleanLower = (lower || raw.toLowerCase()).replace(/[?!,.:;|।\'\"\(\)]/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. today_solved_questions: Questions solved today
    if (this.isTodaySolvedQuestionsQuery(raw, cleanLower)) {
      return { intent: 'today_solved_questions' };
    }

    // 2. due_revisions: Revisions due today
    if (this.isDueRevisionsQuery(raw, cleanLower)) {
      return { intent: 'due_revisions' };
    }

    // 3. overdue_revisions: Overdue revisions
    if (this.isOverdueRevisionsQuery(raw, cleanLower)) {
      return { intent: 'overdue_revisions' };
    }

    return null;
  },

  /**
   * Recognizes all equivalent Hindi, English, and Hinglish questions for today's solved problems:
   * - "आज मैंने कितने questions solve किए?"
   * - "आज मैंने कितने सवाल हल किए?"
   * - "आज कितने questions solve हुए?"
   * - "Maine aaj kitne questions solve kiye?"
   * - "Aaj maine kitne question solve kiye hain?"
   * - "How many questions did I solve today?"
   */
  isTodaySolvedQuestionsQuery(text, lower) {
    if (!text || typeof text !== 'string') return false;
    const raw = text.trim();
    const cleanLower = (lower || raw.toLowerCase()).replace(/[?!,.:;|।\'\"\(\)]/g, ' ').replace(/\s+/g, ' ').trim();

    // Pure revision queries are excluded unless solve/hal is explicitly mentioned
    const isRevisionExclusive = /\b(revisions?|milestones?)\b/i.test(cleanLower) && !/\b(solve|solved|hal)\b/i.test(cleanLower);
    if (isRevisionExclusive) return false;

    // 1. Must refer to today (English "today", Hinglish "aaj", Hindi "आज")
    const hasToday = /\b(today|aaj|aajke|aajka)\b/i.test(cleanLower) || /आज/.test(raw);

    // 2. Entity: questions / problems / sawal / prashna
    const hasEntity = /\b(question|questions|problem|problems|sawal|prashna|prashn|ques|que)\b/i.test(cleanLower) || 
      /(क्वेश्चन|क्वेश्चंस|प्रश्न|सवाल|प्रश्नों|सवालों)/.test(raw);

    // 3. Action: solved / hal / kiya / kiye / hue / done / kare
    const hasAction = /\b(solve|solved|solving|hal|kare|kiye|kiya|hue|done)\b/i.test(cleanLower) ||
      /(सॉल्व|सॉल्व्ड|हल|किए|किया|हुए|करे)/.test(raw);

    // 4. Quantity / Query intent: how many / kitne / count / number of
    const hasQuantity = /\b(how many|count|number of|kitne|kitna|kitni)\b/i.test(cleanLower) ||
      /(कितने|कितना|कितनी|संख्या)/.test(raw);

    if (hasToday && hasEntity && hasAction) return true;
    if (hasToday && hasQuantity && hasAction) return true;
    if (hasQuantity && hasEntity && hasToday) return true;

    const exactPatterns = [
      /how many.*(?:question|problem).*solve.*today/i,
      /how many.*(?:question|problem).*today/i,
      /(?:questions?|problems?).*solved.*today/i,
      /today.*(?:questions?|problems?).*solved/i,
      /आज.*(?:question|सवाल|प्रश्न).*हल.*(?:किए|हुए)?/i,
      /आज.*(?:question|सवाल|प्रश्न).*solve/i,
      /आज.*कितने.*(?:solve|हल)/i,
      /(?:maine\s+)?aaj.*kitne.*(?:solve|hal|question|sawal)/i,
      /aaj.*(?:maine\s+)?kitne.*(?:solve|hal|question|sawal)/i,
      /kitne.*(?:question|sawal|problem).*(?:solve|hal).*aaj/i
    ];

    return exactPatterns.some(regex => regex.test(cleanLower) || regex.test(raw));
  },

  isDueRevisionsQuery(text, lower) {
    if (!text || typeof text !== 'string') return false;
    const raw = text.trim();
    const cleanLower = (lower || raw.toLowerCase()).replace(/[?!,.:;|।\'\"\(\)]/g, ' ').replace(/\s+/g, ' ').trim();
    if (this.isTodaySolvedQuestionsQuery(raw, cleanLower)) return false;

    return (
      cleanLower.includes('pending') ||
      cleanLower.includes('due') ||
      cleanLower.includes('पेंडिंग') ||
      (cleanLower.includes('आज') && (cleanLower.includes('रिवीजन') || cleanLower.includes('बाकी'))) ||
      cleanLower.includes('revisions today') ||
      cleanLower.includes('today revisions') ||
      cleanLower.includes('due revisions')
    ) && !cleanLower.includes('overdue') && !cleanLower.includes('छूट');
  },

  isOverdueRevisionsQuery(text, lower) {
    if (!text || typeof text !== 'string') return false;
    const raw = text.trim();
    const cleanLower = (lower || raw.toLowerCase()).replace(/[?!,.:;|।\'\"\(\)]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleanLower.includes('overdue') || cleanLower.includes('छूट') || cleanLower.includes('बकाया') || cleanLower.includes('ओवरड्यू');
  },

  /**
   * Handles today_solved_questions intent with live database retrieval using Asia/Kolkata timezone.
   */
  async handleTodaySolvedQuestionsIntent(isHindi, timeZone = 'Asia/Kolkata', userId = null) {
    const today = getTodayDateString(timeZone);
    let todayData;
    try {
      todayData = await questionsService.getTodaySolvedQuestions({ userId, timeZone });
    } catch (err) {
      console.error('Error fetching questions solved today:', err);
      const errorMsg = isHindi
        ? `डेटाबेस से आज (${today}) हल किए गए प्रश्नों की संख्या प्राप्त नहीं की जा सकी: ${err.message || 'डेटाबेस अनुपलब्ध'}। कृपया सुनिश्चित करें कि आपका डेटाबेस कनेक्टेड है।`
        : `Unable to retrieve the count of questions solved today (${today}) from your database: ${err.message || 'Database unavailable'}. Please check your database connection.`;
      return {
        text: errorMsg,
        handled: false,
        intent: 'today_solved_questions',
        mode: 'database_error',
        error: err.message,
        data: { date: today, timeZone }
      };
    }

    const { count, items } = todayData;

    if (count === 0) {
      return {
        text: isHindi
          ? `आज (${today}) आपने **0 प्रश्न** हल किए हैं।\n\nअपने रिवीजन ट्रैकर में नया प्रश्न जोड़ने के लिए "Add Question" पर जाएँ या मुझसे कहें: *"Add LeetCode 50 to my revision tracker"*!`
          : `You have solved **0 questions today** (${today}) (queried from live backend database).\n\nTo start tracking a new problem and schedule its 5 mandatory revision milestones, visit "Add Question" or say *"Add LeetCode 50 to my revision tracker"*!`,
        actionCardHtml: `
          <div class="ai-action-card">
            <div class="ai-action-header"><i data-lucide="plus-circle"></i> Add Question</div>
            <div class="ai-action-actions">
              <a href="add-question.html" class="btn btn-primary btn-sm">${isHindi ? '+ नया प्रश्न जोड़ें' : '+ Add Question'}</a>
              <a href="questions.html" class="btn btn-secondary btn-sm">${isHindi ? 'सभी प्रश्न देखें' : 'View All Questions'}</a>
            </div>
          </div>
        `,
        handled: true,
        intent: 'today_solved_questions',
        mode: 'grounded_workspace',
        data: { solvedTodayCount: 0, items: [], date: today, timeZone }
      };
    }

    const list = items.map(q => `• **${q.title}** (${q.platform} ${q.problemNumber ? '#' + q.problemNumber : ''} - ${q.subject || 'DSA'})`).join('<br>');
    return {
      text: isHindi
        ? `आपने आज (${today}) कुल **${count} प्रश्न** हल किए हैं (लाइव डेटाबेस रिकॉर्ड्स):<br><br>${list}<br><br>इनके स्पेस्ड-रिवीजन माइलस्टोन्स (दिन 3, 7, 12, 20, 30) आपके रिवीजन शेड्यूल में सक्रिय हैं।`
        : `You have solved **${count} question(s) today** (${today}) (queried from live backend database):<br><br>${list}<br><br>Their 5 mandatory spaced-repetition milestones (Day 3, 7, 12, 20, 30) are actively scheduled in your Revision Center.`,
      actionCardHtml: `
        <div class="ai-action-card">
          <div class="ai-action-header"><i data-lucide="check-circle"></i> Today's Solved Questions</div>
          <div class="ai-action-actions">
            <a href="questions.html" class="btn btn-primary btn-sm">${isHindi ? 'प्रश्नों में देखें' : 'View in Questions Tracker'}</a>
            <a href="revision-center.html" class="btn btn-secondary btn-sm">${isHindi ? 'रिवीजन सेंटर' : 'Revision Center'}</a>
          </div>
        </div>
      `,
      handled: true,
      intent: 'today_solved_questions',
      mode: 'grounded_workspace',
      data: { solvedTodayCount: count, items, date: today, timeZone }
    };
  },

  async handleDueRevisionsIntent(isHindi, userId = null) {
    try {
      const items = await revisionsService.getTodayRevisions(userId);
      if (items.length === 0) {
        return {
          text: isHindi
            ? `आज आपके पास **0 पेंडिंग रिवीजन** हैं! आपकी आज की कतार पूरी तरह स्पष्ट है। बहुत बढ़िया काम!`
            : `You have **0 revisions due today**! Your queue is completely clear. Great job keeping up with your spaced active recall.`,
          handled: true,
          intent: 'due_revisions',
          mode: 'grounded_workspace',
          data: { items: [] }
        };
      }

      const list = items.map(m => `• **${m.questionTitle}** (${m.platform} ${m.problemNumber || ''}) — Day ${m.milestoneDay || m.day} Milestone`).join('<br>');
      return {
        text: isHindi
          ? `आज आपके पास **${items.length} रिवीजन** देय हैं (लाइव बैकएंड रिकॉर्ड्स):<br><br>${list}<br><br>अपनी याददाश्त जांचने के लिए रिवीजन सेंटर खोलें।`
          : `You have **${items.length} revision(s) due today** (queried from backend):<br><br>${list}<br><br>You can open the Revision Center to test your recall without looking at the saved code.`,
        actionCardHtml: `
          <div class="ai-action-card">
            <div class="ai-action-header"><i data-lucide="play-circle"></i> Ready to Revise</div>
            <div class="ai-action-actions">
              <a href="revision-center.html" class="btn btn-primary btn-sm">${isHindi ? 'रिवीजन सेंटर खोलें' : "Open Today's Queue"}</a>
            </div>
          </div>
        `,
        handled: true,
        intent: 'due_revisions',
        mode: 'grounded_workspace',
        data: { items }
      };
    } catch (err) {
      return {
        text: isHindi
          ? `डेटाबेस से आज के देय रिवीजन प्राप्त करने में त्रुटि: ${err.message}`
          : `Unable to retrieve due revisions from database: ${err.message}`,
        handled: false,
        intent: 'due_revisions',
        mode: 'database_error',
        error: err.message
      };
    }
  },

  async handleOverdueRevisionsIntent(isHindi, userId = null) {
    try {
      const items = await revisionsService.getOverdueRevisions(userId);
      if (items.length === 0) {
        return {
          text: isHindi
            ? `अच्छी खबर! आपके पास **0 ओवरड्यू रिवीजन** हैं। आपके सभी माइलस्टोन्स समय पर हैं।`
            : `Good news! You have **0 overdue revisions**. All your spaced milestones are up to date.`,
          handled: true,
          intent: 'overdue_revisions',
          mode: 'grounded_workspace',
          data: { items: [] }
        };
      }

      const list = items.map(m => `• **${m.questionTitle}** — Day ${m.milestoneDay || m.day} Milestone (Target was ${formatDate(m.dueDate || m.targetDate)})`).join('<br>');
      return {
        text: isHindi
          ? `आपके पास **${items.length} ओवरड्यू रिवीजन** हैं (लाइव बैकएंड रिकॉर्ड्स):<br><br>${list}<br><br>भूलने की अवस्था से बचने के लिए इन्हें पहले पूरा करने की सलाह दी जाती है।`
          : `You have **${items.length} overdue revision(s)** (queried from backend):<br><br>${list}<br><br>I recommend catching up on these first to prevent concept decay on your forgetting curve.`,
        actionCardHtml: `
          <div class="ai-action-card">
            <div class="ai-action-header" style="color: var(--danger);"><i data-lucide="alert-triangle"></i> Overdue Items</div>
            <div class="ai-action-actions">
              <a href="revision-center.html" class="btn btn-danger btn-sm">${isHindi ? 'ओवरड्यू रिवीजन क्लियर करें' : 'Clear Overdue Milestones'}</a>
            </div>
          </div>
        `,
        handled: true,
        intent: 'overdue_revisions',
        mode: 'grounded_workspace',
        data: { items }
      };
    } catch (err) {
      return {
        text: isHindi
          ? `डेटाबेस से ओवरड्यू रिवीजन प्राप्त करने में त्रुटि: ${err.message}`
          : `Unable to retrieve overdue revisions from database: ${err.message}`,
        handled: false,
        intent: 'overdue_revisions',
        mode: 'database_error',
        error: err.message
      };
    }
  },

  /**
   * Calls Google Gemini REST API grounded with real-time Supabase metrics,
   * verified problem data, and multi-turn conversational history.
   */
  async callGeminiWithContext(userPrompt, meta = {}) {
    const today = getTodayDateString();
    const [allQuestionsRes, dueToday, overdue, stats] = await Promise.all([
      questionsService.getAllQuestions({ limit: 1000 }).catch(() => ({ items: [] })),
      revisionsService.getTodayRevisions().catch(() => []),
      revisionsService.getOverdueRevisions().catch(() => []),
      supabaseRepository.getStats().catch(() => ({}))
    ]);

    const allQuestions = allQuestionsRes.items || [];
    const solvedToday = allQuestions.filter(q => q.dateSolved === today);

    // Build System Instructions
    let systemInstruction = `You are the ReviseCode AI Companion, an expert software engineering paired assistant and natural-language chatbot.
You help engineers master Data Structures, Algorithms, C++, SQL, Mathematics, System Design, and Spaced-Repetition Active Recall.

CONVERSATIONAL & LANGUAGE GUIDELINES:
1. Support Hindi (Devanagari), English, and Hinglish naturally based on how the user communicates.
2. Maintain context across the conversation. If the user asks follow-up questions (e.g. "what about its space complexity?", "how does it work?"), understand pronouns and references based on previous messages.
3. Be direct, clear, educational, and structured. Use markdown formatting with code blocks, complexity notes, and bullet points.

CRITICAL WORKSPACE GROUNDING RULES (NEVER FABRICATE):
- Today's Date: ${today}
- Questions Solved Today: ${solvedToday.length} ${solvedToday.length > 0 ? `(${solvedToday.map(q => q.title + ' on ' + q.platform).join(', ')})` : '(No questions solved yet today)'}
- Revisions Due Today: ${dueToday.length} ${dueToday.length > 0 ? `(${dueToday.map(r => r.questionTitle + ' - Day ' + (r.milestoneDay || r.day)).join(', ')})` : '(All due milestones completed)'}
- Overdue Revisions: ${overdue.length} ${overdue.length > 0 ? `(${overdue.map(r => r.questionTitle + ' - Day ' + (r.milestoneDay || r.day)).join(', ')})` : '(Zero overdue items)'}
- Total Questions Tracked: ${stats.totalQuestions || allQuestions.length}
- Completed Revisions: ${stats.completedRevisions || 0}
- Spaced Repetition Mastery: ${stats.masteryPercentage || 0}%

Whenever the user asks about their questions, revisions, schedule, or stats, base your answer strictly on the numbers above. Never fabricate statistics.

CODING PROBLEM EXISTENCE RULES:
- Never invent a problem URL or state that a problem exists unless verified.
- If verification data is provided below, cite the official title, number, difficulty, and URL.
- If unverified, state clearly that the existence could not be confirmed.

CODE SOLUTION VALIDATION RULES:
- Explain the intended algorithm.
- Check syntax, logic, edge cases (e.g. overflow in binary search mid calculation, off-by-one, infinite loops).
- Clearly distinguish reasoning-based review from executed tests. Do not claim code passes all testcases unless tested against an exhaustive judge.`;

    // Append verified problem ground truth if available
    if (meta.problemVerification) {
      const v = meta.problemVerification;
      systemInstruction += `\n\n[OFFICIAL PROBLEM VERIFICATION GROUND TRUTH]:
- Platform: ${v.platform}
- Verified: ${v.verified ? 'YES' : 'NO'}
- Title: ${v.title || 'Unknown'}
- Number: ${v.problemNumber || v.index || 'N/A'}
- Difficulty: ${v.difficulty || 'N/A'}
- Official URL: ${v.officialUrl || 'None'}
- Notes: ${v.message || v.sourceEvidence || ''}`;
    }

    // Append code review static analysis if available
    if (meta.codeReview) {
      const r = meta.codeReview;
      systemInstruction += `\n\n[STATIC CODE ANALYSIS FINDINGS]:
- Language: ${r.language}
- Syntax Status: ${r.syntax.status} (${r.syntax.message})
- Compiler Error Details: ${r.syntax.errorDetails || 'None'}
- Potential Bugs: ${JSON.stringify(r.bugs)}`;
    }

    // Build multi-turn contents array
    const contents = this.buildGeminiContents(userPrompt, meta.conversationHistory);

    const models = GEMINI_SUPPORTED_MODELS;
    let lastError = null;

    // 1. Primary: Official @google/genai SDK
    try {
      const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      for (const model of models) {
        try {
          const reqPromise = ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              temperature: 0.7
            }
          });

          const timePromise = new Promise((_, reject) => {
            const timer = setTimeout(() => reject(new Error(`Model ${model} request timed out after 8s`)), 8000);
            if (timer.unref) timer.unref();
          });

          const response = await Promise.race([reqPromise, timePromise]);

          if (response && response.text) {
            return { text: response.text, model };
          }
        } catch (sdkModelErr) {
          lastError = sdkModelErr;
          console.warn(`Gemini SDK generateContent failed (${model}):`, sdkModelErr.message?.slice(0, 100));
        }
      }
    } catch (sdkInitErr) {
      lastError = sdkInitErr;
      console.warn('Gemini SDK client initialization failed:', sdkInitErr.message);
    }

    // 2. Secondary: Direct REST API fetch with AbortSignal fallback
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] }
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.warn(`Gemini REST API error (${model}): ${res.status} - ${errBody}`);
          continue;
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { text, model };
        }
      } catch (e) {
        lastError = e;
        console.warn(`Gemini REST fetch attempt with ${model} failed:`, e.message);
      }
    }

    throw new Error(`All Gemini API model attempts failed or timed out: ${lastError?.message || 'Unknown'}`);
  },

  /**
   * Formats multi-turn conversation history into Gemini's contents array format.
   */
  buildGeminiContents(userPrompt, conversationHistory = []) {
    const raw = [];

    if (Array.isArray(conversationHistory)) {
      // Use up to the last 10 turns
      const recent = conversationHistory.slice(-10);
      for (const msg of recent) {
        if (!msg || !msg.text) continue;
        const role = msg.role === 'user' ? 'user' : 'model';
        raw.push({ role, parts: [{ text: msg.text }] });
      }
    }

    // Ensure valid alternating sequence (user -> model -> user)
    const sanitized = [];
    for (const item of raw) {
      if (sanitized.length === 0 && item.role !== 'user') continue;
      if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === item.role) {
        sanitized[sanitized.length - 1].parts[0].text += `\n\n${item.parts[0].text}`;
      } else {
        sanitized.push(item);
      }
    }

    // Append current prompt
    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
      sanitized[sanitized.length - 1].parts[0].text += `\n\n${userPrompt}`;
    } else {
      sanitized.push({ role: 'user', parts: [{ text: userPrompt }] });
    }

    return sanitized;
  },

  /**
   * Grounded Local Engine: used when Gemini API key is unset or network is offline.
   * Grounded in live Supabase records, clang++ syntax checking, and technical knowledge base.
   */
  async executeGroundedWorkspaceQuery(trimmed, lower, isHindi, options = {}) {
    const today = getTodayDateString();

    // A. Problem Verification Query
    if (options.problemVerification) {
      const v = options.problemVerification;
      return {
        text: this.formatProblemVerificationResponse(v, isHindi),
        actionCardHtml: v.verified ? this.createProblemActionCard(v) : '',
        handled: true,
        mode: 'problem_verifier',
        data: v
      };
    }

    // B. Code Review Submission
    if (options.codeReview) {
      const r = options.codeReview;
      return {
        text: this.formatCodeReviewResponse(r, isHindi),
        handled: true,
        mode: 'code_reviewer',
        data: r
      };
    }

    // C. Live Supabase Tracking Queries: Questions solved today
    if (this.isTodaySolvedQuestionsQuery(trimmed, lower)) {
      return await this.handleTodaySolvedQuestionsIntent(isHindi);
    }

    // D. Revisions due today
    if (this.isDueRevisionsQuery(trimmed, lower)) {
      return await this.handleDueRevisionsIntent(isHindi);
    }

    // E. Overdue Revisions
    if (this.isOverdueRevisionsQuery(trimmed, lower)) {
      return await this.handleOverdueRevisionsIntent(isHindi);
    }

    // F. Workspace Overall Stats
    if (lower.includes('stat') || lower.includes('progress') || lower.includes('streak') || lower.includes('प्रगति') || lower.includes('आंकड़े') || lower.includes('आँकड़े')) {
      const stats = await supabaseRepository.getStats().catch(() => ({}));
      return {
        text: isHindi
          ? `यहाँ आपके ReviseCode आँकड़े हैं (लाइव डेटाबेस):\n• **कुल ट्रैक किए गए प्रश्न:** ${stats.totalQuestions || 0}\n• **पूर्ण किए गए रिवीजन:** ${stats.completedRevisions || 0}\n• **पेंडिंग रिवीजन:** ${stats.pendingRevisions || 0}\n• **मास्टरी दर:** ${stats.masteryPercentage || 0}%\n• **सक्रिय स्ट्रीक:** ${stats.activeStreak || 0} दिन`
          : `Here are your ReviseCode statistics (queried live from Supabase):\n• **Total Tracked Questions:** ${stats.totalQuestions || 0}\n• **Completed Revisions:** ${stats.completedRevisions || 0}\n• **Pending Revisions:** ${stats.pendingRevisions || 0}\n• **Mastery Rate:** ${stats.masteryPercentage || 0}%\n• **Active Streak:** ${stats.activeStreak || 0} days`,
        actionCardHtml: `
          <div class="ai-action-card">
            <div class="ai-action-header"><i data-lucide="bar-chart"></i> Open Analytics</div>
            <div class="ai-action-actions">
              <a href="analytics.html" class="btn btn-primary btn-sm">${isHindi ? 'विस्तृत एनालिटिक्स देखें' : 'View Full Analytics'}</a>
            </div>
          </div>
        `,
        handled: true,
        data: stats
      };
    }

    // G. Follow-up resolution from conversation history
    const followUpResolved = this.resolveFollowUpContext(trimmed, lower, options.conversationHistory);
    const queryToAnswer = followUpResolved || trimmed;

    // H. Technical Knowledge Base (C++, Algorithms, Math, SQL, Web Dev in English, Hindi, Hinglish)
    const kbAnswer = knowledgeBaseService.answerQuestion(queryToAnswer, isHindi);
    if (kbAnswer) {
      return {
        text: `${kbAnswer.text}\n\n---\n*ℹ️ Answered via ReviseCode Technical Engine. (Configure \`GEMINI_API_KEY\` in \`backend/.env\` to enable live Google Gemini conversational LLM reasoning).*`,
        handled: true,
        mode: 'knowledge_base',
        topic: kbAnswer.topic
      };
    }

    // I. Provider-Unavailable Transparent Fallback
    if (options.geminiError) {
      const errDetail = options.geminiError.message || 'Upstream provider connection error';
      if (isHindi) {
        return {
          text: `### ⚠️ Google Gemini API सूचना
Google Gemini API कुंजी (**GEMINI_API_KEY**) कॉन्फ़िगर है, लेकिन प्रदाता से त्रुटि प्राप्त हुई:
> \`${errDetail}\`

असिस्टेंट अस्थायी रूप से **Grounded Workspace & Technical Engine Mode** में काम कर रहा है।

मैं अभी भी आपके इन प्रश्नों के सीधे उत्तर दे सकता हूँ:
• **लाइव रिवीजन ट्रैकिंग:** *"आज मैंने कितने questions solve किए हैं?"*, *"आज के पेंडिंग रिवीजन दिखाओ"*
• **कोडिंग प्रॉब्लम सत्यापन:** *"Verify LeetCode 50"*, *"Check Codeforces 4A"*
• **कोड सॉल्यूशन रिव्यू:** C++, Python, JavaScript कोड (syntax & edge cases)
• **तकनीकी अवधारणाएँ:** C++ (std::vector vs deque), DSA (Two pointers, Binary search, Dynamic programming), Math (Bayes Theorem), SQL`,
          handled: true,
          mode: 'grounded_workspace',
          geminiError: errDetail
        };
      }

      return {
        text: `### ⚠️ Google Gemini API Notice
Your Google Gemini API key (**GEMINI_API_KEY**) is configured in \`backend/.env\`, but the provider request failed:
> \`${errDetail}\`

The assistant is temporarily operating in **Grounded Workspace & Technical Engine Mode**.

You can directly query:
• **Workspace Tracking:** *"How many questions did I solve today?"*, *"Show today's pending revisions"*, *"Show overdue revisions"*
• **Problem Verification:** *"Verify LeetCode 50"*, *"Check Codeforces 4A"*
• **Code Review:** Paste any C++, Python, or JavaScript solution for compiler syntax check and edge-case review
• **Technical Concepts:** C++ (\`vector\` vs \`deque\`), DSA (Two Pointers, Binary Search, DP vs Divide & Conquer), Math (Bayes' Theorem), SQL`,
        handled: true,
        mode: 'grounded_workspace',
        geminiError: errDetail
      };
    }

    if (isHindi) {
      return {
        text: `मुझे आपका संदेश प्राप्त हुआ: *"#${trimmed}"*।

चूँकि बैकएंड में Google Gemini API कुंजी (**GEMINI_API_KEY**) अभी कॉन्फ़िगर नहीं है, मैं **Grounded Workspace & Technical Engine Mode** में काम कर रहा हूँ।

मैं आपके इन प्रश्नों के तुरंत और सटीक उत्तर दे सकता हूँ:
• **लाइव रिवीजन ट्रैकिंग:** *"आज मैंने कितने questions solve किए हैं?"*, *"आज के पेंडिंग रिवीजन दिखाओ"*, *"ओवरड्यू रिवीजन"*
• **कोडिंग प्रॉब्लम सत्यापन:** *"Verify LeetCode 50"*, *"Check Codeforces 4A"*
• **कोड सॉल्यूशन रिव्यू:** C++, Python, JavaScript कोड पेस्ट करें (syntax & logic analysis)
• **तकनीकी अवधारणाएँ:** C++ (std::vector vs deque), DSA (Two pointers, Binary search, Dynamic programming vs D&C), Math (Bayes Theorem), SQL.

सामान्य ओपन-डोमेन एआई बातचीत और प्राकृतिक भाषा कोडिंग सहायता को सक्रिय करने के लिए backend/.env में **GEMINI_API_KEY** जोड़ें।`,
        handled: true,
        mode: 'grounded_workspace'
      };
    }

    return {
      text: `I received your prompt: *"#${trimmed}"*.

As the Google Gemini API key (**GEMINI_API_KEY**) is not configured in \`backend/.env\`, the assistant is operating in **Grounded Workspace & Technical Engine Mode**.

I can directly assist with:
• **Workspace Tracking:** *"How many questions did I solve today?"*, *"Show today's pending revisions"*, *"Show overdue revisions"*, *"Show my stats"*
• **Problem Verification:** *"Verify LeetCode 50"*, *"Check Codeforces 4A"* (official platform existence check)
• **Code Review:** Paste any C++, Python, or JavaScript solution for compiler syntax check and edge-case review
• **Technical Concepts:** C++ (\`vector\` vs \`deque\`), DSA (Two Pointers, Binary Search, DP vs Divide & Conquer), Math (Bayes' Theorem), SQL

To enable unrestricted conversational AI across any arbitrary topic, configure **GEMINI_API_KEY** in your \`backend/.env\` file.`,
      handled: true,
      mode: 'grounded_workspace'
    };
  },

  /**
   * Resolves follow-up query pronouns (e.g. "what about its space complexity?", "explain it")
   * using the preceding messages in conversationHistory.
   */
  resolveFollowUpContext(currentPrompt, lower, conversationHistory = []) {
    if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) return null;

    const isFollowUp = lower.startsWith('what about') || lower.startsWith('and its') ||
      lower.includes('complexity') || lower.includes('example') || lower.includes('difference') ||
      lower.includes('isko') || lower.includes('iska') || lower.includes('kaise');

    if (!isFollowUp) return null;

    // Find the latest user query with a concrete topic
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role === 'user' && msg.text && msg.text !== currentPrompt) {
        const prev = msg.text.toLowerCase();
        if (prev.includes('binary search') || prev.includes('vector') || prev.includes('two pointer') ||
            prev.includes('quicksort') || prev.includes('bayes') || prev.includes('dynamic programming')) {
          return `${msg.text} ${currentPrompt}`;
        }
      }
    }
    return null;
  },

  formatProblemVerificationResponse(v, isHindi = false) {
    if (v.verified) {
      return `### ✅ Verified Problem: ${v.platform} ${v.problemNumber ? '#' + v.problemNumber : ''} — ${v.title}

• **Platform:** ${v.platform}
• **Difficulty:** ${v.difficulty || 'Not specified'}
• **Official Problem URL:** [${v.title}](${v.officialUrl})
• **Source Evidence:** ${v.sourceEvidence}

Would you like to add this problem to your ReviseCode tracker and schedule its 5 mandatory revision milestones (Day 3, 7, 12, 20, 30)?`;
    }

    return `### ⚠️ Problem Existence Verification

• **Platform:** ${v.platform}
• **Status:** **Unverified**
• **Details:** ${v.message}

*Note:* ReviseCode does not fabricate problem links or claim a problem exists without verified evidence. Please verify the problem number or title on the platform directly.`;
  },

  createProblemActionCard(v) {
    if (!v.verified) return '';
    return `
      <div class="ai-action-card">
        <div class="ai-action-header"><i data-lucide="check-circle"></i> Verified Problem Found</div>
        <div class="ai-action-body">
          <strong>${v.platform} ${v.problemNumber ? '#' + v.problemNumber : ''}: ${v.title}</strong><br>
          <span style="font-size: 12px; color: var(--text-muted);">${v.difficulty || 'Medium'} • Milestones: 3d, 7d, 12d, 20d, 30d</span>
        </div>
        <div class="ai-action-actions">
          <a href="${v.officialUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">Open on ${v.platform} ↗</a>
          <button class="btn btn-primary btn-sm ai-confirm-add-btn" data-number="${v.problemNumber || ''}" data-title="${v.title}" data-subject="DSA" data-topic="${v.title}">
            + Schedule Revisions
          </button>
        </div>
      </div>
    `;
  },

  formatCodeReviewResponse(review, isHindi = false) {
    let out = `### 🔍 Code Solution Review (${review.language.toUpperCase()})\n\n`;

    // 1. Syntax check
    if (review.syntax.supported) {
      if (review.syntax.passed) {
        out += `✅ **Syntax & Compilation:** ${review.syntax.message}\n\n`;
      } else {
        out += `❌ **Compilation/Syntax Error:**\n\`\`\`\n${review.syntax.errorDetails || review.syntax.message}\n\`\`\`\n\n`;
      }
    }

    // 2. Logic & Edge Cases
    if (review.bugs && review.bugs.length > 0) {
      out += `⚠️ **Identified Potential Bugs & Edge Cases:**\n`;
      for (const b of review.bugs) {
        out += `• **${b.title}** (${b.severity.toUpperCase()}):\n  ${b.description}\n  *Recommendation:* ${b.recommendation}\n\n`;
      }
    } else {
      out += `✅ **Logic & Edge Cases:** No obvious static anomalies detected in standard patterns.\n\n`;
    }

    // 3. Complexity
    out += `📊 **Complexity Estimate:**\n• **Time Complexity:** Typically $O(\\log n)$ for binary search / $O(n)$ for linear scan depending on bounds.\n• **Space Complexity:** $O(1)$ auxiliary memory.\n\n`;

    // 4. Verification notice
    out += `> **⚠️ Verification Notice:** ${review.verificationNotice}\n`;
    out += `> A syntactically valid code block does not guarantee full acceptance against hidden online judge edge cases. Run against automated test vectors for definitive verification.`;

    return out;
  },

  async executeCommand(command, payload = {}, userId = null) {
    if (!command) {
      return {
        handled: false,
        message: 'No command specified. Please provide a supported command.',
        clarificationNeeded: true,
        supportedCommands: ['show_due_revisions', 'show_overdue_revisions', 'list_questions', 'add_question', 'explain_solution']
      };
    }

    const normalized = command.toLowerCase().trim();

    // 1. Show Due Today Revisions
    if (normalized === 'show_due_revisions' || normalized === 'due_today') {
      const items = await revisionsService.getTodayRevisions(userId);
      return {
        handled: true,
        command: normalized,
        message: `Retrieved ${items.length} revision(s) due today.`,
        data: { items }
      };
    }

    // 2. Show Overdue Revisions
    if (normalized === 'show_overdue_revisions' || normalized === 'overdue') {
      const items = await revisionsService.getOverdueRevisions(userId);
      return {
        handled: true,
        command: normalized,
        message: `Retrieved ${items.length} overdue revision(s).`,
        data: { items }
      };
    }

    // 3. List Questions
    if (normalized === 'list_questions') {
      const result = await questionsService.getAllQuestions({
        search: payload.search || payload.keyword,
        subject: payload.subject,
        userId
      });
      return {
        handled: true,
        command: normalized,
        message: `Found ${result.items.length} question(s).`,
        data: result
      };
    }

    // 4. Add Question
    if (normalized === 'add_question') {
      if (!payload.title || !payload.platform) {
        return {
          handled: false,
          command: normalized,
          message: "Missing required details to add question: 'title' and 'platform' are required.",
          clarificationNeeded: true,
          examplePayload: {
            title: "Pow(x, n)",
            platform: "LeetCode",
            problemNumber: "50",
            difficulty: "Medium",
            subject: "DSA"
          }
        };
      }

      const created = await questionsService.createQuestion({
        title: payload.title,
        platform: payload.platform,
        problemNumber: payload.problemNumber || '',
        difficulty: payload.difficulty || 'Medium',
        subject: payload.subject || 'DSA',
        topic: payload.topic || 'General',
        approach: payload.approach || '',
        code: payload.code || '',
        dateSolved: payload.dateSolved,
        userId
      });

      return {
        handled: true,
        command: normalized,
        message: `Question "${created.title}" successfully added with 5 mandatory revision milestones (Day 3, 7, 12, 20, 30).`,
        data: { question: created }
      };
    }

    // 5. Explain Solution
    if (normalized === 'explain_solution') {
      const identifier = payload.questionId || payload.title || payload.search;
      if (!identifier) {
        return {
          handled: false,
          command: normalized,
          message: "Please specify a question title or ID to explain.",
          clarificationNeeded: true
        };
      }

      const searchResult = await questionsService.getAllQuestions({ search: identifier });
      const questions = searchResult.items || [];
      if (questions.length === 0) {
        return {
          handled: true,
          command: normalized,
          message: `No saved question found matching "${identifier}".`,
          data: null
        };
      }

      const target = questions[0];
      return {
        handled: true,
        command: normalized,
        message: `Solution explanation for "${target.title}" (${target.platform} ${target.problemNumber || ''}):`,
        data: {
          title: target.title,
          approach: target.approach || 'No detailed approach documented.',
          timeComplexity: target.timeComplexity,
          spaceComplexity: target.spaceComplexity,
          notes: target.notes
        }
      };
    }

    // Unsupported Command (returns 400 when strictly invoking /command endpoint)
    return {
      handled: false,
      command: normalized,
      message: `Unsupported command: "${command}". For unrestricted natural language reasoning, connect an external LLM provider.`,
      supportedCommands: ['show_due_revisions', 'show_overdue_revisions', 'list_questions', 'add_question', 'explain_solution']
    };
  }
};
