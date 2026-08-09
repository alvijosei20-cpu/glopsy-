import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tienda, setTienda] = useState(null);
  const [tiendaLoading, setTiendaLoading] = useState(false);

  const fetchUserStore = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setTienda(null);
      return null;
    }
    setTiendaLoading(true);
    try {
      const { data } = await api.get('/tienda');
      setTienda(data.tienda);
      return data.tienda;
    } catch {
      setTienda(null);
      return null;
    } finally {
      setTiendaLoading(false);
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      if (!localStorage.getItem('token')) {
        setIsLoading(false);
        return;
      }

      try {
        await fetchCurrentUser();
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (user) fetchUserStore();
    else setTienda(null);
  }, [user, fetchUserStore]);

  const login = useCallback(async (token) => {
    localStorage.setItem('token', token);
    const u = await fetchCurrentUser();
    const guestHash = localStorage.getItem('glopsy_guest_hash');
    if (guestHash) {
      try {
        await api.post('/product/migrate-cart', { guestHash });
      } catch (err) {
        console.error('Error al migrar carrito de invitado:', err);
      }
    }
    return u;
  }, [fetchCurrentUser]);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // El cierre local siempre se completa incluso si la red falla.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setTienda(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, tienda, tiendaLoading, setTienda }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
