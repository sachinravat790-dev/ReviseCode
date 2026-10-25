/**
 * ReviseCode AI Assistant Controller (js/ai-assistant.js)
 * Clean architecture ready for Gemini/Backend LLM integration.
 * Runs in transparent Development/Demo Mode with deterministic mock handlers for requested commands.
 */

import { api } from './api.js';
import { StorageManager } from './storage.js';
import { showToast, showConfirmModal } from './navigation.js';
import { formatDate } from './app.js';

const CHAT_HISTORY_KEY = 'revisecode_chat_history';
export const VOICE_LANGUAGE_STORAGE_KEY = 'revisecode_voice_language';

// Default welcome conversation
const DEFAULT_CONVERSATION = [
  {
    role: 'ai',
    text: `Hello Sachin! I am your **ReviseCode AI Companion** (currently running in Demo Mode). 

I can help you log questions, inspect your revision schedule, analyze recall performance, and reinforce your memory.
I now support **bilingual Hindi and English voice input** (हिंदी और अंग्रेज़ी)!

Try one of the suggested prompts below or ask:
• *"Add LeetCode 50 to my revision tracker"*
• *"Show today's pending revisions"* or *"आज के रिवीजन दिखाओ"*
• *"Which questions are overdue?"* or *"कौन से प्रश्न बाकी हैं?"*
• *"Explain my saved binary search solution"* or *"बाइनरी सर्च समझाओ"*
• *"Show questions I marked as difficult"* or *"कठिन प्रश्न दिखाओ"*`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
];

/**
 * Recognizes all equivalent Hindi, English, and Hinglish questions for today's solved problems:
 * - "आज मैंने कितने questions solve किए?"
 * - "आज मैंने कितने सवाल हल किए?"
 * - "आज कितने questions solve हुए?"
 * - "Maine aaj kitne questions solve kiye?"
 * - "Aaj maine kitne question solve kiye hain?"
 * - "How many questions did I solve today?"
 */
export function isTodaySolvedQuestionsQuery(text) {
  if (!text || typeof text !== 'string') return false;
  const raw = text.trim();
  const lower = raw.toLowerCase().replace(/[?!,.:;|।\'\"\(\)]/g, ' ').replace(/\s+/g, ' ').trim();

  // Pure revision queries are excluded unless solve/hal is explicitly mentioned
  const isRevisionExclusive = /\b(revisions?|milestones?)\b/i.test(lower) && !/\b(solve|solved|hal)\b/i.test(lower);
  if (isRevisionExclusive) return false;

  // 1. Must refer to today (English "today", Hinglish "aaj", Hindi "आज")
  const hasToday = /\b(today|aaj|aajke|aajka)\b/i.test(lower) || /आज/.test(raw);

  // 2. Entity: questions / problems / sawal / prashna
  const hasEntity = /\b(question|questions|problem|problems|sawal|prashna|prashn|ques|que)\b/i.test(lower) || 
    /(क्वेश्चन|क्वेश्चंस|प्रश्न|सवाल|प्रश्नों|सवालों)/.test(raw);

  // 3. Action: solved / hal / kiya / kiye / hue / done / kare
  const hasAction = /\b(solve|solved|solving|hal|kare|kiye|kiya|hue|done)\b/i.test(lower) ||
    /(सॉल्व|सॉल्व्ड|हल|किए|किया|हुए|करे)/.test(raw);

  // 4. Quantity / Query intent: how many / kitne / count / number of
  const hasQuantity = /\b(how many|count|number of|kitne|kitna|kitni)\b/i.test(lower) ||
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

  return exactPatterns.some(regex => regex.test(lower) || regex.test(raw));
}

/**
 * Browser Speech Recognition Controller (Web Speech API)
 * Coordinates bilingual (hi-IN / en-IN / auto) speech-to-text, listening states, and error handling.
 */
export class VoiceInputController {
  constructor(options = {}) {
    this.micBtn = options.micBtn || document.getElementById('chatMicBtn');
    this.langSelect = options.langSelect || document.getElementById('voiceLangSelect');
    this.langBadge = options.langBadge || document.getElementById('voiceLangBadge');
    this.inputElement = options.inputElement || document.getElementById('chatInputTextarea');
    this.statusContainer = options.statusContainer || document.getElementById('voiceStatusIndicator');
    this.statusText = options.statusText || document.getElementById('voiceStatusText');
    this.cancelBtn = options.cancelBtn || document.getElementById('voiceCancelBtn');
    this.inputForm = options.inputForm || document.getElementById('chatInputForm');
    this.SpeechRecognitionClass = options.SpeechRecognitionClass !== undefined
      ? options.SpeechRecognitionClass
      : (typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null);
    this.navigator = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    this.localStorage = options.localStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.onToast = options.onToast || showToast;

    this.selectedLang = this.getInitialLanguage(); // 'en-IN', 'hi-IN', or 'auto'
    this.activeResolvedLang = this.resolveEffectiveLanguage(this.selectedLang);
    this.recognition = null;
    this.isListening = false;
    this.baseText = '';
    this.finalTranscript = '';
    this.interimTranscript = '';

    this.bindEvents();
  }

  isSupported() {
    return Boolean(this.SpeechRecognitionClass);
  }

  getInitialLanguage() {
    try {
      if (this.localStorage) {
        const saved = this.localStorage.getItem(VOICE_LANGUAGE_STORAGE_KEY);
        if (saved && (saved === 'en-IN' || saved === 'hi-IN' || saved === 'hinglish' || saved === 'auto')) {
          return saved;
        }
      }
    } catch (_) {}

    // Check if browser preferred language starts with 'hi'
    if (this.navigator && this.navigator.language && this.navigator.language.toLowerCase().startsWith('hi')) {
      return 'hi-IN';
    }
    return 'en-IN';
  }

  resolveEffectiveLanguage(langCode) {
    if (langCode === 'hi-IN') return 'hi-IN';
    if (langCode === 'en-IN') return 'en-IN';
    if (langCode === 'hinglish') {
      // In Web Speech API, 'hi-IN' provides bilingual Hindi/English acoustic modeling
      return 'hi-IN';
    }

    // 'auto' mode:
    // Browser SpeechRecognition requires an explicit BCP-47 tag and does not support
    // simultaneous multi-language decoding on a single stream.
    // In Auto mode, resolve to user's browser default locale.
    if (this.navigator) {
      const navLang = (this.navigator.language || '').toLowerCase();
      if (navLang.startsWith('hi')) {
        return 'hi-IN';
      }
    }
    return 'en-IN';
  }

  async setLanguage(langCode) {
    const valid = langCode === 'hi-IN' || langCode === 'en-IN' || langCode === 'hinglish' || langCode === 'auto';
    this.selectedLang = valid ? langCode : 'en-IN';
    this.activeResolvedLang = this.resolveEffectiveLanguage(this.selectedLang);

    try {
      if (this.localStorage) {
        this.localStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, this.selectedLang);
      }
    } catch (_) {}

    if (this.langSelect && this.langSelect.value !== this.selectedLang) {
      this.langSelect.value = this.selectedLang;
    }

    // If currently listening, seamlessly restart recognition with the new language
    if (this.isListening) {
      this.stopListening({ cancelled: false });
      await this.startListening();
    }
  }

  async checkMicrophonePermission() {
    if (this.navigator && this.navigator.permissions && typeof this.navigator.permissions.query === 'function') {
      try {
        const status = await this.navigator.permissions.query({ name: 'microphone' });
        return status.state; // 'granted', 'prompt', 'denied'
      } catch (e) {
        // Some browser engines throw on { name: 'microphone' } query
        return 'unknown';
      }
    }
    return 'unknown';
  }

  bindEvents() {
    if (this.langSelect) {
      this.langSelect.value = this.selectedLang;
      this.langSelect.onchange = () => {
        this.setLanguage(this.langSelect.value);
      };
    }

    if (!this.micBtn) return;

    if (!this.isSupported()) {
      this.micBtn.title = 'Speech recognition not supported in this browser (Use Chrome, Edge, or Safari)';
      this.micBtn.onclick = () => {
        this.onToast(
          'Voice Input Unsupported',
          'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari for voice input.',
          'warning'
        );
      };
      return;
    }

    this.micBtn.title = 'Click to speak (Voice input)';
    this.micBtn.onclick = () => this.toggleListening();

    if (this.cancelBtn) {
      this.cancelBtn.onclick = () => this.stopListening({ cancelled: true });
    }
  }

  createRecognitionInstance() {
    if (!this.isSupported()) return null;

    try {
      const recognition = new this.SpeechRecognitionClass();
      recognition.continuous = false; // Stop naturally when speech pauses
      recognition.interimResults = true; // Stream interim results in real-time
      recognition.maxAlternatives = 1;

      // Configure BCP-47 language tag:
      // When Hindi is selected: "hi-IN"
      // When English is selected: "en-IN"
      // When Auto is selected: resolved browser default ("hi-IN" or "en-IN")
      this.activeResolvedLang = this.resolveEffectiveLanguage(this.selectedLang);
      recognition.lang = this.activeResolvedLang;

      recognition.onstart = () => {
        this.isListening = true;
        this.baseText = this.inputElement ? this.inputElement.value : '';
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.setUiState('listening');
      };

      recognition.onaudiostart = () => {
        // Audio capture hardware active
      };

      recognition.onspeechstart = () => {
        this.setUiState('speech_detected');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let finalSegment = '';

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          const transcript = item[0]?.transcript || '';
          if (item.isFinal) {
            finalSegment += transcript;
          } else {
            interim += transcript;
          }
        }

        this.finalTranscript = finalSegment.trim();
        this.interimTranscript = interim.trim();

        const currentSpoken = [this.finalTranscript, this.interimTranscript].filter(Boolean).join(' ').trim();
        this.updateInputValue(currentSpoken);
      };

      recognition.onerror = (event) => {
        const error = event.error;
        this.handleError(error);
        this.isListening = false;
        this.setUiState('idle');
      };

      recognition.onend = () => {
        const capturedText = (this.finalTranscript || this.interimTranscript || '').trim();
        this.isListening = false;
        this.setUiState('idle');

        if (capturedText) {
          const langName = this.selectedLang === 'hinglish'
            ? 'Hinglish (हिंग्लिश)'
            : (this.activeResolvedLang === 'hi-IN' ? 'Hindi (हिंदी)' : 'English');
          this.onToast(
            'Voice Input Captured',
            `${langName} speech recognized. Review or edit your message before sending.`,
            'success'
          );
        }

        if (this.inputElement) {
          this.inputElement.focus();
        }
      };

      return recognition;
    } catch (err) {
      console.error('Failed to create SpeechRecognition instance:', err);
      return null;
    }
  }

  updateInputValue(spokenText) {
    if (!this.inputElement) return;
    if (!spokenText) return;

    let newValue = spokenText;
    if (this.baseText && this.baseText.trim()) {
      const trimmedBase = this.baseText.trim();
      newValue = `${trimmedBase} ${spokenText}`;
    }

    this.inputElement.value = newValue;
    this.inputElement.style.height = 'auto';
    this.inputElement.style.height = `${Math.min(this.inputElement.scrollHeight, 120)}px`;
    this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async toggleListening() {
    if (this.isListening) {
      this.stopListening({ cancelled: false });
    } else {
      await this.startListening();
    }
  }

  async startListening() {
    if (!this.isSupported()) {
      this.onToast(
        'Voice Input Unsupported',
        'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari for voice input.',
        'warning'
      );
      return;
    }

    // Pre-flight permission check where supported
    const permState = await this.checkMicrophonePermission();
    if (permState === 'denied') {
      this.handleError('not-allowed');
      return;
    }

    try {
      this.recognition = this.createRecognitionInstance();
      if (!this.recognition) return;
      this.recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      if (err.name === 'InvalidStateError' && this.recognition) {
        try {
          this.recognition.stop();
        } catch (_) {}
      } else if (err.name === 'NotAllowedError') {
        this.handleError('not-allowed');
      }
      this.isListening = false;
      this.setUiState('idle');
    }
  }

  stopListening({ cancelled = false } = {}) {
    if (cancelled && this.inputElement && this.baseText !== undefined) {
      this.inputElement.value = this.baseText;
      this.inputElement.style.height = 'auto';
      this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (this.recognition) {
      try {
        if (cancelled) {
          this.recognition.abort();
        } else {
          this.recognition.stop();
        }
      } catch (e) {
        // Safe to ignore if already stopped
      }
    }

    this.isListening = false;
    this.setUiState('idle');
  }

  handleError(error) {
    switch (error) {
      case 'not-allowed':
      case 'service-not-allowed':
        this.onToast(
          'Microphone Permission Denied',
          'Please allow microphone access in your browser site settings to use voice input.',
          'error'
        );
        break;
      case 'language-not-supported':
        this.onToast(
          'Language Not Supported',
          `Speech recognition for "${this.activeResolvedLang}" is not supported by your browser engine. Falling back to English (India). Try Google Chrome or Microsoft Edge for native Hindi/English speech models.`,
          'error'
        );
        this.setLanguage('en-IN');
        break;
      case 'no-speech':
        this.onToast(
          'No Speech Detected',
          'No speech was detected. Click the microphone to try again.',
          'info'
        );
        break;
      case 'audio-capture':
        this.onToast(
          'No Microphone Detected',
          'Could not capture audio. Please verify your microphone is connected and enabled.',
          'error'
        );
        break;
      case 'network':
        this.onToast(
          'Network Error',
          'Speech recognition network service error. Please check your internet connection.',
          'error'
        );
        break;
      case 'aborted':
        // User cancelled, quiet reset
        break;
      default:
        this.onToast(
          'Voice Input Issue',
          `Speech recognition reported: ${error || 'unknown issue'}.`,
          'warning'
        );
        break;
    }
  }

  setUiState(state) {
    const isHinglish = this.selectedLang === 'hinglish';
    const isHindi = this.activeResolvedLang === 'hi-IN';
    const langBadgeText = isHinglish ? 'HING' : (isHindi ? 'HI' : 'EN');

    if (this.langBadge) {
      this.langBadge.textContent = langBadgeText;
      this.langBadge.title = `Active recognition language: ${isHinglish ? 'Hinglish (hi-IN)' : this.activeResolvedLang}`;
    }

    if (state === 'listening') {
      if (this.micBtn) {
        this.micBtn.classList.add('is-listening');
        this.micBtn.title = isHinglish
          ? 'हिंग्लिश सुन रहा है... समाप्त करने के लिए क्लिक करें'
          : (isHindi ? 'सुन रहा है... समाप्त करने के लिए क्लिक करें' : 'Listening... Click to finish speaking');
        this.micBtn.setAttribute('aria-label', 'Stop listening');
      }
      if (this.inputForm) {
        this.inputForm.classList.add('is-listening');
      }
      if (this.statusContainer) {
        this.statusContainer.style.display = 'flex';
      }
      if (this.statusText) {
        if (isHinglish) {
          this.statusText.textContent = 'Listening in Hinglish (हिंग्लिश)... हिंदी या English में बोलें';
        } else if (isHindi) {
          this.statusText.textContent = this.selectedLang === 'auto'
            ? 'Listening (Auto: hi-IN)... हिंदी में बोलें'
            : 'Listening in Hindi (hi-IN)... हिंदी में स्पष्ट बोलें';
        } else {
          this.statusText.textContent = this.selectedLang === 'auto'
            ? 'Listening (Auto: en-IN)... Speak now'
            : 'Listening in English (en-IN)... Speak clearly';
        }
      }
    } else if (state === 'speech_detected') {
      if (this.statusText) {
        if (isHinglish) {
          this.statusText.textContent = 'Transcribing Hinglish speech...';
        } else if (isHindi) {
          this.statusText.textContent = 'Transcribing Hindi speech (देवनागरी)...';
        } else {
          this.statusText.textContent = 'Transcribing English speech...';
        }
      }
    } else {
      // Idle
      if (this.micBtn) {
        this.micBtn.classList.remove('is-listening');
        this.micBtn.title = 'Click to speak (Voice input)';
        this.micBtn.setAttribute('aria-label', 'Voice input');
      }
      if (this.inputForm) {
        this.inputForm.classList.remove('is-listening');
      }
      if (this.statusContainer) {
        this.statusContainer.style.display = 'none';
      }
    }
  }
}

/**
 * Coordinates Google Gemini API configuration, diagnostic testing, and live status UI.
 */
export function setupGeminiModal() {
  const modal = document.getElementById('geminiConfigModal');
  const openBtn = document.getElementById('geminiConfigBtn');
  const cardActionBtn = document.getElementById('aiCardActionBtn');
  const closeBtn = document.getElementById('closeGeminiModalBtn');
  const form = document.getElementById('geminiKeyForm');
  const keyInput = document.getElementById('geminiApiKeyInput');
  const toggleVisibilityBtn = document.getElementById('toggleGeminiKeyVisibility');
  const testBtn = document.getElementById('testGeminiBtn');
  const removeBtn = document.getElementById('removeGeminiBtn');
  const feedbackEl = document.getElementById('geminiTestFeedback');
  const bannerEl = document.getElementById('geminiStatusBanner');
  const currentKeyLabel = document.getElementById('geminiCurrentKeyLabel');

  const badge = document.getElementById('aiModeBadge');
  const cardTitle = document.getElementById('aiCardEngineTitle');
  const cardDesc = document.getElementById('aiCardDesc');
  const cardDot = document.getElementById('aiCardStatusDot');

  let currentStatus = { configured: false, activeModel: '', apiKeyMasked: '' };

  async function refreshStatus() {
    try {
      const res = await api.get('/assistant/status');
      if (res && res.data) {
        currentStatus = res.data;
        updateUI();
      }
    } catch (err) {
      console.warn('Failed to load Gemini status:', err);
    }
  }

  function updateUI() {
    const isConfigured = Boolean(currentStatus.configured);

    // Update Header Badge
    if (badge) {
      if (isConfigured) {
        badge.innerHTML = `<span style="color: #10b981;">●</span> Ready • Google Gemini (${currentStatus.activeModel || 'gemini-3-flash-preview'})`;
      } else {
        badge.innerHTML = `<span style="color: #64748b;">●</span> Ready • Grounded Workspace Mode`;
      }
    }

    // Update Sidebar Card
    if (cardTitle) {
      cardTitle.textContent = isConfigured ? (currentStatus.activeModel || 'Google Gemini 3 Flash') : 'Grounded Workspace';
    }
    if (cardDesc) {
      cardDesc.textContent = isConfigured
        ? `Connected to Google Gemini API (${currentStatus.apiKeyMasked || 'Active'}). Arbitrary questions supported.`
        : 'Running on local grounded database & technical knowledge engine.';
    }
    if (cardDot) {
      cardDot.style.backgroundColor = isConfigured ? 'var(--success)' : 'var(--warning)';
    }
    if (cardActionBtn) {
      cardActionBtn.textContent = isConfigured ? 'Gemini Settings & Test' : 'Configure Gemini API';
    }

    // Update Modal Banner
    if (bannerEl) {
      if (isConfigured) {
        bannerEl.style.background = 'rgba(16, 185, 129, 0.12)';
        bannerEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        bannerEl.style.color = '#10b981';
        bannerEl.innerHTML = `
          <i data-lucide="check-circle" style="width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px;"></i>
          <div>
            <strong>Google Gemini API Connected</strong><br>
            <span style="font-size: 12px; opacity: 0.9;">Model: <strong>${currentStatus.activeModel || 'gemini-3-flash-preview'}</strong> &bull; Key: <code>${currentStatus.apiKeyMasked}</code></span>
          </div>
        `;
      } else {
        bannerEl.style.background = 'rgba(245, 158, 11, 0.12)';
        bannerEl.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        bannerEl.style.color = '#f59e0b';
        bannerEl.innerHTML = `
          <i data-lucide="info" style="width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px;"></i>
          <div>
            <strong>Operating in Grounded Workspace Mode</strong><br>
            <span style="font-size: 12px; opacity: 0.9;">Gemini API key is unconfigured. The assistant answers tracking and DSA queries locally. Add a Gemini key below to unlock open-domain reasoning.</span>
          </div>
        `;
      }
    }

    if (currentKeyLabel) {
      currentKeyLabel.textContent = isConfigured ? `Current: ${currentStatus.apiKeyMasked}` : 'Not set';
    }

    if (removeBtn) {
      removeBtn.style.display = isConfigured ? 'inline-flex' : 'none';
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add('is-open');
    if (feedbackEl) feedbackEl.style.display = 'none';
    refreshStatus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    if (feedbackEl) feedbackEl.style.display = 'none';
  }

  if (openBtn) openBtn.onclick = openModal;
  if (cardActionBtn) cardActionBtn.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  if (toggleVisibilityBtn && keyInput) {
    toggleVisibilityBtn.onclick = () => {
      const isPassword = keyInput.type === 'password';
      keyInput.type = isPassword ? 'text' : 'password';
      toggleVisibilityBtn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}" style="width: 16px; height: 16px;"></i>`;
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    };
  }

  // Test Connection
  if (testBtn) {
    testBtn.onclick = async () => {
      const inputKey = keyInput ? keyInput.value.trim() : '';
      testBtn.disabled = true;
      testBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Testing...';
      if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.style.background = 'var(--bg-surface-elevated)';
        feedbackEl.style.color = 'var(--text-secondary)';
        feedbackEl.textContent = 'Contacting Google Gemini API...';
      }

      try {
        const res = await api.post('/assistant/test', {
          apiKey: inputKey || undefined
        });

        const testData = res.data;
        if (testData.success) {
          feedbackEl.style.background = 'rgba(16, 185, 129, 0.15)';
          feedbackEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
          feedbackEl.style.color = '#10b981';
          feedbackEl.innerHTML = `<strong>✓ Connection Succeeded!</strong> Model: <em>${testData.model}</em><br><span style="font-size: 11px;">Response: "${testData.reply || 'OK'}"</span>`;
        } else {
          feedbackEl.style.background = 'rgba(239, 68, 68, 0.15)';
          feedbackEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
          feedbackEl.style.color = '#ef4444';
          feedbackEl.innerHTML = `<strong>✕ Connection Failed:</strong> ${testData.message}`;
        }
      } catch (err) {
        if (feedbackEl) {
          feedbackEl.style.background = 'rgba(239, 68, 68, 0.15)';
          feedbackEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
          feedbackEl.style.color = '#ef4444';
          feedbackEl.innerHTML = `<strong>✕ Network Error:</strong> ${err.message}`;
        }
      } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = '<i data-lucide="activity"></i> Test Connection';
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    };
  }

  // Save Key Form
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveGeminiBtn');
      const inputKey = keyInput ? keyInput.value.trim() : '';

      if (!inputKey) {
        showToast('Input Required', 'Please enter a Gemini API Key to connect.', 'warning');
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Connecting...';
      }

      try {
        const res = await api.post('/assistant/configure', {
          apiKey: inputKey,
          persist: true
        });

        if (res.data.success) {
          showToast('Gemini Connected', 'Google Gemini API key verified and connected successfully!', 'success');
          if (keyInput) keyInput.value = '';
          await refreshStatus();
          closeModal();
        } else {
          showToast('Configuration Warning', res.data.message || 'Key saved but test failed.', 'warning');
          await refreshStatus();
        }
      } catch (err) {
        showToast('Error', err.message || 'Failed to save Gemini key', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i data-lucide="check"></i> Save & Connect';
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    };
  }

  // Remove Key
  if (removeBtn) {
    removeBtn.onclick = async () => {
      showConfirmModal({
        title: 'Remove Gemini API Key',
        message: 'Are you sure you want to disconnect Google Gemini? The assistant will switch back to local Grounded Workspace Mode.',
        confirmText: 'Disconnect',
        isDanger: true,
        onConfirm: async () => {
          try {
            await api.delete('/assistant/configure');
            showToast('Disconnected', 'Gemini key removed. Reverted to Grounded Workspace Mode.', 'info');
            if (keyInput) keyInput.value = '';
            await refreshStatus();
          } catch (err) {
            showToast('Error', err.message, 'error');
          }
        }
      });
    };
  }

  // Initial fetch
  refreshStatus();

  return { refreshStatus, openModal, closeModal };
}

export function initAiAssistant() {
  const messagesArea = document.getElementById('chatMessagesArea');
  const chatForm = document.getElementById('chatInputForm');
  const chatInput = document.getElementById('chatInputTextarea');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const micBtn = document.getElementById('chatMicBtn');
  const langSelect = document.getElementById('voiceLangSelect');
  const langBadge = document.getElementById('voiceLangBadge');
  const statusContainer = document.getElementById('voiceStatusIndicator');
  const statusText = document.getElementById('voiceStatusText');
  const cancelBtn = document.getElementById('voiceCancelBtn');

  if (!messagesArea) return null;

  loadMessages();

  // Voice Input Controller (Web Speech API)
  const voiceController = new VoiceInputController({
    micBtn,
    langSelect,
    langBadge,
    inputElement: chatInput,
    statusContainer,
    statusText,
    cancelBtn,
    inputForm: chatForm,
    onToast: showToast
  });

  // Setup Google Gemini Configuration & Diagnostics Modal
  setupGeminiModal();

  // Suggested Prompts
  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.onclick = () => {
      const prompt = chip.getAttribute('data-prompt') || chip.textContent.trim();
      handleUserMessage(prompt);
    };
  });

  // Submit message
  if (chatForm && chatInput) {
    chatForm.onsubmit = (e) => {
      e.preventDefault();
      if (voiceController && voiceController.isListening) {
        voiceController.stopListening({ cancelled: false });
      }
      const text = chatInput.value.trim();
      if (text) {
        handleUserMessage(text);
      }
    };

    // Auto-expand textarea on input & Enter to send
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
    });

    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
      }
    });
  }

  // Clear chat
  if (clearChatBtn) {
    clearChatBtn.onclick = () => {
      showConfirmModal({
        title: 'Clear Chat History',
        message: 'Are you sure you want to clear your AI chat history? This will reset the conversation thread.',
        confirmText: 'Clear Chat',
        isDanger: true,
        onConfirm: () => {
          if (voiceController && voiceController.isListening) {
            voiceController.stopListening({ cancelled: true });
          }
          localStorage.removeItem(CHAT_HISTORY_KEY);
          loadMessages();
          showToast('Cleared', 'Chat history reset.', 'info');
        }
      });
    };
  }

  return { voiceController };
}

