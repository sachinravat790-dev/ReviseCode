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

function setupAttachments() {
  const dropzone = document.getElementById('attachmentDropzone');
  const fileInput = document.getElementById('attachmentFileInput');
  const previewList = document.getElementById('attachmentPreviewList');
  const cameraBtn = document.getElementById('mockCameraBtn');

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

  // Camera mock simulation button
  if (cameraBtn) {
    cameraBtn.onclick = () => {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 400;
      sampleCanvas.height = 300;
      const ctx = sampleCanvas.getContext('2d');
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#a78bfa';
      ctx.font = '20px sans-serif';
      ctx.fillText('Handwritten Solution Notes', 40, 100);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px monospace';
      ctx.fillText('• Binary Exponentiation', 40, 150);
      ctx.fillText('• Time: O(log n), Space: O(1)', 40, 180);
      ctx.fillText('• Edge case: n = INT_MIN', 40, 210);

      const dataUrl = sampleCanvas.toDataURL('image/png');
      currentAttachments.push({
        id: 'att_' + Date.now(),
        name: 'Camera_Handwritten_Notes.png',
        url: dataUrl,
        size: '142 KB'
      });
      renderAttachmentsList();
      showToast('Camera Capture', 'Handwritten solution note attached.', 'success');
    };
  }

  function handleFiles(files) {
    Array.from(files).forEach(file => {
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
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        currentAttachments.push({
          id: 'att_' + Date.now(),
          name: file.name,
          url: 'https://via.placeholder.com/300x200/1e293b/ffffff?text=' + encodeURIComponent(file.name),
          size: `${Math.round(file.size / 1024)} KB`
        });
        renderAttachmentsList();
      }
    });
  }

  function renderAttachmentsList() {
    if (!previewList) return;
    previewList.innerHTML = currentAttachments.map((att, idx) => `
      <div class="uploaded-preview-item">
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
