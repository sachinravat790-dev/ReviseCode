import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Setup minimal globals before importing browser modules
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
    location: { origin: 'http://localhost:3000', pathname: '/add-question.html', search: '' },
    addEventListener: () => {},
    lucide: { createIcons: () => {} }
  };
}

function createMockElement(id, tag = 'div') {
  const listeners = {};
  return {
    id,
    tagName: tag.toUpperCase(),
    textContent: '',
    innerHTML: '',
    value: '',
    type: 'text',
    style: {},
    files: [],
    videoWidth: 1280,
    videoHeight: 720,
    srcObject: null,
    classList: {
      classes: new Set(),
      add(cls) { this.classes.add(cls); },
      remove(cls) { this.classes.delete(cls); },
      contains(cls) { return this.classes.has(cls); }
    },
    disabled: false,
    onclick: null,
    onchange: null,
    play() { return Promise.resolve(); },
    addEventListener(event, handler) {
      listeners[event] = handler;
      this[`on${event}`] = handler;
    },
    removeEventListener(event) {
      delete listeners[event];
      delete this[`on${event}`];
    },
    click() {
      if (this.onclick) this.onclick({ preventDefault: () => {} });
    },
    appendChild(child) {
      return child;
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

describe('Camera Capture & Attachment Controller', () => {
  let elements;
  let mockStream;
  let mockTrack;

  beforeEach(() => {
    mockTrack = {
      stopped: false,
      stop() { this.stopped = true; }
    };
    mockStream = {
      getTracks: () => [mockTrack]
    };

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: async (constraints) => mockStream,
        enumerateDevices: async () => [
          { kind: 'videoinput', deviceId: 'cam1' },
          { kind: 'videoinput', deviceId: 'cam2' }
        ]
      },
      configurable: true,
      writable: true
    });

    elements = {
      addQuestionForm: createMockElement('addQuestionForm', 'form'),
      cameraCaptureBtn: createMockElement('cameraCaptureBtn', 'button'),
      mockCameraBtn: createMockElement('mockCameraBtn', 'button'),
      cameraModal: createMockElement('cameraModal', 'div'),
      cameraModalClose: createMockElement('cameraModalClose', 'button'),
      cameraVideo: createMockElement('cameraVideo', 'video'),
      cameraCapturedImg: createMockElement('cameraCapturedImg', 'img'),
      cameraStatusBox: createMockElement('cameraStatusBox', 'div'),
      cameraStatusSpinner: createMockElement('cameraStatusSpinner', 'div'),
      cameraStatusText: createMockElement('cameraStatusText', 'p'),
      cameraCanvas: {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          fillRect: () => {},
          fillText: () => {}
        }),
        toDataURL: (mime, q) => 'data:image/jpeg;base64,realCameraPhotoData'
      },
      nativeCameraInput: createMockElement('nativeCameraInput', 'input'),
      nativeCameraBtn: createMockElement('nativeCameraBtn', 'button'),
      flipCameraBtn: createMockElement('flipCameraBtn', 'button'),
      snapPhotoBtn: createMockElement('snapPhotoBtn', 'button'),
      retakePhotoBtn: createMockElement('retakePhotoBtn', 'button'),
      attachPhotoBtn: createMockElement('attachPhotoBtn', 'button'),
      cameraLiveControls: createMockElement('cameraLiveControls', 'div'),
      cameraReviewControls: createMockElement('cameraReviewControls', 'div'),
      attachmentDropzone: createMockElement('attachmentDropzone', 'div'),
      attachmentFileInput: createMockElement('attachmentFileInput', 'input'),
      attachmentPreviewList: createMockElement('attachmentPreviewList', 'div'),
      qTitle: createMockElement('qTitle', 'input'),
      qSubject: createMockElement('qSubject', 'select')
    };

    const bodyEl = createMockElement('body', 'body');
    bodyEl.appendChild = () => {};

    globalThis.document = {
      body: bodyEl,
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: (tag) => {
        if (tag === 'canvas') {
          return elements.cameraCanvas;
        }
        return createMockElement('dynamic_' + tag, tag);
      }
    };
  });

  test('clicking cameraCaptureBtn opens modal and starts mediaDevices camera stream', async () => {
    const { initAddQuestion } = await import('../js/add-question.js');
    await initAddQuestion();

    // Click camera button
    elements.cameraCaptureBtn.click();
    await new Promise(r => setTimeout(r, 20));

    // Modal should be opened
    assert.strictEqual(elements.cameraModal.classList.contains('is-open'), true);
    assert.strictEqual(elements.cameraVideo.srcObject, mockStream);
  });

  test('snapPhoto captures frame from video and attaches real photo without mock notes', async () => {
    const { initAddQuestion } = await import('../js/add-question.js');
    await initAddQuestion();

    // Open modal
    elements.cameraCaptureBtn.click();
    await new Promise(r => setTimeout(r, 20));

    // Click Snap Photo
    elements.snapPhotoBtn.click();

    assert.strictEqual(elements.cameraCapturedImg.src, 'data:image/jpeg;base64,realCameraPhotoData');
    assert.strictEqual(elements.cameraLiveControls.style.display, 'none');
    assert.strictEqual(elements.cameraReviewControls.style.display, 'flex');

    // Click Attach Photo
    elements.attachPhotoBtn.click();

    // Modal should close and stream stopped
    assert.strictEqual(elements.cameraModal.classList.contains('is-open'), false);
    assert.strictEqual(mockTrack.stopped, true);

    // Preview list should contain the captured photo
    assert.match(elements.attachmentPreviewList.innerHTML, /Handwritten_Note_/);
    assert.doesNotMatch(elements.attachmentPreviewList.innerHTML, /Binary Exponentiation/);
  });

  test('closing modal stops camera tracks immediately to save battery and hardware access', async () => {
    const { initAddQuestion } = await import('../js/add-question.js');
    await initAddQuestion();

    elements.cameraCaptureBtn.click();
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(elements.cameraModal.classList.contains('is-open'), true);

    // Click Close
    elements.cameraModalClose.click();
    assert.strictEqual(elements.cameraModal.classList.contains('is-open'), false);
    assert.strictEqual(mockTrack.stopped, true);
  });

  test('nativeCameraBtn triggers nativeCameraInput fallback', async () => {
    const { initAddQuestion } = await import('../js/add-question.js');
    await initAddQuestion();

    let nativeClicked = false;
    elements.nativeCameraInput.click = () => { nativeClicked = true; };

    elements.nativeCameraBtn.click();
    assert.strictEqual(nativeClicked, true);
  });
});
