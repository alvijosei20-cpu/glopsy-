import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { SkeletonList } from '../../components/SkeletonLoader';
import { TERMS_VERSION, PRIVACY_VERSION } from '../../utils/termsContent';

export default function AuthSuccess() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        // OAuth devuelve un código de un solo uso que se canjea por la cookie de
        // sesión en este dominio (el callback del proveedor corre en otro origen).
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          await api.post('/auth/oauth/consume', { code });
        }
        const user = await login();
        // Las redes sociales muestran el aviso de aceptación antes de continuar.
        // Se deja constancia del consentimiento si está pendiente o desactualizado.
        if (user?.terms_version !== TERMS_VERSION) {
          const timezone = (() => {
            try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; }
          })();
          await api.post('/auth/consent', {
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
            source: 'oauth',
            timezone,
          }).catch(() => {});
        }
        navigate('/', { replace: true });
      } catch {
        navigate('/login?error=oauth', { replace: true });
      }
    })();
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SkeletonList count={8} />
      </div>
    </div>
  );
}
