import { useState, useEffect, useCallback } from 'react';

type Permission = 'default' | 'granted' | 'denied';

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'default')
  );
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
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
    if (typeof Notification === 'undefined') return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const canNotify = swReady && permission === 'granted';
  const shouldPrompt = permission === 'default';

  return { permission, swReady, canNotify, shouldPrompt, requestPermission };
}
