import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { registerNotificationActions } from '../utils/notifications';

type Permission = 'default' | 'granted' | 'denied';

const isNative = () => Capacitor.isNativePlatform();

// Maps the plugin's permission state onto the web Notification API's three
// values, so the rest of the app has one vocabulary regardless of backend.
function fromPluginState(state: string): Permission {
  if (state === 'granted') return 'granted';
  if (state === 'prompt' || state === 'prompt-with-rationale') return 'default';
  return 'denied';
}

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>(
    () => (!isNative() && typeof Notification !== 'undefined' ? Notification.permission : 'default')
  );
  // On native the OS owns scheduling, so there's nothing to wait for — the
  // equivalent readiness gate is just "the plugin is available".
  const [swReady, setSwReady] = useState(() => isNative());

  useEffect(() => {
    if (isNative()) {
      // Action buttons must be registered before the first notification is
      // scheduled or iOS renders it without them.
      registerNotificationActions();
      LocalNotifications.checkPermissions()
        .then((res) => setPermission(fromPluginState(res.display)))
        .catch(console.error);
      return;
    }
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'activated') setSwReady(true);
        });
      });
      if (reg.active) setSwReady(true);
    }).catch(console.error);
  }, []);

  const requestPermission = useCallback(async (): Promise<Permission> => {
    if (isNative()) {
      try {
        const res = await LocalNotifications.requestPermissions();
        const next = fromPluginState(res.display);
        setPermission(next);
        return next;
      } catch (err) {
        console.error('Failed to request notification permission:', err);
        return 'denied';
      }
    }
    if (typeof Notification === 'undefined') return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const canNotify = swReady && permission === 'granted';
  const shouldPrompt = permission === 'default';

  return { permission, swReady, canNotify, shouldPrompt, requestPermission };
}
