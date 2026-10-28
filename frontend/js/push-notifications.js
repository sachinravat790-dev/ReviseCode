/**
 * Native Phone Lock-Screen & Browser Web Push Notification Controller
 * (frontend/js/push-notifications.js)
 */

import { api } from './api.js';
import { showToast } from './utils.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushNotificationManager {
  constructor() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    this.registration = null;
    this.subscription = null;
  }

  async init() {
    if (!this.isSupported) {
      console.warn('Web Push Notifications are not supported in this browser.');
      this.updateUI('unsupported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.subscription = await this.registration.pushManager.getSubscription();

      if (Notification.permission === 'granted' && this.subscription) {
        this.updateUI('subscribed');
      } else if (Notification.permission === 'denied') {
        this.updateUI('blocked');
      } else {
        this.updateUI('default');
      }
    } catch (err) {
      console.warn('Service worker registration error:', err.message);
      this.updateUI('default');
    }
  }

  async subscribe() {
    if (!this.isSupported) {
      showToast('Notifications', 'Push notifications are not supported in this browser.', 'error');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Notifications', 'Notification permission was denied. Please allow in browser settings.', 'warning');
        this.updateUI('blocked');
        return false;
      }

      // Fetch VAPID public key
      const keyRes = await api.get('/push/public-key');
      const publicKey = keyRes.data?.publicKey;

      if (!publicKey) {
        throw new Error('VAPID public key missing from server');
      }

      const convertedKey = urlBase64ToUint8Array(publicKey);
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      const subJson = this.subscription.toJSON();
      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys
      });

      this.updateUI('subscribed');
      showToast('Push Notifications', 'Phone lock-screen push notifications activated!', 'success');
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      showToast('Push Error', err.message || 'Could not subscribe to push notifications', 'error');
      return false;
    }
  }

  async sendTest() {
    if (!this.subscription) {
      const ok = await this.subscribe();
      if (!ok) return;
    }

    try {
      const subJson = this.subscription.toJSON();
      await api.post('/push/test', {
        endpoint: subJson.endpoint,
        keys: subJson.keys
      });
      showToast('Push Test', 'Test notification sent! Check your phone lock screen or status bar.', 'success');
    } catch (err) {
      // Local fallback in case server dispatch encounters connection issues
      if (Notification.permission === 'granted') {
        this.registration?.showNotification('🎯 ReviseCode Day 3 Revision Test', {
          body: 'Native notification active! You will get daily spaced repetition reminders right here.',
          icon: '/favicon.ico',
          vibrate: [200, 100, 200]
        });
        showToast('Push Test', 'Test notification delivered locally to your screen!', 'success');
      } else {
        showToast('Push Error', err.message || 'Could not send test notification', 'error');
      }
    }
  }

  updateUI(state) {
    const statusBadge = document.getElementById('pushStatusBadge');
    const enableBtn = document.getElementById('btnEnablePush');
    const testBtn = document.getElementById('btnTestPush');

    if (!statusBadge || !enableBtn) return;

    if (state === 'unsupported') {
      statusBadge.textContent = 'Not Supported';
      statusBadge.className = 'badge badge-neutral';
      enableBtn.disabled = true;
      enableBtn.textContent = 'Browser Not Supported';
      if (testBtn) testBtn.style.display = 'none';
    } else if (state === 'subscribed') {
      statusBadge.textContent = '✅ Active on This Device';
      statusBadge.className = 'badge badge-success';
      enableBtn.textContent = '✅ Notifications Enabled';
      enableBtn.classList.remove('btn-primary');
      enableBtn.classList.add('btn-secondary');
      enableBtn.disabled = true;
      if (testBtn) testBtn.style.display = 'inline-flex';
    } else if (state === 'blocked') {
      statusBadge.textContent = '🚫 Blocked in Browser';
      statusBadge.className = 'badge badge-danger';
      enableBtn.textContent = 'Permission Blocked';
      enableBtn.disabled = true;
      if (testBtn) testBtn.style.display = 'none';
    } else {
      statusBadge.textContent = 'Not Active';
      statusBadge.className = 'badge badge-warning';
      enableBtn.textContent = '📲 Enable Lock-Screen Notifications';
      enableBtn.classList.remove('btn-secondary');
      enableBtn.classList.add('btn-primary');
      enableBtn.disabled = false;
      if (testBtn) testBtn.style.display = 'none';
    }
  }
}

export const pushManager = new PushNotificationManager();
