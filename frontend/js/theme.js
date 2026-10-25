/**
 * ReviseCode Theme Controller (js/theme.js)
 * Supports dark navy (default) and clean light themes with localStorage persistence.
 */
import './icons.js';

const THEME_KEY = 'revisecode_theme';

export function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  // Default is dark navy
  return 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeToggleIcons(theme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

function updateThemeToggleIcons(theme) {
  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    const icon = btn.querySelector('i, svg');
    if (icon) {
      if (theme === 'dark') {
        icon.setAttribute('data-lucide', 'sun');
      } else {
        icon.setAttribute('data-lucide', 'moon');
      }
    }
  });
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Auto initialize on load
const currentTheme = getPreferredTheme();
applyTheme(currentTheme);

document.addEventListener('DOMContentLoaded', () => {
  updateThemeToggleIcons(currentTheme);
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  });
});
