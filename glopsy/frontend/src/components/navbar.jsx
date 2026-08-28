import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Home, 
  ShoppingBag, 
  ShoppingCart, 
  User, 
  Menu, 
  X, 
  ChevronDown,
  LogOut,
  Heart,
  LogIn,
  Store,
  Sun,
  Moon,
  Bell,
  Fingerprint,
  Package
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { markNotificationRead, markAllNotificationsRead, clearAllNotifications } from '../services/notificationsService';
import { subscribeToPush } from '../services/pushService';
import { openDeepLink } from '../utils/deeplink';

export default function Navbar() {
  const { user, logout, tienda, tiendaLoading } = useAuth();
  const navigate = useNavigate();

  const openNotification = (n) => {
    const url = n.url || n.fallbackUrl || '';
    if (n.scheme) {
      openDeepLink(n.scheme, n.fallbackUrl || n.url || '/', navigate);
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener');
    } else if (url.startsWith('/')) {
      navigate(url);
    } else if (url) {
      window.open('https://' + url, '_blank', 'noopener');
    }
    setNotifications(prev => prev.map(x => (String(x.id) === String(n.id) ? { ...x, read: true } : x)));
    markNotificationRead(n.id).catch(() => {});
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('glopsy_notifications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('glopsy_notifications', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('glopsy_notifications');
        if (saved) setNotifications(JSON.parse(saved));
      } catch {}
    };
    const handleChanged = () => {
      try {
        const saved = localStorage.getItem('glopsy_notifications');
        if (saved) setNotifications(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('glopsy_notifications_changed', handleChanged);
    const handleCustomNotif = (e) => {
      if (e.detail && e.detail.id) {
        setNotifications(prev => {
          if (prev.some(n => String(n.id) === String(e.detail.id))) return prev;
          return [e.detail, ...prev];
        });
      }
    };
    window.addEventListener('glopsy_notification', handleCustomNotif);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('glopsy_notifications_changed', handleChanged);
      window.removeEventListener('glopsy_notification', handleCustomNotif);
    };
  }, []);
  const [pushPermission] = useState(() => 
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (pushPermission !== 'granted') return;
    const t = setTimeout(() => { subscribeToPush().catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, [user, pushPermission]);
  const [biometricStatus, setBiometricStatus] = useState('');

  const bufferDecode = (value) => {
    if (!value) return value;
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const bufferToBase64Url = (buffer) => {
    if (typeof buffer === 'string') return buffer;
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const handleRegisterBiometric = async () => {
    if (!window.PublicKeyCredential) {
      alert('Tu navegador no soporta autenticación biométrica (WebAuthn).');
      return;
    }
    try {
      let res = await api.post('/auth/biometric/register-options');

      if (res.data.options === undefined && res.data.message === 'Ya posees una huella') {
        const replace = window.confirm('Ya posees una huella registrada. ¿Deseas reemplazarla?');
        if (!replace) return;
        await api.delete('/auth/biometric');
        res = await api.post('/auth/biometric/register-options');
      }

      const opts = res.data.options;
      const publicKeyCredentialCreationOptions = {
        ...opts,
        challenge: bufferDecode(opts.challenge),
        user: {
          ...opts.user,
          id: bufferDecode(opts.user.id),
        },
        excludeCredentials: (opts.excludeCredentials || []).map(c => ({
          ...c,
          id: bufferDecode(c.id)
        })),
      };

      const credential = await navigator.credentials.create({ publicKey: publicKeyCredentialCreationOptions });
      const credentialData = {
        id: credential.id,
        rawId: credential.id,
        type: credential.type,
        response: {
          attestationObject: bufferToBase64Url(credential.response.attestationObject),
          clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
          transports: credential.response.getTransports
            ? (() => { try { return credential.response.getTransports(); } catch (e) { return ['internal']; } })()
            : ['internal'],
        },
      };

      await api.post('/auth/biometric/register-verify', credentialData);
      setBiometricStatus('¡Huella biométrica registrada con éxito!');
      setTimeout(() => setBiometricStatus(''), 4000);
    } catch (err) {
      console.error('Error registrando huella biométrica:', err);
      const serverMsg = err.response?.data?.message;
      if (serverMsg === 'Ya posees una huella') {
        const replace = window.confirm('Ya posees una huella registrada. ¿Deseas reemplazarla?');
        if (replace) {
          try {
            await api.delete('/auth/biometric');
            setBiometricStatus('Huella eliminada. Pulsa el icono de nuevo para registrarla.');
            setTimeout(() => setBiometricStatus(''), 4000);
          } catch (e) {
            alert('No se pudo eliminar la huella biométrica.');
          }
        }
        return;
      }
      alert(serverMsg || 'No se pudo registrar la huella biométrica.');
    }
  };

  const navRef = useRef(null);
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const items = JSON.parse(localStorage.getItem('glopsy_cart') || '[]');
        const totalCount = items.reduce((acc, item) => acc + Number(item.quantity || 1), 0);
        setCartItemCount(totalCount);
      } catch {
        setCartItemCount(0);
      }
    };

    updateCount();
    window.addEventListener('storage', updateCount);
    const interval = setInterval(updateCount, 500);
    return () => {
      window.removeEventListener('storage', updateCount);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
        setIsUserMenuOpen(false);
        setIsNotifOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  };

  const UserAvatar = ({ size = 'h-8 w-8' }) => {
    const [imageError, setImageError] = useState(false);
    const avatarUrl = user?.avatar_url || user?.avatarUrl || user?.picture;

    if (!avatarUrl || imageError) {
      return (
        <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-white/25`}>
          <User size={18} aria-hidden="true" />
        </span>
      );
    }

    return (
      <img
        src={avatarUrl}
        alt={`Foto de ${user.name || user.email || 'usuario'}`}
        className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white/70`}
        referrerPolicy="no-referrer"
        onError={() => setImageError(true)}
      />
    );
  };

  return (
    <nav ref={navRef} className="relative bg-white dark:bg-black text-black dark:text-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-2 cursor-pointer group">
            <img
              src="/glopsy.png"
              alt="Glopsy"
              className="h-12 w-auto object-contain group-hover:scale-105 transition-transform"
            />
          </Link>

          {/* Navegación Desktop */}
          <div className="hidden md:flex items-center space-x-6">
            
            <Link 
              to="/" 
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-black dark:text-white hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 transition-all duration-200"
            >
              <Home size={18} className="text-fuchsia-500" />
              <span>Home</span>
            </Link>

            <Link 
              to="/listpr" 
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-black dark:text-white hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 transition-all duration-200"
            >
              <ShoppingBag size={18} className="text-fuchsia-500" />
              <span>Productos</span>
            </Link>

            {!user && (
              <Link 
                to="/consultar-pedido" 
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-black dark:text-white hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 transition-all duration-200"
              >
                <Package size={18} className="text-fuchsia-500" />
                <span>Consultar Pedido</span>
              </Link>
            )}

            <Link 
              to="/cart" 
              className="relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-black dark:text-white hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 transition-all duration-200"
            >
              <div className="relative">
                <ShoppingCart size={18} className="text-fuchsia-500" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm shadow-fuchsia-500/30">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span>Carrito</span>
            </Link>

            {user && !tiendaLoading && tienda && (
              <Link to="/market" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-black dark:text-white hover:text-fuchsia-600 dark:hover:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 transition-all duration-200">
                <Store size={18} className="text-fuchsia-500" />
                <span>Mi tienda</span>
              </Link>
            )}

            {/* Theme Toggle Button Desktop */}
            <button
              onClick={toggleTheme}
              className="p-1 bg-transparent border-0 text-slate-700 dark:text-yellow-400 hover:scale-110 transition-transform cursor-pointer"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Notification Bell Icon */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsNotifOpen(prev => !prev); setIsUserMenuOpen(false); }}
                className="p-1 bg-transparent border-0 text-slate-700 dark:text-white hover:scale-110 transition-transform cursor-pointer relative"
                title="Notificaciones"
              >
                <Bell size={20} className="text-fuchsia-600 dark:text-fuchsia-400" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold animate-pulse">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
            </div>

            {/* Fingerprint / Biometric Button (if logged in) */}
            {user && (
              <button
                onClick={handleRegisterBiometric}
                className="p-1 bg-transparent border-0 text-fuchsia-600 dark:text-fuchsia-400 hover:scale-110 transition-transform cursor-pointer"
                title="Registrar huella biométrica"
              >
                <Fingerprint size={20} />
              </button>
            )}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md shadow-fuchsia-600/20 cursor-pointer"
                >
                  <UserAvatar />
                  <span>{user.name || user.email || 'Mi Cuenta'}</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#18181b] shadow-2xl rounded-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Link 
                      to="/profile" 
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black dark:text-slate-200 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 hover:text-fuchsia-600 transition-colors"
                    >
                      <User size={16} className="text-fuchsia-500" />
                      <span>Mi Perfil</span>
                    </Link>
                    <Link 
                      to="/favorites" 
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black dark:text-slate-200 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 hover:text-fuchsia-600 transition-colors"
                    >
                      <Heart size={16} className="text-fuchsia-500" />
                      <span>Favoritos</span>
                    </Link>
                    <Link 
                      to="/compras" 
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black dark:text-slate-200 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 hover:text-fuchsia-600 transition-colors"
                    >
                      <Package size={16} className="text-fuchsia-500" />
                      <span>Compras</span>
                    </Link>
                    <hr className="my-1 border-slate-100 dark:border-zinc-800" />
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm font-semibold text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer"
                    >
                      <LogOut size={16} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md shadow-fuchsia-600/20"
              >
                <LogIn size={18} />
                <span>Iniciar Sesión</span>
              </Link>
            )}

          </div>

          {/* Botón Menú Móvil y Toggle */}
          <div className="md:hidden flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-1 bg-transparent border-0 text-slate-700 dark:text-yellow-400 hover:scale-110 transition-transform cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsNotifOpen(prev => !prev); setIsMobileMenuOpen(false); }}
              className="p-1 bg-transparent border-0 text-slate-700 dark:text-white relative cursor-pointer"
            >
              <Bell size={20} className="text-fuchsia-600 dark:text-fuchsia-400" />
              {notifications.some(n => !n.read) && (
                <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold animate-pulse">
                  {notifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            {user && (
              <button
                onClick={handleRegisterBiometric}
                className="p-1 bg-transparent border-0 text-fuchsia-600 dark:text-fuchsia-400 cursor-pointer"
              >
                <Fingerprint size={20} />
              </button>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 focus:outline-none transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

        </div>
      </div>

      {/* Menú Desplegable Móvil */}
      {isMobileMenuOpen && (
        <div className="absolute inset-x-0 top-full md:hidden bg-white dark:bg-[#121212] px-4 pt-2 pb-4 space-y-2 shadow-lg transition-all">
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-black font-semibold dark:text-white hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 text-base"
          >
            <Home size={20} className="text-fuchsia-500" />
            Inicio
          </Link>

          {user && !tiendaLoading && tienda && (
            <Link to="/market" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-black font-semibold dark:text-white hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 text-base">
              <Store size={20} className="text-fuchsia-500" />
              Mi tienda
            </Link>
          )}
          <Link
            to="/listpr"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-black font-semibold dark:text-white hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 text-base"
          >
            <ShoppingBag size={20} className="text-fuchsia-500" />
            Productos
          </Link>
          {!user && (
            <Link
              to="/consultar-pedido"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-black font-semibold dark:text-white hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 text-base"
            >
              <Package size={20} className="text-fuchsia-500" />
              Consultar Pedido
            </Link>
          )}
          <Link
            to="/cart"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-black font-semibold dark:text-white hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 text-base"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart size={20} className="text-fuchsia-500" />
              Carrito
            </div>
            {cartItemCount > 0 && (
              <span className="bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {cartItemCount}
              </span>
            )}
          </Link>

          <div className="pt-2 space-y-1">
            {user ? (
              <>
                <div className="px-3 py-1 text-xs font-semibold text-fuchsia-600 uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <UserAvatar size="h-9 w-9" />
                    {user.name || user.email || 'Mi Cuenta'}
                  </span>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-black font-semibold dark:text-white hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 text-base"
                >
                  <User size={20} className="text-fuchsia-500" />
                  Mi Perfil
                </Link>
                <Link
                  to="/favorites"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-black font-semibold dark:text-white hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 text-base"
                >
                  <Heart size={20} className="text-fuchsia-500" />
                  Favoritos
                </Link>
                <Link
                  to="/compras"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-black font-semibold dark:text-white hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-zinc-800 text-base"
                >
                  <Package size={20} className="text-fuchsia-500" />
                  Compras
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-zinc-800 text-base font-medium cursor-pointer"
                >
                  <LogOut size={20} />
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white py-2 rounded-lg font-medium transition-colors shadow-md shadow-fuchsia-600/20"
              >
                <LogIn size={18} />
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      )}

      {isNotifOpen && (() => {
        const isDark = theme === 'dark';
        return (
          <>
            <div 
              className="fixed inset-0 z-[998] bg-black/20 dark:bg-black/50 backdrop-blur-[1px]" 
              onClick={() => setIsNotifOpen(false)}
            />
            <div 
              className="fixed top-20 left-1/2 -translate-x-1/2 w-80 max-w-[95vw] md:w-[26rem] md:max-w-[30rem] lg:w-[30rem] lg:max-w-[34rem] xl:w-[32rem] shadow-2xl rounded-2xl py-3 px-4 md:py-4 md:px-5 z-[9999] animate-in fade-in slide-in-from-top-2 duration-200 border"
              style={{
                backgroundColor: isDark ? '#18181b' : '#ffffff',
                color: isDark ? '#f1f5f9' : '#0f172a',
                borderColor: isDark ? '#27272a' : '#e2e8f0'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className="flex items-center justify-between mb-2 pb-2 border-b"
                style={{ borderColor: isDark ? '#27272a' : '#e2e8f0' }}
              >
                <h4 className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>Notificaciones</h4>
                <div className="flex items-center gap-2.5">
                  <button 
                    type="button"
                    onClick={() => {
                      setNotifications(notifications.map(n => ({ ...n, read: true })));
                      markAllNotificationsRead().catch(() => {});
                    }}
                    className="text-[11px] text-fuchsia-600 dark:text-fuchsia-400 font-semibold hover:underline cursor-pointer"
                  >
                    Marcar leídas
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      try {
                        const cleared = new Set(JSON.parse(localStorage.getItem('glopsy_notifications_cleared') || '[]'));
                        notifications.forEach(n => cleared.add(String(n.id)));
                        localStorage.setItem('glopsy_notifications_cleared', JSON.stringify([...cleared]));
                      } catch {}
                      setNotifications([]);
                      window.dispatchEvent(new Event('glopsy_notifications_cleared'));
                      clearAllNotifications().catch(() => {});
                    }}
                    className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hover:underline cursor-pointer"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-60 md:max-h-[26rem] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: isDark ? '#a1a1aa' : '#64748b' }}>No hay notificaciones</p>
                ) : (
                  notifications.map(n => {
                    const cardBg = isDark ? (n.read ? '#1e1e24' : '#27272a') : (n.read ? '#f8fafc' : '#fdf4ff');
                    const cardBorder = isDark ? '#3f3f46' : (n.read ? '#e2e8f0' : '#f5d0fe');
                    const cardColor = isDark ? '#f1f5f9' : '#0f172a';
                    const timeColor = isDark ? '#a1a1aa' : '#64748b';
                    return (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          openNotification(n);
                          setIsNotifOpen(false);
                        }}
                        className="p-2.5 md:p-3.5 rounded-xl text-xs md:text-sm transition-colors border cursor-pointer hover:opacity-90"
                        style={{
                          backgroundColor: cardBg,
                          borderColor: cardBorder,
                          color: cardColor
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold truncate">{n.title}</p>
                          <span
                            className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: n.read ? (isDark ? '#27272a' : '#e2e8f0') : (isDark ? '#3f1128' : '#fce7f3'),
                              color: n.read ? (isDark ? '#a1a1aa' : '#64748b') : (isDark ? '#f9a8d4' : '#db2777')
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: n.read ? (isDark ? '#52525b' : '#94a3b8') : (isDark ? '#f0abfc' : '#ec4899') }}
                            />
                            {n.read ? 'Leída' : 'Nueva'}
                          </span>
                        </div>
                        <span className="text-[10px] mt-0.5 block" style={{ color: timeColor }}>{n.time}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        );
      })()}

      {biometricStatus && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-bold animate-bounce">
          {biometricStatus}
        </div>
      )}
    </nav>
  );
}
