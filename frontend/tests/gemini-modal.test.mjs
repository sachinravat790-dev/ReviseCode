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
    addEventListener: () => {},
    lucide: { createIcons: () => {} }
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => []
  };
}

const { setupGeminiModal } = await import('../js/ai-assistant.js');

// Minimal mock element
function createMockElement(id, tag = 'div') {
  const listeners = {};
  return {
    id,
    tagName: tag.toUpperCase(),
    textContent: '',
    innerHTML: '',
    value: '',
    type: 'password',
    style: {},
    classList: {
      classes: new Set(),
      add(cls) { this.classes.add(cls); },
      remove(cls) { this.classes.delete(cls); },
      contains(cls) { return this.classes.has(cls); }
    },
    disabled: false,
    onclick: null,
    onsubmit: null,
    addEventListener(event, handler) { listeners[event] = handler; this[`on${event}`] = handler; },
    removeEventListener(event) { delete listeners[event]; delete this[`on${event}`]; }
  };
}

describe('setupGeminiModal - UI and Diagnostic Controller', () => {
  let elements;

  beforeEach(() => {
    elements = {
      geminiConfigModal: createMockElement('geminiConfigModal'),
      geminiConfigBtn: createMockElement('geminiConfigBtn', 'button'),
      aiCardActionBtn: createMockElement('aiCardActionBtn', 'button'),
      closeGeminiModalBtn: createMockElement('closeGeminiModalBtn', 'button'),
      geminiKeyForm: createMockElement('geminiKeyForm', 'form'),
      geminiApiKeyInput: createMockElement('geminiApiKeyInput', 'input'),
      toggleGeminiKeyVisibility: createMockElement('toggleGeminiKeyVisibility', 'button'),
      testGeminiBtn: createMockElement('testGeminiBtn', 'button'),
      removeGeminiBtn: createMockElement('removeGeminiBtn', 'button'),
      saveGeminiBtn: createMockElement('saveGeminiBtn', 'button'),
      geminiTestFeedback: createMockElement('geminiTestFeedback'),
      geminiStatusBanner: createMockElement('geminiStatusBanner'),
      geminiCurrentKeyLabel: createMockElement('geminiCurrentKeyLabel'),
      aiModeBadge: createMockElement('aiModeBadge'),
      aiCardEngineTitle: createMockElement('aiCardEngineTitle'),
      aiCardDesc: createMockElement('aiCardDesc'),
      aiCardStatusDot: createMockElement('aiCardStatusDot')
    };

    globalThis.document.getElementById = (id) => elements[id] || null;
  });

  test('setupGeminiModal attaches open and close handlers', () => {
    const controller = setupGeminiModal();

    assert.ok(controller);
    assert.equal(typeof controller.openModal, 'function');
    assert.equal(typeof controller.closeModal, 'function');

    controller.openModal();
    assert.equal(elements.geminiConfigModal.classList.contains('is-open'), true);

    controller.closeModal();
    assert.equal(elements.geminiConfigModal.classList.contains('is-open'), false);
  });

  test('toggleGeminiKeyVisibility switches input type between password and text', () => {
    setupGeminiModal();

    assert.equal(elements.geminiApiKeyInput.type, 'password');

    // Click toggle
    elements.toggleGeminiKeyVisibility.onclick();
    assert.equal(elements.geminiApiKeyInput.type, 'text');

    // Click toggle again
    elements.toggleGeminiKeyVisibility.onclick();
    assert.equal(elements.geminiApiKeyInput.type, 'password');
  });

  test('closeGeminiModalBtn and outside backdrop close dialog', () => {
    const controller = setupGeminiModal();
    controller.openModal();
    assert.equal(elements.geminiConfigModal.classList.contains('is-open'), true);

    // Click close button
    elements.closeGeminiModalBtn.onclick();
    assert.equal(elements.geminiConfigModal.classList.contains('is-open'), false);

    // Reopen and click outside backdrop
    controller.openModal();
    assert.equal(elements.geminiConfigModal.classList.contains('is-open'), true);
    elements.geminiConfigModal.onclick({ target: elements.geminiConfigModal });
    assert.equal(elements.geminiConfigModal.classList.contains('is-open'), false);
  });
});
