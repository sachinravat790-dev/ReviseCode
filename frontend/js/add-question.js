/**
 * ReviseCode Add / Edit Question Controller (js/add-question.js)
 * Connects frontend form with backend POST/PUT /api/questions.
 */

import { api } from './api.js';
import { calculateMilestoneDates, MANDATORY_INTERVALS } from './storage.js';
import { formatDate } from './app.js';
import { showToast } from './navigation.js';
import { isValidUrl, showInputError, clearAllErrors } from './validators.js';

let editQuestionId = null;
let currentAttachments = [];
let isSubmitting = false;

export async function initAddQuestion() {
  const form = document.getElementById('addQuestionForm');
  if (!form) return;

  await loadSubjects();

  // Check if Edit Mode
  const params = new URLSearchParams(window.location.search);
  editQuestionId = params.get('edit');

  const pageTitle = document.getElementById('addPageTitle');
  const submitBtn = document.getElementById('addSubmitBtn');

  if (editQuestionId) {
    if (pageTitle) pageTitle.textContent = 'Edit Question';
    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="save"></i> Update Question';
    await loadExistingQuestion(editQuestionId);
  } else {
    // Set default solved date to today
    const dateInput = document.getElementById('qDateSolved');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    updateMilestoneDatePreview();
  }

  // Update milestone preview whenever date solved changes
  const dateInput = document.getElementById('qDateSolved');
  if (dateInput) {
    dateInput.addEventListener('change', updateMilestoneDatePreview);
  }

  // Duplicate Check on Blur
  setupDuplicateCheck();

  // File Upload / Dropzone Mock & Preview
  setupAttachments();

  // Form Submission
  form.addEventListener('submit', handleFormSubmit);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Load subjects from backend
 */
async function loadSubjects() {
  const subjectSelect = document.getElementById('qSubject');
  if (!subjectSelect) return;

  try {
    const res = await api.get('/subjects');
    const subjects = res.data || [];
    subjectSelect.innerHTML = subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
  } catch (err) {
    console.warn('Could not load subjects from backend:', err.message);
    subjectSelect.innerHTML = `
      <option value="DSA">DSA</option>
      <option value="SQL">SQL</option>
      <option value="Web Development">Web Development</option>
      <option value="Aptitude">Aptitude</option>
      <option value="Mathematics">Mathematics</option>
      <option value="Other">Other</option>
    `;
  }
}

/**
 * Load existing question for editing from backend
 */
async function loadExistingQuestion(id) {
  try {
    const res = await api.get(`/questions/${id}`);
    const q = res.data;
    if (q) {
      populateForm(q);
    }
  } catch (err) {
    showToast('Error', `Could not load question: ${err.message}`, 'error');
  }
}

function updateMilestoneDatePreview() {
  const previewContainer = document.getElementById('milestoneDatesPreview');
  if (!previewContainer) return;

  const dateSolved = document.getElementById('qDateSolved')?.value || new Date().toISOString().split('T')[0];
  const dates = calculateMilestoneDates(dateSolved, MANDATORY_INTERVALS);

  previewContainer.innerHTML = dates.map(m => `
    <div class="milestone-summary-card" style="padding: 10px;">
      <div class="milestone-day-badge">Day ${m.day}</div>
      <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">
        ${formatDate(m.targetDate)}
      </div>
      <span class="badge badge-upcoming" style="margin-top: 6px; font-size: 10px;">Scheduled</span>
    </div>
  `).join('');
}

function setupDuplicateCheck() {
  const titleInput = document.getElementById('qTitle');
  const numInput = document.getElementById('qNumber');
  const platformSelect = document.getElementById('qPlatform');
  const duplicateWarningBox = document.getElementById('duplicateWarningBox');

  const checkDup = async () => {
    if (editQuestionId) return; // Skip in edit mode
    const platform = platformSelect?.value;
    const num = numInput?.value?.trim();
    const title = titleInput?.value?.trim();

    if (!title && !num) return;

    try {
      // Query backend for potential matching questions
      const res = await api.get('/questions', { search: num || title });
      const items = res.data?.items || [];

      const dup = items.find(q => {
        const matchNum = platform && num && q.platform.toLowerCase() === platform.toLowerCase() && String(q.problemNumber) === String(num);
        const matchTitle = title && q.title.toLowerCase().trim() === title.toLowerCase().trim();
        return matchNum || matchTitle;
      });

      if (dup && duplicateWarningBox) {
        duplicateWarningBox.style.display = 'flex';
        duplicateWarningBox.innerHTML = `
          <i data-lucide="alert-triangle"></i>
          <div>
            <strong>Potential Duplicate Detected:</strong> A question matching "<strong>${dup.title}</strong>" (${dup.platform} ${dup.problemNumber || ''}) is already in your tracker.
            <a href="question-detail.html?id=${dup.id}" target="_blank" style="margin-left: 8px; text-decoration: underline;">View existing record</a>
          </div>
        `;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      } else if (duplicateWarningBox) {
        duplicateWarningBox.style.display = 'none';
      }
    } catch (err) {
      // Duplicate check error should not block the user
    }
  };

  if (titleInput) titleInput.addEventListener('blur', checkDup);
  if (numInput) numInput.addEventListener('blur', checkDup);
}

/**
 * Compress and downscale an image file or dataURL using HTML5 canvas
 * Keeps handwritten notes crisp while keeping upload sizes under ~300KB.
 */
function compressImage(fileOrDataUrl, maxWidth = 1600, maxHeight = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

function setupAttachments() {
  const dropzone = document.getElementById('attachmentDropzone');
  const fileInput = document.getElementById('attachmentFileInput');
  const previewList = document.getElementById('attachmentPreviewList');
  const cameraBtn = document.getElementById('cameraCaptureBtn') || document.getElementById('mockCameraBtn');

  // Camera modal elements
  const cameraModal = document.getElementById('cameraModal');
  const cameraCloseBtn = document.getElementById('cameraModalClose');
  const cameraVideo = document.getElementById('cameraVideo');
  const cameraCapturedImg = document.getElementById('cameraCapturedImg');
  const cameraStatusBox = document.getElementById('cameraStatusBox');
  const cameraStatusSpinner = document.getElementById('cameraStatusSpinner');
  const cameraStatusText = document.getElementById('cameraStatusText');
  const cameraCanvas = document.getElementById('cameraCanvas');
  const nativeCameraInput = document.getElementById('nativeCameraInput');
  const nativeCameraBtn = document.getElementById('nativeCameraBtn');
  const flipCameraBtn = document.getElementById('flipCameraBtn');
  const snapPhotoBtn = document.getElementById('snapPhotoBtn');
  const retakePhotoBtn = document.getElementById('retakePhotoBtn');
  const attachPhotoBtn = document.getElementById('attachPhotoBtn');
  const cameraLiveControls = document.getElementById('cameraLiveControls');
  const cameraReviewControls = document.getElementById('cameraReviewControls');

  let activeStream = null;
  let currentFacingMode = 'environment'; // default to rear camera for notes
  let capturedDataUrl = null;

  if (dropzone && fileInput) {
    dropzone.onclick = () => fileInput.click();

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    };

    dropzone.ondragleave = () => {
      dropzone.classList.remove('drag-over');
    };

    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    };

    fileInput.onchange = () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFiles(fileInput.files);
      }
    };
  }

  // Real Camera Hardware Controller
  function stopCameraStream() {
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        try { track.stop(); } catch (_) {}
      });
      activeStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
  }

  function closeCameraModal() {
    stopCameraStream();
    if (cameraModal) {
      cameraModal.classList.remove('is-open');
    }
    capturedDataUrl = null;
  }

  async function startCameraStream() {
    stopCameraStream();

    if (!cameraVideo) return;

    if (cameraStatusBox) cameraStatusBox.style.display = 'block';
    if (cameraStatusSpinner) cameraStatusSpinner.style.display = 'block';
    if (cameraStatusText) cameraStatusText.textContent = 'Requesting camera access...';
    if (cameraVideo) cameraVideo.style.display = 'none';
    if (cameraCapturedImg) cameraCapturedImg.style.display = 'none';
    if (snapPhotoBtn) snapPhotoBtn.disabled = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (cameraStatusSpinner) cameraStatusSpinner.style.display = 'none';
      if (cameraStatusText) {
        cameraStatusText.innerHTML = 'Live camera stream is not supported by your browser.<br>Please click <strong>Phone Camera / File</strong> below to capture or select a photo.';
      }
      return;
    }

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: currentFacingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
      } catch (idealErr) {
        // Fallback constraint if specific facingMode/resolution is rejected
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      activeStream = stream;
      cameraVideo.srcObject = stream;
      await cameraVideo.play().catch(() => {});

      if (cameraStatusBox) cameraStatusBox.style.display = 'none';
      cameraVideo.style.display = 'block';
      if (snapPhotoBtn) snapPhotoBtn.disabled = false;

      // Detect if device has multiple cameras (front + rear)
      if (navigator.mediaDevices.enumerateDevices && flipCameraBtn) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          flipCameraBtn.style.display = videoInputs.length > 1 ? 'inline-flex' : 'none';
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      if (cameraStatusSpinner) cameraStatusSpinner.style.display = 'none';
      if (cameraStatusText) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          cameraStatusText.innerHTML = 'Camera permission was denied.<br>Please allow camera access in browser permissions, or use <strong>Phone Camera / File</strong> below.';
        } else {
          cameraStatusText.innerHTML = `Unable to access camera (${err.name || 'Error'}).<br>Please use <strong>Phone Camera / File</strong> below to snap a photo.`;
        }
      }
    }
  }

  function openCameraModal() {
    if (!cameraModal) {
      if (nativeCameraInput) nativeCameraInput.click();
      return;
    }

    cameraModal.classList.add('is-open');

    if (cameraLiveControls) cameraLiveControls.style.display = 'flex';
    if (cameraReviewControls) cameraReviewControls.style.display = 'none';
    if (cameraCapturedImg) {
      cameraCapturedImg.src = '';
      cameraCapturedImg.style.display = 'none';
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    startCameraStream();
  }

  if (cameraBtn) {
    cameraBtn.onclick = (e) => {
      e.preventDefault();
      openCameraModal();
    };
  }

  if (cameraCloseBtn) {
    cameraCloseBtn.onclick = () => closeCameraModal();
  }

  if (cameraModal) {
    cameraModal.addEventListener('click', (e) => {
      if (e.target === cameraModal) {
        closeCameraModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cameraModal && cameraModal.classList.contains('is-open')) {
      closeCameraModal();
    }
  });

  if (flipCameraBtn) {
    flipCameraBtn.onclick = () => {
      currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
      startCameraStream();
    };
  }

  if (snapPhotoBtn) {
    snapPhotoBtn.onclick = () => {
      if (!cameraVideo || !activeStream) return;

      const w = cameraVideo.videoWidth || 1280;
      const h = cameraVideo.videoHeight || 720;
      const canvas = cameraCanvas || document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cameraVideo, 0, 0, w, h);

      capturedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      if (cameraCapturedImg) {
        cameraCapturedImg.src = capturedDataUrl;
        cameraCapturedImg.style.display = 'block';
      }
      cameraVideo.style.display = 'none';

      if (cameraLiveControls) cameraLiveControls.style.display = 'none';
      if (cameraReviewControls) cameraReviewControls.style.display = 'flex';
    };
  }

  if (retakePhotoBtn) {
    retakePhotoBtn.onclick = () => {
      capturedDataUrl = null;
      if (cameraCapturedImg) {
        cameraCapturedImg.src = '';
        cameraCapturedImg.style.display = 'none';
      }
      if (cameraVideo) {
        cameraVideo.style.display = 'block';
      }
      if (cameraLiveControls) cameraLiveControls.style.display = 'flex';
      if (cameraReviewControls) cameraReviewControls.style.display = 'none';
    };
  }

  if (attachPhotoBtn) {
    attachPhotoBtn.onclick = () => {
      if (!capturedDataUrl) return;

      const approxBytes = Math.round((capturedDataUrl.length * 3) / 4);
      const sizeKb = Math.round(approxBytes / 1024);
      const filename = `Handwritten_Note_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.jpg`;

      currentAttachments.push({
        id: 'att_' + Date.now(),
        name: filename,
        url: capturedDataUrl,
        size: `${sizeKb} KB`
      });

      renderAttachmentsList();
      closeCameraModal();
      showToast('Camera Capture', 'Handwritten note photo attached.', 'success');
    };
  }

  // Device native camera app or file chooser trigger
  if (nativeCameraBtn && nativeCameraInput) {
    nativeCameraBtn.onclick = () => nativeCameraInput.click();
  }

  if (nativeCameraInput) {
    nativeCameraInput.onchange = async () => {
      if (!nativeCameraInput.files || nativeCameraInput.files.length === 0) return;
      const file = nativeCameraInput.files[0];
      try {
        const compressedUrl = await compressImage(file, 1600, 1600, 0.85);
        const approxBytes = Math.round((compressedUrl.length * 3) / 4);
        const sizeKb = Math.round(approxBytes / 1024);

        currentAttachments.push({
          id: 'att_' + Date.now(),
          name: file.name || `Camera_Photo_${Date.now().toString().slice(-4)}.jpg`,
          url: compressedUrl,
          size: `${sizeKb} KB`
        });

        renderAttachmentsList();
        closeCameraModal();
        showToast('Photo Attached', 'Handwritten note attached successfully.', 'success');
      } catch (err) {
        console.error('Error processing photo:', err);
        showToast('Error', 'Could not process photo file.', 'error');
      }
      nativeCameraInput.value = '';
    };
  }

  async function handleFiles(files) {
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        try {
          const compressedUrl = await compressImage(file, 1600, 1600, 0.85);
          const approxBytes = Math.round((compressedUrl.length * 3) / 4);
          currentAttachments.push({
            id: 'att_' + Date.now() + Math.random().toString(36).substring(2, 6),
            name: file.name,
            url: compressedUrl,
            size: `${Math.round(approxBytes / 1024)} KB`
          });
          renderAttachmentsList();
        } catch (err) {
          const reader = new FileReader();
          reader.onload = (e) => {
            currentAttachments.push({
              id: 'att_' + Date.now(),
              name: file.name,
              url: e.target.result,
              size: `${Math.round(file.size / 1024)} KB`
            });
            renderAttachmentsList();
          };
          reader.readAsDataURL(file);
        }
      } else {
        currentAttachments.push({
          id: 'att_' + Date.now() + Math.random().toString(36).substring(2, 6),
          name: file.name,
          url: 'https://via.placeholder.com/300x200/1e293b/ffffff?text=' + encodeURIComponent(file.name),
          size: `${Math.round(file.size / 1024)} KB`
        });
        renderAttachmentsList();
      }
    }
  }

  function renderAttachmentsList() {
    if (!previewList) return;
    previewList.innerHTML = currentAttachments.map((att, idx) => `
      <div class="uploaded-preview-item" title="${att.name}">
        <img src="${att.url}" alt="${att.name}">
        <button type="button" class="remove-upload-btn" data-index="${idx}" title="Remove attachment">&times;</button>
      </div>
    `).join('');

    previewList.querySelectorAll('.remove-upload-btn').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.getAttribute('data-index'));
        currentAttachments.splice(i, 1);
        renderAttachmentsList();
      };
    });
  }
}

