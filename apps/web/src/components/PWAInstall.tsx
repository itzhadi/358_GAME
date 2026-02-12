'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
      return;
    }

    // Only register SW in production
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    // Unregister SW in development to avoid cache issues
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
      });
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!mounted || isStandalone) return null;

  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 glass-strong rounded-2xl p-4 shadow-2xl animate-slide-up glow-primary">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-sm">📲 התקן אפליקציה</p>
            <p className="text-xs text-muted-foreground">שחק מסך מלא!</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDeferredPrompt(null)}>
              לא עכשיו
            </Button>
            <Button size="sm" onClick={handleInstall}>
              התקן
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isIOS && !showIOSHint) {
    return (
      <button
        onClick={() => setShowIOSHint(true)}
        className="fixed bottom-4 left-4 glass rounded-full px-4 py-2 text-xs shadow-lg glow-primary"
      >
        📲 התקן
      </button>
    );
  }

  if (isIOS && showIOSHint) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 glass-strong rounded-2xl p-4 shadow-2xl animate-slide-up">
        <button
          onClick={() => setShowIOSHint(false)}
          className="absolute top-3 left-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
        <p className="font-bold text-sm mb-1">📲 התקנה באייפון:</p>
        <p className="text-xs text-muted-foreground">
          לחצו על כפתור השיתוף (⬆️) בתחתית הדפדפן → &quot;הוסף למסך הבית&quot;
        </p>
      </div>
    );
  }

  return null;
}
