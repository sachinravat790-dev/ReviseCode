/**
 * ReviseCode Global App Utilities (js/app.js)
 */

import { showToast } from './navigation.js';

export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (_) {
    return dateString;
  }
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function getDaysDiff(targetDateStr) {
  if (!targetDateStr) return 0;
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const datePart = typeof targetDateStr === 'string' ? targetDateStr.split('T')[0] : new Date(targetDateStr).toISOString().split('T')[0];
    const parts = datePart.split('-');
    if (parts.length < 3) return 0;
    const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (_) {
    return 0;
  }
}

export async function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Success', successMessage, 'success');
  } catch (err) {
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('Success', successMessage, 'success');
    } catch (e) {
      showToast('Error', 'Unable to copy text', 'error');
    }
    document.body.removeChild(textArea);
  }
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderEmptyState(container, { icon = 'inbox', title = 'No items found', desc = '', actionText = null, actionHref = null, onAction = null }) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        <i data-lucide="${icon}"></i>
      </div>
      <h3 class="empty-state-title">${title}</h3>
      ${desc ? `<p class="empty-state-desc">${desc}</p>` : ''}
      ${actionText ? `
        <${actionHref ? `a href="${actionHref}"` : 'button id="emptyStateActionBtn"'} class="btn btn-primary">
          ${actionText}
        </${actionHref ? 'a' : 'button'}>
      ` : ''}
    </div>
  `;

  if (onAction && !actionHref) {
    const btn = container.querySelector('#emptyStateActionBtn');
    if (btn) btn.onclick = onAction;
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
