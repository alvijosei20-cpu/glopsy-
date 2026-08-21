import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AuthSuccess() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    login()
      .then(() => navigate('/panel', { replace: true }))
      .catch(() => navigate('/login?error=oauth', { replace: true }));
  }, [login, navigate]);

  return <p>Completando inicio de sesión…</p>;
}
