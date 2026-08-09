import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AuthSuccess() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');

    if (!token) {
      navigate('/login?error=oauth', { replace: true });
      return;
    }

    login(token)
      .then(() => navigate('/panel', { replace: true }))
      .catch(() => navigate('/login?error=oauth', { replace: true }));
  }, [login, navigate]);

  return <p>Completando inicio de sesión…</p>;
}
