import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { openDeepLink } from '../utils/deeplink';

export default function DeepLinkPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Abriendo la app...');
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const scheme = params.get('scheme') || '';
    const fallback = params.get('fallback') || '/';
    if (!scheme) {
      navigate(fallback, { replace: true });
      return;
    }
    setMessage('Si la app no se abre, serás redirigido...');
    openDeepLink(scheme, fallback, navigate);
    const t = setTimeout(() => {
      if (!document.hidden) navigate(fallback, { replace: true });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-white dark:bg-zinc-950">
      <div className="w-12 h-12 rounded-2xl bg-fuchsia-600/10 flex items-center justify-center animate-pulse">
        <svg className="w-6 h-6 text-fuchsia-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{message}</p>
      <button
        type="button"
        onClick={() => navigate(fallback, { replace: true })}
        className="text-xs text-fuchsia-600 dark:text-fuchsia-400 font-semibold hover:underline cursor-pointer"
      >
        Continuar en la web
      </button>
    </div>
  );
}
