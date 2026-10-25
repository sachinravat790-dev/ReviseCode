/**
 * ReviseCode Form Validation Helpers (js/validators.js)
 */

export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

export function isValidUrl(url) {
  if (!url) return true; // Optional field
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

export function showInputError(inputElement, errorMessage) {
  if (!inputElement) return;
  inputElement.classList.add('is-invalid');
  const parent = inputElement.closest('.form-group') || inputElement.parentElement;
  let errorEl = parent.querySelector('.form-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    parent.appendChild(errorEl);
  }
  errorEl.textContent = errorMessage;
}

export function clearInputError(inputElement) {
  if (!inputElement) return;
  inputElement.classList.remove('is-invalid');
  const parent = inputElement.closest('.form-group') || inputElement.parentElement;
  const errorEl = parent.querySelector('.form-error');
  if (errorEl) {
    errorEl.remove();
  }
}

export function clearAllErrors(formElement) {
  if (!formElement) return;
  formElement.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  formElement.querySelectorAll('.form-error').forEach(el => el.remove());
}
