/**
 * ReviseCode Bilingual Voice Input & Web Speech API Test Suite
 * Tests VoiceInputController across Hindi (hi-IN), English (en-IN), Auto language selection,
 * Devanagari text preservation, error handling, and browser fallbacks.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Setup minimal globals before importing browser modules in Node test runner
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { origin: 'http://localhost:3000', pathname: '/ai-assistant.html' },
    addEventListener: () => {}
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => []
  };
}

const { VoiceInputController, VOICE_LANGUAGE_STORAGE_KEY, isTodaySolvedQuestionsQuery } = await import('../js/ai-assistant.js');

// Minimal DOM Element Mock for Headless Unit Validation
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.value = '';
    this.title = '';
    this.textContent = '';
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.classList = {
      _classes: new Set(),
      add: (cls) => this.classList._classes.add(cls),
      remove: (cls) => this.classList._classes.delete(cls),
      contains: (cls) => this.classList._classes.has(cls)
    };
    this.scrollHeight = 24;
    this._focused = false;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event) {
    const type = event.type || event;
    if (this.listeners[type]) {
      this.listeners[type].forEach(fn => fn(event));
    }
  }

  focus() {
    this._focused = true;
  }
}

// Mock SpeechRecognition Class
class MockSpeechRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = '';
    this.maxAlternatives = 1;

    this.onstart = null;
    this.onaudiostart = null;
    this.onspeechstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;

    this.started = false;
    this.aborted = false;
    this.stopped = false;
  }

  start() {
    this.started = true;
    if (typeof this.onstart === 'function') {
      this.onstart();
    }
  }

  stop() {
    this.stopped = true;
    if (typeof this.onend === 'function') {
      this.onend();
    }
  }

  abort() {
    this.aborted = true;
    if (typeof this.onend === 'function') {
      this.onend();
    }
  }

  // Helper to simulate speech result event
  simulateResult(resultsArray) {
    if (typeof this.onresult === 'function') {
      this.onresult({
        resultIndex: 0,
        results: resultsArray
      });
    }
  }

  // Helper to simulate error
  simulateError(errorType) {
    if (typeof this.onerror === 'function') {
      this.onerror({ error: errorType });
    }
  }
}

describe('VoiceInputController - Bilingual Web Speech API Integration', () => {
  let micBtn, langSelect, langBadge, inputElement, statusContainer, statusText, cancelBtn, inputForm;
  let mockStorage;
  let toasts = [];

  const mockToast = (title, message, type) => {
    toasts.push({ title, message, type });
  };

  beforeEach(() => {
    micBtn = new MockElement('chatMicBtn', 'button');
    langSelect = new MockElement('voiceLangSelect', 'select');
    langBadge = new MockElement('voiceLangBadge', 'span');
    inputElement = new MockElement('chatInputTextarea', 'textarea');
    statusContainer = new MockElement('voiceStatusIndicator', 'div');
    statusText = new MockElement('voiceStatusText', 'span');
    cancelBtn = new MockElement('voiceCancelBtn', 'button');
    inputForm = new MockElement('chatInputForm', 'form');
    toasts = [];

    const map = new Map();
    mockStorage = {
      getItem: (k) => map.get(k) || null,
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k)
    };
  });

  test('Fallback Behavior: Gracefully handles unsupported browsers', () => {
    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      SpeechRecognitionClass: null,
      onToast: mockToast
    });

    assert.equal(controller.isSupported(), false);
    assert.match(micBtn.title, /not supported in this browser/i);

    micBtn.onclick();

    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].type, 'warning');
    assert.match(toasts[0].message, /Google Chrome, Microsoft Edge, or Safari/i);
    assert.equal(statusContainer.style.display, undefined);
  });

  test('Requirement 3: When Hindi is selected, configures recognition.lang = "hi-IN"', async () => {
    mockStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, 'hi-IN');

    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    assert.equal(controller.selectedLang, 'hi-IN');
    assert.equal(langSelect.value, 'hi-IN');

    await controller.startListening();

    assert.ok(controller.recognition, 'Recognition instance should be created');
    assert.equal(controller.recognition.lang, 'hi-IN', 'recognition.lang MUST be "hi-IN"');
    assert.equal(langBadge.textContent, 'HI', 'Lang badge should show "HI"');
    assert.match(statusText.textContent, /Hindi/i, 'Status text should mention Hindi');
    assert.match(statusText.textContent, /हिंदी में स्पष्ट बोलें/i, 'Status text should show Hindi instructions');
  });

  test('Requirement 4: When English is selected, configures recognition.lang = "en-IN"', async () => {
    mockStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, 'en-IN');

    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    assert.equal(controller.selectedLang, 'en-IN');
    assert.equal(langSelect.value, 'en-IN');

    await controller.startListening();

    assert.ok(controller.recognition);
    assert.equal(controller.recognition.lang, 'en-IN', 'recognition.lang MUST be "en-IN"');
    assert.equal(langBadge.textContent, 'EN', 'Lang badge should show "EN"');
    assert.match(statusText.textContent, /English/i, 'Status text should mention English');
  });

  test('Requirement 2: Automatic language selection resolves to browser default locale', async () => {
    const mockNavHindi = {
      language: 'hi-IN',
      permissions: null
    };

    const controllerHindi = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      navigator: mockNavHindi,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    controllerHindi.setLanguage('auto');
    await controllerHindi.startListening();
    assert.equal(controllerHindi.recognition.lang, 'hi-IN', 'Auto should resolve to hi-IN when browser language is Hindi');

    const mockNavEng = {
      language: 'en-US',
      permissions: null
    };

    const controllerEng = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      navigator: mockNavEng,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    controllerEng.setLanguage('auto');
    await controllerEng.startListening();
    assert.equal(controllerEng.recognition.lang, 'en-IN', 'Auto should default to en-IN for non-Hindi browser locales');
  });

  test('Requirement 5 & 6: Preserves Hindi text in Devanagari script without auto-translating', async () => {
    mockStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, 'hi-IN');

    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    inputElement.value = '';
    await controller.startListening();

    // 1. Interim Devanagari Hindi hypothesis
    controller.recognition.simulateResult([
      [{ transcript: 'आज के' }]
    ]);
    assert.equal(inputElement.value, 'आज के', 'Should display raw Devanagari script in chat input');

    // 2. Final Devanagari transcript
    const finalResult = [{ transcript: 'आज के रिवीजन दिखाओ' }];
    finalResult.isFinal = true;

    controller.recognition.simulateResult([finalResult]);
    assert.equal(inputElement.value, 'आज के रिवीजन दिखाओ', 'Should preserve exact Devanagari text');

    // 3. Stop recognition
    controller.recognition.stop();
    assert.equal(controller.isListening, false);
    assert.equal(inputElement._focused, true, 'Chat input should remain focused for user review');
    assert.equal(toasts.some(t => t.type === 'success' && /Hindi/i.test(t.message)), true, 'Should confirm Hindi speech recognition');
  });

  test('Requirement 5: Preserves English text in chat input', async () => {
    mockStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, 'en-IN');

    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    inputElement.value = '';
    await controller.startListening();

    const finalResult = [{ transcript: 'Show today pending revisions' }];
    finalResult.isFinal = true;

    controller.recognition.simulateResult([finalResult]);
    assert.equal(inputElement.value, 'Show today pending revisions');

    controller.recognition.stop();
    assert.equal(toasts.some(t => t.type === 'success' && /English/i.test(t.message)), true);
  });

  test('Requirement 5: Appends Hindi speech to preexisting input text cleanly', async () => {
    mockStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, 'hi-IN');

    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    inputElement.value = 'LeetCode 50';
    await controller.startListening();

    const finalResult = [{ transcript: 'का हल समझाओ' }];
    finalResult.isFinal = true;

    controller.recognition.simulateResult([finalResult]);
    assert.equal(inputElement.value, 'LeetCode 50 का हल समझाओ', 'Should combine existing text and Hindi speech seamlessly');
  });

  test('Requirement 7: Handles language-not-supported error by falling back to en-IN with clear message', async () => {
    mockStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, 'hi-IN');

    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    await controller.startListening();
    assert.equal(controller.isListening, true);

    // Simulate browser reporting language-not-supported
    controller.recognition.simulateError('language-not-supported');

    assert.equal(controller.isListening, false);
    assert.equal(controller.selectedLang, 'en-IN', 'Should fall back to en-IN');
    assert.equal(langSelect.value, 'en-IN', 'Dropdown should update to en-IN');

    const langToast = toasts.find(t => t.type === 'error' && /Language Not Supported/i.test(t.title));
    assert.ok(langToast, 'Should display language-not-supported error toast');
    assert.match(langToast.message, /Falling back to English \(India\)/i, 'Should explain the fallback alternative');
    assert.match(langToast.message, /Google Chrome or Microsoft Edge/i, 'Should recommend Chrome or Edge');
  });

  test('Requirement 9: Seamless language switching persists preference and updates active recognition', async () => {
    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    // Default is en-IN
    assert.equal(controller.selectedLang, 'en-IN');

    // Switch dropdown to hi-IN
    await controller.setLanguage('hi-IN');
    assert.equal(controller.selectedLang, 'hi-IN');
    assert.equal(mockStorage.getItem(VOICE_LANGUAGE_STORAGE_KEY), 'hi-IN');

    // Start listening
    await controller.startListening();
    assert.equal(controller.recognition.lang, 'hi-IN');

    // Switch to en-IN while listening
    await controller.setLanguage('en-IN');
    assert.equal(controller.selectedLang, 'en-IN');
    assert.equal(controller.recognition.lang, 'en-IN', 'Should restart and reconfigure recognition.lang to en-IN');
  });

  test('Error States: Handles not-allowed, no-speech, audio-capture, and network errors', async () => {
    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    await controller.startListening();
    controller.recognition.simulateError('not-allowed');
    assert.ok(toasts.some(t => t.type === 'error' && /Permission/i.test(t.title)));

    toasts = [];
    await controller.startListening();
    controller.recognition.simulateError('no-speech');
    assert.ok(toasts.some(t => t.type === 'info' && /No Speech/i.test(t.title)));

    toasts = [];
    await controller.startListening();
    controller.recognition.simulateError('audio-capture');
    assert.ok(toasts.some(t => t.type === 'error' && /No Microphone/i.test(t.title)));

    toasts = [];
    await controller.startListening();
    controller.recognition.simulateError('network');
    assert.ok(toasts.some(t => t.type === 'error' && /Network/i.test(t.title)));
  });

  test('Cancel button: Aborts recognition and restores original text', async () => {
    mockStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, 'hi-IN');

    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    inputElement.value = 'मूल पाठ';
    await controller.startListening();

    controller.recognition.simulateResult([
      [{ transcript: 'अस्थायी शब्द' }]
    ]);
    assert.equal(inputElement.value, 'मूल पाठ अस्थायी शब्द');

    // User clicks Cancel
    cancelBtn.onclick();

    assert.equal(controller.isListening, false);
    assert.equal(inputElement.value, 'मूल पाठ', 'Original text should be restored');
    assert.equal(statusContainer.style.display, 'none');
  });

  test('Requirement 2 & 3: Selecting Hinglish configures recognition with hi-IN and HING badge', async () => {
    mockStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, 'hinglish');

    const controller = new VoiceInputController({
      micBtn,
      langSelect,
      langBadge,
      inputElement,
      statusContainer,
      statusText,
      cancelBtn,
      inputForm,
      localStorage: mockStorage,
      SpeechRecognitionClass: MockSpeechRecognition,
      onToast: mockToast
    });

    assert.equal(controller.selectedLang, 'hinglish');
    assert.equal(controller.activeResolvedLang, 'hi-IN');

    await controller.startListening();
    assert.equal(controller.recognition.lang, 'hi-IN');
    assert.equal(langBadge.textContent, 'HING');
    assert.match(statusText.textContent, /Hinglish/i);
  });

  test('Requirement 4 & 5: isTodaySolvedQuestionsQuery matches all Hindi, English, and Hinglish phrasings without discarding words', () => {
    const targetPhrasings = [
      'आज मैंने कितने questions solve किए?',
      'आज मैंने कितने सवाल हल किए?',
      'आज कितने questions solve हुए?',
      'Maine aaj kitne questions solve kiye?',
      'Aaj maine kitne question solve kiye hain?',
      'How many questions did I solve today?',
      'मैंने आज कितने सवाल हल किए?',
      'आज मैंने कितने questions solve किए हैं?',
      'how many problems did i solve today?',
      'questions solved today',
      'aaj kitne sawal hal kiye'
    ];

    for (const phrase of targetPhrasings) {
      assert.equal(isTodaySolvedQuestionsQuery(phrase), true, `Failed matching phrase: "${phrase}"`);
    }

    // Negative controls
    assert.equal(isTodaySolvedQuestionsQuery("Show today's revisions"), false);
    assert.equal(isTodaySolvedQuestionsQuery("What is binary search?"), false);
  });
});
