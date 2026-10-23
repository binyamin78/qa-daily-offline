
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export const isNative = () => Capacitor.isNativePlatform();

export const copyText = async (text: string): Promise<boolean> => {
  try {
    // Some WebViews leave the promise pending forever instead of rejecting
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => setTimeout(() => reject(new Error('clipboard timeout')), 1500)),
    ]);
    return true;
  } catch {
    // Older WebViews / insecure contexts - fall back to a hidden textarea
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
};

export type ShareResult = 'shared' | 'cancelled' | 'unavailable';

// System share sheet: WhatsApp, Telegram, Gmail, Slack...
export const shareText = async (text: string, title: string): Promise<ShareResult> => {
  try {
    if (isNative()) {
      await Share.share({ text, title, dialogTitle: 'שיתוף הדוח' });
      return 'shared';
    }
    if (typeof navigator.share === 'function') {
      await navigator.share({ text, title });
      return 'shared';
    }
    return 'unavailable';
  } catch {
    return 'cancelled';
  }
};

// api.whatsapp.com opens the WhatsApp app when installed and falls back to the website otherwise
export const openWhatsApp = (text: string) => {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  if (isNative()) {
    // Capacitor hands external URLs to Android as an intent
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener');
  }
};
