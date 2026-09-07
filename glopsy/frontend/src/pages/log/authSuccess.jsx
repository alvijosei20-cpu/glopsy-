import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

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
        await login();
        navigate('/', { replace: true });
      } catch {
        navigate('/login?error=oauth', { replace: true });
      }
    })();
  }, [login, navigate]);

  return <p>Completando inicio de sesión…</p>;
}
