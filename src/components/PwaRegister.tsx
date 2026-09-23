'use client';

import { useEffect } from 'react';
import { withBasePath } from '@/shared/utils/api';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        const swUrl = withBasePath('/sw.js');
        const swScope = withBasePath('/');

        navigator.serviceWorker
          .register(swUrl, { scope: swScope })
          .then((registration) => {
            console.log('PWA ServiceWorker registrado com sucesso:', registration.scope);
          })
          .catch((error) => {
            console.error('Falha ao registrar ServiceWorker do PWA:', error);
          });
      });
    }
  }, []);

  return null;
}