function loadMessages() {
  const messagesArea = document.getElementById('chatMessagesArea');
  if (!messagesArea) return;

  let messages = [];
  try {
    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    messages = saved ? JSON.parse(saved) : DEFAULT_CONVERSATION;
  } catch (e) {
    messages = DEFAULT_CONVERSATION;
  }

  renderMessages(messages);
}

function saveMessages(messages) {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  } catch (e) {}
}

function renderMessages(messages) {
  const messagesArea = document.getElementById('chatMessagesArea');
  if (!messagesArea) return;

  messagesArea.innerHTML = messages.map(msg => {
    if (msg.role === 'user') {
      return `
        <div class="chat-msg user">
          <div class="msg-bubble">
            <p>${msg.text}</p>
            <span style="display: block; font-size: 10px; opacity: 0.7; text-align: right; margin-top: 4px;">${msg.timestamp}</span>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="chat-msg ai">
          <div class="ai-avatar" style="width: 32px; height: 32px; flex-shrink: 0;">
            <i data-lucide="bot" style="width: 18px; height: 18px;"></i>
          </div>
          <div class="msg-bubble">
            <div>${formatAiMarkdown(msg.text)}</div>
            ${msg.actionCardHtml || ''}
            <span style="display: block; font-size: 10px; color: var(--text-muted); margin-top: 6px;">${msg.timestamp} • ReviseCode AI</span>
          </div>
        </div>
      `;
    }
  }).join('');

  // Re-attach dynamic buttons on action cards
  messagesArea.querySelectorAll('.ai-confirm-add-btn').forEach(btn => {
    btn.onclick = async () => {
      const problemNumber = btn.getAttribute('data-number');
      const title = btn.getAttribute('data-title');
      const subject = btn.getAttribute('data-subject') || 'DSA';
      const topic = btn.getAttribute('data-topic') || 'General';

      btn.setAttribute('disabled', 'true');
      btn.textContent = 'Saving...';

      try {
        const payload = {
          platform: 'LeetCode',
          problemNumber: problemNumber || '',
          title,
          problemUrl: `https://leetcode.com/problems/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
          subject,
          topic,
          difficulty: 'Medium',
          dateSolved: new Date().toISOString().split('T')[0],
          tags: ['AI-Added', topic],
          summary: `Saved problem: ${title}`,
          approach: 'Standard approach for ' + title,
          timeComplexity: 'O(n)',
          spaceComplexity: 'O(1)',
          programmingLanguage: 'javascript',
          code: `// Solution for ${title}\nfunction solve() {\n  // Implementation\n}`
        };

        const res = await api.post('/questions', payload);
        btn.textContent = '✓ Saved to Tracker';
        showToast('Scheduled', `Saved "${title}". 5 revision milestones generated for Days 3, 7, 12, 20, 30.`, 'success');
      } catch (err) {
        btn.removeAttribute('disabled');
        btn.textContent = 'Retry Save';
        showToast('Error', err.message, 'error');
      }
    };
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Convert basic markdown formatting into HTML safely
function formatAiMarkdown(text) {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: var(--font-family-mono);">$1</code>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return html;
}

// User Message Handler with Real Backend APIs
let isSubmitting = false;

async function handleUserMessage(prompt) {
  if (isSubmitting) return;
  const cleanPrompt = (prompt || '').trim();
  if (!cleanPrompt) return;

  const messagesArea = document.getElementById('chatMessagesArea');
  const chatInput = document.getElementById('chatInputTextarea');
  const chatSendBtn = document.getElementById('chatSendBtn');

  isSubmitting = true;
  if (chatInput) chatInput.disabled = true;
  if (chatSendBtn) chatSendBtn.disabled = true;

  const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let messages = [];
  try {
    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    messages = saved ? JSON.parse(saved) : DEFAULT_CONVERSATION;
  } catch (e) {
    messages = DEFAULT_CONVERSATION;
  }

  messages.push({
    role: 'user',
    text: cleanPrompt,
    timestamp: userTime
  });

  saveMessages(messages);
  renderMessages(messages);

  // Show typing indicator
  let typingEl = null;
  if (messagesArea) {
    typingEl = document.createElement('div');
    typingEl.className = 'chat-msg ai';
    typingEl.id = 'aiTypingIndicator';
    typingEl.innerHTML = `
      <div class="ai-avatar" style="width: 32px; height: 32px; flex-shrink: 0;"><i data-lucide="bot" style="width: 18px; height: 18px;"></i></div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messagesArea.appendChild(typingEl);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  try {
    // Dispatch prompt to backend-powered response parser (/api/assistant/chat) with multi-turn context
    const aiResponse = await generateAiResponse(cleanPrompt, messages.slice(0, -1));

    if (typingEl) typingEl.remove();

    messages.push({
      role: 'ai',
      text: aiResponse.text,
      actionCardHtml: aiResponse.actionCardHtml || '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    saveMessages(messages);
    renderMessages(messages);
  } catch (err) {
    if (typingEl) typingEl.remove();
    console.error('Error generating AI response:', err);
    messages.push({
      role: 'ai',
      text: `Error communicating with AI Assistant: ${err.message || 'Unknown error'}. Please try again.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    saveMessages(messages);
    renderMessages(messages);
  } finally {
    isSubmitting = false;
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatInput.focus();
    }
    if (chatSendBtn) {
      chatSendBtn.disabled = false;
    }
  }
}

async function generateAiResponse(prompt, conversationHistory = []) {
  // 1. Primary: Backend /api/assistant/chat (handles Gemini LLM or live Grounded Workspace engine)
  try {
    const res = await api.post('/assistant/chat', {
      message: prompt,
      conversationHistory: conversationHistory.slice(-10)
    });
    if (res && res.data && res.data.text) {
      return {
        text: res.data.text,
        actionCardHtml: res.data.actionCardHtml || '',
        data: res.data.data || null
      };
    }
  } catch (err) {
    console.warn('POST /api/assistant/chat call failed, attempting client fallback:', err);
  }

  // 2. Fallback: Local response generator if network or backend endpoint is temporarily offline
  return generateLocalFallbackResponse(prompt);
}

async function generateLocalFallbackResponse(prompt) {
  const lower = prompt.toLowerCase();
  const isHindi = /[\u0900-\u097F]/.test(prompt);

  // 1. "Add LeetCode 50 to my revision tracker" / "LeetCode 50 जोड़ो"
  if (lower.includes('leetcode 50') || (lower.includes('50') && (lower.includes('add') || lower.includes('जोड़ो') || lower.includes('जोड़ो')))) {
    try {
      const qRes = await api.get('/questions', { search: '50' });
      const items = qRes.data?.items || [];
      const existing = items.find(q => q.platform.toLowerCase() === 'leetcode' && String(q.problemNumber) === '50');

      if (existing) {
        return {
          text: isHindi
            ? `मैंने आपका डेटाबेस जाँचा: **LeetCode 50 — ${existing.title}** पहले से आपके ट्रैकर में सहेजा हुआ है!\n\nइसके स्पेस्ड-रिपीटिशन माइलस्टोन्स सक्रिय हैं। आप इसे रिवीजन सेंटर में देख सकते हैं।`
            : `I checked your live backend database: **LeetCode 50 — ${existing.title}** is already saved in your tracker!\n\nIt has scheduled spaced repetition milestones. You can view its current timeline or start a review directly.`,
          actionCardHtml: `
            <div class="ai-action-card">
              <div class="ai-action-header"><i data-lucide="check-circle"></i> Existing Question Found</div>
              <div class="ai-action-body">LeetCode 50 — ${existing.title} is currently tracked under <strong>${existing.subject} (${existing.topic || 'General'})</strong>.</div>
              <div class="ai-action-actions">
                <a href="question-detail.html?id=${existing.id}" class="btn btn-primary btn-sm">Open Question Details</a>
                <a href="revision-center.html" class="btn btn-secondary btn-sm">Revision Center</a>
              </div>
            </div>
          `
        };
      }
    } catch (e) {
      // Continue to prompt creation
    }

    return {
      text: isHindi
        ? `मैंने आपकी कमांड की पहचान की:\n• **प्लैटफ़ॉर्म:** LeetCode\n• **प्रश्न संख्या:** 50\n• **शीर्षक:** Pow(x, n)\n• **विषय:** DSA (Binary Search / Divide & Conquer)\n\nक्या आप 5 अनिवार्य माइलस्टोन्स (दिन 3, 7, 12, 20, 30) को शेड्यूल करना चाहते हैं?`
        : `I parsed your command:\n• **Platform:** LeetCode\n• **Problem Number:** 50\n• **Identified Title:** Pow(x, n)\n• **Suggested Subject:** DSA (Binary Search / Divide & Conquer)\n\nWould you like me to confirm and schedule the 5 mandatory milestones (Day 3, 7, 12, 20, 30)?`,
      actionCardHtml: `
        <div class="ai-action-card">
          <div class="ai-action-header"><i data-lucide="plus-circle"></i> Confirm Adding Question</div>
          <div class="ai-action-body">
            <strong>LeetCode 50: Pow(x, n)</strong><br>
            <span style="font-size: 12px; color: var(--text-muted);">Difficulty: Medium • Milestones: 3d, 7d, 12d, 20d, 30d</span>
          </div>
          <div class="ai-action-actions">
            <button class="btn btn-primary btn-sm ai-confirm-add-btn" data-number="50" data-title="Pow(x, n)" data-subject="DSA" data-topic="Binary Search">
              ${isHindi ? 'पुष्टि करें और शेड्यूल करें' : 'Confirm & Schedule Revisions'}
            </button>
          </div>
        </div>
      `
    };
  }

  // 1b. Questions solved today: "How many questions did I solve today?" / "आज मैंने कितने questions solve किए?" / "मैंने आज कितने सवाल हल किए?"
  const isTodaySolved = isTodaySolvedQuestionsQuery(prompt);
  if (isTodaySolved) {
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      const qRes = await api.get('/questions', { limit: 1000 });
      const items = qRes.data?.items || [];
      const solvedToday = items.filter(q => q.dateSolved === today);

      if (solvedToday.length === 0) {
        return {
          text: isHindi
            ? `आज (${today}) आपने **0 प्रश्न** हल किए हैं।\n\nअपने रिवीजन ट्रैकर में नया प्रश्न जोड़ने के लिए "Add Question" पर जाएँ या मुझसे कहें: *"Add LeetCode 50 to my revision tracker"*!`
            : `You have solved **0 questions today** (${today}) (queried from live backend database).\n\nTo start tracking a new problem and schedule its 5 mandatory revision milestones, visit "Add Question"!`,
          actionCardHtml: `
            <div class="ai-action-card">
              <div class="ai-action-header"><i data-lucide="plus-circle"></i> Add Question</div>
              <div class="ai-action-actions">
                <a href="add-question.html" class="btn btn-primary btn-sm">${isHindi ? '+ नया प्रश्न जोड़ें' : '+ Add Question'}</a>
                <a href="questions.html" class="btn btn-secondary btn-sm">${isHindi ? 'सभी प्रश्न देखें' : 'View All Questions'}</a>
              </div>
            </div>
          `
        };
      }

      const list = solvedToday.map(q => `• **${q.title}** (${q.platform} ${q.problemNumber ? '#' + q.problemNumber : ''} - ${q.subject || 'DSA'})`).join('<br>');
      return {
        text: isHindi
          ? `आपने आज (${today}) कुल **${solvedToday.length} प्रश्न** हल किए हैं (लाइव डेटाबेस रिकॉर्ड्स):<br><br>${list}`
          : `You have solved **${solvedToday.length} question(s) today** (${today}) (queried from live backend database):<br><br>${list}`,
        actionCardHtml: `
          <div class="ai-action-card">
            <div class="ai-action-header"><i data-lucide="check-circle"></i> Today's Solved Questions</div>
            <div class="ai-action-actions">
              <a href="questions.html" class="btn btn-primary btn-sm">${isHindi ? 'प्रश्नों में देखें' : 'View in Questions Tracker'}</a>
              <a href="revision-center.html" class="btn btn-secondary btn-sm">${isHindi ? 'रिवीजन सेंटर' : 'Revision Center'}</a>
            </div>
          </div>
        `
      };
    } catch (err) {
      return {
        text: isHindi
          ? `डेटाबेस से आज के प्रश्नों की संख्या प्राप्त करने में त्रुटि: ${err.message}`
          : `Unable to retrieve questions solved today: ${err.message}`
      };
    }
  }

  // 2. "Show today's pending revisions" / "आज के रिवीजन दिखाओ"
  const isDueRevisions = (lower.includes('pending') || lower.includes('due') || lower.includes('पेंडिंग') || (lower.includes('आज') && (lower.includes('रिवीजन') || lower.includes('बाकी')))) && !lower.includes('solve') && !lower.includes('हल');
  if (isDueRevisions) {
    try {
      const res = await api.post('/assistant/command', { command: 'show_due_revisions' });
      const items = res.data?.items || [];

      if (items.length === 0) {
        return {
          text: isHindi
            ? `आज आपके पास **0 पेंडिंग रिवीजन** हैं! आपकी कतार पूरी तरह स्पष्ट है। बहुत बढ़िया काम!`
            : `You have **0 revisions due today**! Your queue is completely clear. Great job keeping up with your spaced active recall.`
        };
      }

      const itemsList = items.map(m => `• **${m.questionTitle}** (${m.platform} ${m.problemNumber || ''}) — Day ${m.milestoneDay || m.day} Milestone`).join('<br>');
      return {
        text: isHindi
          ? `आज आपके पास **${items.length} रिवीजन** देय हैं (बैकएंड रिकॉर्ड्स):<br><br>${itemsList}<br><br>आप बिना कोड देखे अपनी याददाश्त जांचने के लिए रिवीजन सेंटर खोल सकते हैं।`
          : `You have **${items.length} revision(s) due today** (queried from backend):<br><br>${itemsList}<br><br>You can open the Revision Center to test your recall without looking at the saved code.`,
        actionCardHtml: `
          <div class="ai-action-card">
            <div class="ai-action-header"><i data-lucide="play-circle"></i> Ready to Revise</div>
            <div class="ai-action-actions">
              <a href="revision-center.html" class="btn btn-primary btn-sm">${isHindi ? 'रिवीजन सेंटर खोलें' : "Open Today's Queue"}</a>
            </div>
          </div>
        `
      };
    } catch (err) {
      return { text: `Could not fetch today's revisions: ${err.message}` };
    }
  }

  // 3. "Which questions are overdue?" / "कौन से प्रश्न बाकी हैं?" / "ओवरड्यू"
  if (lower.includes('overdue') || lower.includes('छूट') || lower.includes('बकाया') || lower.includes('ओवरड्यू')) {
    try {
      const res = await api.post('/assistant/command', { command: 'show_overdue_revisions' });
      const items = res.data?.items || [];

      if (items.length === 0) {
        return {
          text: isHindi
            ? `अच्छी खबर! आपके पास **0 ओवरड्यू रिवीजन** हैं। आपके सभी माइलस्टोन्स समय पर हैं।`
            : `Good news! You have **0 overdue revisions**. All your spaced milestones are up to date.`
        };
      }

      const list = items.map(m => `• **${m.questionTitle}** — Day ${m.milestoneDay || m.day} Milestone (Target was ${formatDate(m.dueDate || m.targetDate)})`).join('<br>');
      return {
        text: isHindi
          ? `आपके पास **${items.length} ओवरड्यू रिवीजन** हैं (बैकएंड रिकॉर्ड्स):<br><br>${list}<br><br>भूलने की अवस्था से बचने के लिए इन्हें पहले पूरा करने की सलाह दी जाती है।`
          : `You have **${items.length} overdue revision(s)** (queried from backend):<br><br>${list}<br><br>I recommend catching up on these first to prevent concept decay on your forgetting curve.`,
        actionCardHtml: `
          <div class="ai-action-card">
            <div class="ai-action-header" style="color: var(--danger);"><i data-lucide="alert-triangle"></i> Overdue Items</div>
            <div class="ai-action-actions">
              <a href="revision-center.html" class="btn btn-danger btn-sm">${isHindi ? 'ओवरड्यू रिवीजन क्लियर करें' : 'Clear Overdue Milestones'}</a>
            </div>
          </div>
        `
      };
    } catch (err) {
      return { text: `Could not fetch overdue revisions: ${err.message}` };
    }
  }

  // 4. "Explain my saved binary search solution" / "बाइनरी सर्च समझाओ"
  if (lower.includes('binary search') || lower.includes('explain') || lower.includes('solution') || lower.includes('बाइनरी सर्च') || lower.includes('समझाओ')) {
    try {
      const searchTarget = (lower.includes('binary search') || lower.includes('बाइनरी सर्च')) ? 'binary search' : (lower.includes('pow') ? 'Pow' : (lower.includes('subarray') ? 'Subarray' : ''));
      const res = await api.post('/assistant/command', {
        command: 'explain_solution',
        payload: { search: searchTarget || 'Pow' }
      });

      const q = res.data;
      if (q) {
        return {
          text: isHindi
            ? `यहाँ **${q.title}** का विवरण है (बैकएंड रिकॉर्ड्स से):\n\n**दृष्टिकोण (Approach):**\n${q.approach || 'कोई विस्तृत विवरण उपलब्ध नहीं है।'}\n\n**जटिलता (Complexity Analysis):**\n• **समय जटिलता (Time Complexity):** ${q.timeComplexity || 'O(n)'}\n• **स्थान जटिलता (Space Complexity):** ${q.spaceComplexity || 'O(1)'}`
            : `Here is the explanation for **${q.title}** (from backend records):\n\n**Approach:**\n${q.approach || 'No detailed approach recorded.'}\n\n**Complexity Analysis:**\n• **Time Complexity:** ${q.timeComplexity || 'O(n)'}\n• **Space Complexity:** ${q.spaceComplexity || 'O(1)'}\n\n${q.notes ? `**Saved Notes:**\n*"${q.notes}"*` : ''}`,
          actionCardHtml: `
            <div class="ai-action-card">
              <div class="ai-action-header"><i data-lucide="code"></i> Full Solution Code</div>
              <div class="ai-action-actions">
                <a href="questions.html?search=${encodeURIComponent(q.title)}" class="btn btn-secondary btn-sm">${isHindi ? 'प्रश्नों में देखें' : 'View in Questions Tracker'}</a>
              </div>
            </div>
          `
        };
      }
    } catch (err) {
      // Continue to next handlers
    }
  }

  // 5. "Show questions I marked as difficult" / "कठिन प्रश्न दिखाओ"
  if (lower.includes('difficult') || lower.includes('forgot') || lower.includes('कठिन') || lower.includes('मुश्किल')) {
    try {
      const res = await api.get('/dashboard/activity', { limit: 50 });
      const sessions = res.data?.items || [];
      const diffSessions = sessions.filter(s => s.recallRating === 'difficult' || s.recallRating === 'forgot');

      if (diffSessions.length === 0) {
        return {
          text: isHindi
            ? `आपने अपने रिवीजन सत्रों में अभी तक किसी भी प्रश्न को **कठिन (Difficult)** या **भूला (Forgot)** के रूप में चिह्नित नहीं किया है।`
            : `You haven't marked any questions as **Difficult** or **Forgot** in your recorded revision sessions yet. Keep completing revisions and rating your recall honestly.`
        };
      }

      const list = diffSessions.map(s => `• **${s.questionTitle}** (रेटिंग: *${s.recallRating.toUpperCase()}* - दिन ${s.milestoneDay})`).join('<br>');
      return {
        text: isHindi
          ? `यहाँ वे प्रश्न हैं जहाँ आपने रिकॉल घर्षण महसूस किया:\n\n${list}\n\nआगामी एनालिटिक्स में इन पर विशेष ध्यान दिया जाएगा।`
          : `Here are questions where you reported recall friction:\n\n${list}\n\nI will keep a close eye on these in your upcoming analytics.`,
        actionCardHtml: `
          <div class="ai-action-card">
            <div class="ai-action-header"><i data-lucide="bar-chart-2"></i> Review Analytics</div>
            <div class="ai-action-actions">
              <a href="analytics.html" class="btn btn-secondary btn-sm">${isHindi ? 'एनालिटिक्स देखें' : 'View Analytics Dashboard'}</a>
            </div>
          </div>
        `
      };
    } catch (err) {
      return { text: `Could not retrieve recall sessions: ${err.message}` };
    }
  }

  // 6. "Add three new coding questions" / "तीन नए प्रश्न बताओ"
  if (lower.includes('three') || lower.includes('suggest') || lower.includes('recommend') || lower.includes('तीन') || lower.includes('सुझाव')) {
    return {
      text: isHindi
        ? `साक्षात्कार की तैयारी के लिए यहाँ 3 अनुशंसित कोडिंग प्रश्न हैं:\n\n1. **LeetCode 3 — Longest Substring Without Repeating Characters** (Medium • Sliding Window)\n2. **LeetCode 200 — Number of Islands** (Medium • BFS/DFS)\n3. **LeetCode 15 — 3Sum** (Medium • Two Pointers)\n\nइन्हें अपने रिवीजन ट्रैकर में जोड़ने के लिए नीचे क्लिक करें:`
        : `Here are 3 high-yield coding questions recommended for interview preparation:\n\n1. **LeetCode 3 — Longest Substring Without Repeating Characters** (Medium • Sliding Window)\n2. **LeetCode 200 — Number of Islands** (Medium • BFS/DFS)\n3. **LeetCode 15 — 3Sum** (Medium • Two Pointers)\n\nClick below to save any of them to your backend revision tracker:`,
      actionCardHtml: `
        <div class="ai-action-card">
          <div class="ai-action-header"><i data-lucide="sparkles"></i> Recommended Problems</div>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
            <button class="btn btn-outline btn-sm ai-confirm-add-btn" data-number="3" data-title="Longest Substring Without Repeating Characters" data-subject="DSA" data-topic="Sliding Window">
              + Add LeetCode 3 (Sliding Window)
            </button>
            <button class="btn btn-outline btn-sm ai-confirm-add-btn" data-number="200" data-title="Number of Islands" data-subject="DSA" data-topic="Graphs">
              + Add LeetCode 200 (Graphs)
            </button>
            <button class="btn btn-outline btn-sm ai-confirm-add-btn" data-number="15" data-title="3Sum" data-subject="DSA" data-topic="Two Pointers">
              + Add LeetCode 15 (Two Pointers)
            </button>
          </div>
        </div>
      `
    };
  }

  // 7. Generic Fallback
  if (isHindi) {
    return {
      text: `मुझे आपका संदेश प्राप्त हुआ: *"#${prompt}"*।\n\nडेमो मोड में वर्तमान में समर्थित मुख्य आदेश:\n• *"आज के रिवीजन दिखाओ"*\n• *"कौन से प्रश्न बाकी हैं?"*\n• *"बाइनरी सर्च समझाओ"*\n• *"कठिन प्रश्न दिखाओ"*\n• *"LeetCode 50 जोड़ो"*\n• *"तीन नए कोडिंग प्रश्न बताओ"*\n\nपूर्ण भाषा समझ के लिए बैकएंड में Google Gemini API क्रेडेंशियल्स जोड़ें।`
    };
  }

  try {
    const res = await api.post('/assistant/command', { command: prompt });
    return {
      text: res.message || `Processed command: "${prompt}"`,
      actionCardHtml: res.data ? `<pre style="font-size: 11px; max-height: 120px; overflow-y: auto;">${JSON.stringify(res.data, null, 2)}</pre>` : ''
    };
  } catch (err) {
    return {
      text: `I received your prompt: *"#${prompt}"*.

As the backend assistant is currently operating in **Deterministic Mode**, supported commands include:
• *"Add LeetCode 50 to my revision tracker"*
• *"Show today's pending revisions"* or *"आज के रिवीजन दिखाओ"*
• *"Which questions are overdue?"* or *"कौन से प्रश्न बाकी हैं?"*
• *"Explain my saved binary search solution"* or *"बाइनरी सर्च समझाओ"*
• *"Show questions I marked as difficult"* or *"कठिन प्रश्न दिखाओ"*
• *"Add three new coding questions"* or *"तीन नए प्रश्न बताओ"*

To enable unrestricted natural-language reasoning, configure Google Gemini API credentials in the backend environment.`
    };
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('chatMessagesArea')) {
      initAiAssistant();
    }
  });
}
