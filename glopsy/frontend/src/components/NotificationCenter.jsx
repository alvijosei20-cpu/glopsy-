import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, ExternalLink, AppWindow, X } from 'lucide-react';
import { fetchNotifications, markNotificationRead } from '../services/notificationsService';

const POLL_MS = 30 * 1000;
const AVISO_AUTOHIDE_MS = 10 * 1000;

function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function readFromStorage() {
  try {
    return JSON.parse(localStorage.getItem('glopsy_notifications') || '[]');
  } catch {
    return [];
  }
}

function writeToStorage(list) {
  try {
    localStorage.setItem('glopsy_notifications', JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event('glopsy_notifications_changed'));
}

function mergeIntoBell(notifs) {
  const bell = readFromStorage();
  const byId = new Map(bell.map((n) => [String(n.id), n]));
  for (const n of notifs) {
    const prev = byId.get(String(n.id));
    byId.set(String(n.id), {
      id: n.id,
      title: n.title,
      message: n.message,
      time: n.createdAt ? new Date(n.createdAt).toLocaleString() : '',
      read: Boolean(n.read),
      type: n.type,
      ...(prev ? { read: Boolean(n.read) || Boolean(prev.read) } : {}),
    });
  }
  const merged = [...byId.values()];
  merged.sort((a, b) => (b.id > a.id ? 1 : -1));
  writeToStorage(merged);
  return merged.filter((n) => !n.read);
}

function markReadLocally(id) {
  writeToStorage(readFromStorage().map((n) => (String(n.id) === String(id) ? { ...n, read: true } : n)));
}

function openUrl(n, navigate) {
  const url = n.url || '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.open(url, '_blank', 'noopener');
  } else if (url.startsWith('/')) {
    navigate(url);
  } else if (url) {
    window.open('https://' + url, '_blank', 'noopener');
  }
}

function openDeepLink(n, navigate) {
  const scheme = n.scheme || '';
  if (!scheme) return;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = scheme;
    document.body.appendChild(iframe);
    setTimeout(() => {
      iframe.remove();
      if (n.fallbackUrl) {
        openUrl({ url: n.fallbackUrl }, navigate);
      }
    }, 1500);
  } else {
    let opened = false;
    const onBlur = () => {
      opened = true;
    };
    window.addEventListener('blur', onBlur);
    setTimeout(() => {
      window.removeEventListener('blur', onBlur);
      if (!opened && n.fallbackUrl) {
        openUrl({ url: n.fallbackUrl }, navigate);
      }
    }, 1500);
    window.location.href = scheme;
  }
}

function Toast({ notif, theme, onDismiss, onAction }) {
  const [leaving, setLeaving] = useState(false);
  const hoverRef = useRef(false);
  const timerRef = useRef(null);

  const config = {
    aviso: { Icon: BellRing, label: 'Aviso' },
    link: { Icon: ExternalLink, label: 'Enlace' },
    app: { Icon: AppWindow, label: 'App' },
  }[notif.type] || { Icon: BellRing, label: 'Aviso' };

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onDismiss, 150);
  };

  useEffect(() => {
    if (notif.type !== 'aviso') return;
    const schedule = () => {
      clearTimeout(timerRef.current);
      if (!hoverRef.current) {
        timerRef.current = setTimeout(dismiss, AVISO_AUTOHIDE_MS);
      }
    };
    schedule();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dark = theme === 'dark';

  return (
    <div
      className={`rounded-2xl border shadow-2xl max-w-sm w-[calc(100vw-32px)] animate-in fade-in slide-in-from-bottom-2 duration-200 ${leaving ? 'animate-out fade-out slide-out-to-bottom-2' : ''}`}
      style={{
        backgroundColor: dark ? '#18181b' : '#ffffff',
        color: dark ? '#f1f5f9' : '#0f172a',
        borderColor: dark ? '#27272a' : '#e2e8f0',
      }}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
    >
      <div className="flex gap-3 p-3">
        <div className="shrink-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner"
            style={{
              backgroundColor: dark ? '#1e1b2e' : '#fdf4ff',
            }}
          >
            <config.Icon size={20} className="text-fuchsia-600 dark:text-fuchsia-400" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold mb-0.5" style={{ color: dark ? '#ffffff' : '#0f172a' }}>
            {notif.title}
          </p>
          {notif.message && (
            <p className="text-[11px] leading-snug mb-2 break-words" style={{ color: dark ? '#a1a1aa' : '#475569' }}>
              {notif.message}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAction(notif)}
              className="bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] hover:opacity-90 transition-opacity cursor-pointer shadow-md shadow-fuchsia-600/20"
            >
              {notif.type === 'aviso' ? 'Entendido' : notif.type === 'link' ? 'Abrir' : 'Abrir app'}
            </button>
            <span className="text-[10px]" style={{ color: dark ? '#64748b' : '#94a3b8' }}>
              {config.label}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={dismiss}
          className="shrink-0 self-start p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(isDarkMode() ? 'dark' : 'light');
  const shownRef = useRef(new Set());

  const handleAction = useCallback(
    async (notif) => {
      setToasts((prev) => prev.filter((t) => t.id !== notif.id));
      markReadLocally(notif.id);
      if (notif.type === 'link') openUrl(notif, navigate);
      else if (notif.type === 'app') openDeepLink(notif, navigate);
      try {
        await markNotificationRead(notif.id);
      } catch {}
    },
    [navigate]
  );

  const handleDismiss = useCallback(async (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    markReadLocally(id);
    try {
      await markNotificationRead(id);
    } catch {}
  }, []);

  const poll = useCallback(async () => {
    try {
      const list = await fetchNotifications();
      const unread = mergeIntoBell(list);
      setToasts((prev) => {
        const current = new Set(prev.map((t) => t.id));
        const fresh = unread
          .filter((n) => !shownRef.current.has(String(n.id)) && !current.has(String(n.id)))
          .slice(0, 4);
        fresh.forEach((n) => shownRef.current.add(String(n.id)));
        return [...prev, ...fresh];
      });
    } catch {}
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      setTheme(isDarkMode() ? 'dark' : 'light');
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    const interval = setInterval(poll, POLL_MS);
    poll();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      clearInterval(interval);
    };
  }, [poll]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-3 items-end pointer-events-none"
      aria-live="polite"
    >
      {toasts.slice(0, 4).map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast notif={t} theme={theme} onDismiss={() => handleDismiss(t.id)} onAction={handleAction} />
        </div>
      ))}
    </div>
  );
}
