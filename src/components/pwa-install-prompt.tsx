'use client';

import { useEffect, useState, useCallback } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'libretv-pwa-dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * PWA 安装引导：
 * - Android/Chrome：监听 beforeinstallprompt，横幅提供「安装」按钮
 * - iOS Safari：展示「分享 → 添加到主屏幕」操作指引
 * - 已安装（standalone）或用户已关闭过则不再显示
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS 不触发 beforeinstallprompt，直接展示手动指引
    if (isIOS()) {
      setShowIOS(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setDeferred(null);
  }, [deferred]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:pb-6">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-white/10 bg-[#111827]/95 p-4 shadow-2xl backdrop-blur">
        <img src="/icons/icon-192.png" alt="LibreTV" className="h-10 w-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">安装 LibreTV 到桌面</p>
          <p className="mt-0.5 text-xs text-white/60">
            {showIOS && !deferred
              ? '点击 Safari 底部分享按钮 → 添加到主屏幕'
              : '全屏观看体验，和原生 App 一样'}
          </p>
        </div>
        {deferred && (
          <button
            onClick={install}
            className="shrink-0 rounded-lg bg-[#3b82f6] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#2563eb]"
          >
            安装
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="关闭"
          className="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}