function populateForm(q) {
  document.getElementById('qTitle').value = q.title || '';
  document.getElementById('qPlatform').value = q.platform || 'LeetCode';
  document.getElementById('qNumber').value = q.problemNumber || '';
  document.getElementById('qUrl').value = q.problemUrl || q.url || '';
  document.getElementById('qSubject').value = q.subject || 'DSA';
  document.getElementById('qTopic').value = q.topic || '';
  document.getElementById('qDifficulty').value = q.difficulty || 'Medium';
  document.getElementById('qDateSolved').value = q.dateSolved || new Date().toISOString().split('T')[0];
  document.getElementById('qTags').value = (q.tags || []).join(', ');
  document.getElementById('qSummary').value = q.summary || q.description || '';
  document.getElementById('qApproach').value = q.approach || '';
  document.getElementById('qTimeComplexity').value = q.timeComplexity || '';
  document.getElementById('qSpaceComplexity').value = q.spaceComplexity || '';
  document.getElementById('qCodeLanguage').value = q.programmingLanguage || q.codeLanguage || 'javascript';
  document.getElementById('qCodeSolution').value = q.code || q.codeSolution || '';
  document.getElementById('qNotes').value = q.notes || '';

  currentAttachments = q.attachments ? [...q.attachments] : [];
  updateMilestoneDatePreview();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;

  clearAllErrors(e.target);

  const title = document.getElementById('qTitle').value.trim();
  const platform = document.getElementById('qPlatform').value;
  const problemNumber = document.getElementById('qNumber').value.trim();
  const problemUrl = document.getElementById('qUrl').value.trim();
  const subject = document.getElementById('qSubject').value;
  const topic = document.getElementById('qTopic').value.trim();
  const difficulty = document.getElementById('qDifficulty').value;
  const dateSolved = document.getElementById('qDateSolved').value;
  const tagsStr = document.getElementById('qTags').value.trim();
  const summary = document.getElementById('qSummary').value.trim();
  const approach = document.getElementById('qApproach').value.trim();
  const timeComplexity = document.getElementById('qTimeComplexity').value.trim();
  const spaceComplexity = document.getElementById('qSpaceComplexity').value.trim();
  const codeLanguage = document.getElementById('qCodeLanguage').value;
  const codeSolution = document.getElementById('qCodeSolution').value.trim();
  const notes = document.getElementById('qNotes').value.trim();

  // Client-side validations
  let hasErrors = false;
  if (!title) {
    showInputError(document.getElementById('qTitle'), 'Question title is required.');
    hasErrors = true;
  }
  if (problemUrl && !isValidUrl(problemUrl)) {
    showInputError(document.getElementById('qUrl'), 'Please enter a valid HTTP or HTTPS URL.');
    hasErrors = true;
  }

  if (hasErrors) {
    showToast('Validation Error', 'Please check highlighted fields.', 'error');
    return;
  }

  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  const questionPayload = {
    title,
    platform,
    problemNumber: problemNumber || undefined,
    problemUrl: problemUrl || undefined,
    subject,
    topic: topic || 'General',
    difficulty,
    dateSolved: dateSolved || new Date().toISOString().split('T')[0],
    tags,
    description: summary,
    summary,
    approach,
    timeComplexity: timeComplexity || 'O(n)',
    spaceComplexity: spaceComplexity || 'O(1)',
    programmingLanguage: codeLanguage,
    codeLanguage,
    code: codeSolution,
    codeSolution,
    notes,
    attachments: currentAttachments
  };

  const submitBtn = document.getElementById('addSubmitBtn');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Save Question';

  try {
    isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Saving...';
    }

    let result;
    if (editQuestionId) {
      result = await api.put(`/questions/${editQuestionId}`, questionPayload);
      showToast('Success!', 'Question updated successfully.', 'success');
    } else {
      result = await api.post('/questions', questionPayload);
      showToast('Success!', 'Question saved & 5 revision milestones scheduled!', 'success');
    }

    const savedId = result.data?.id || editQuestionId;
    setTimeout(() => {
      window.location.href = `question-detail.html?id=${savedId}`;
    }, 800);
  } catch (err) {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }

    // Handle duplicate conflict specifically
    if (err.status === 409) {
      const duplicateBox = document.getElementById('duplicateWarningBox');
      if (duplicateBox) {
        duplicateBox.style.display = 'flex';
        duplicateBox.innerHTML = `
          <i data-lucide="alert-triangle"></i>
          <div><strong>Duplicate Warning:</strong> ${err.message}</div>
        `;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
      showToast('Duplicate Question', err.message, 'warning');
      return;
    }

    // Handle field errors from Zod validation
    if (Array.isArray(err.errors) && err.errors.length > 0) {
      const fieldInputMap = {
        title: 'qTitle',
        platform: 'qPlatform',
        problemNumber: 'qNumber',
        problemUrl: 'qUrl',
        subject: 'qSubject',
        difficulty: 'qDifficulty',
        dateSolved: 'qDateSolved'
      };
      err.errors.forEach(e => {
        const inputId = fieldInputMap[e.field];
        if (inputId) {
          const el = document.getElementById(inputId);
          if (el) showInputError(el, e.message);
        }
      });
    }

    showToast('Save Failed', err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('addQuestionForm')) {
    initAddQuestion();
  }
});
