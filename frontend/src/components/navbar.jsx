import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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
  LogIn
  ,Store
} from 'lucide-react';

// 1. Importar el hook de autenticación (asegúrate de que la ruta coincida con tu estructura de carpetas)
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  // 2. Extraer los valores del contexto
  const { user, logout, tienda, tiendaLoading } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Referencias para detectar los clics fuera del menú
  const navRef = useRef(null);

  // Contador dinámico del carrito
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

  // Efecto para escuchar los clics fuera del Navbar
  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
        setIsUserMenuOpen(false);
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
    <nav ref={navRef} className="relative bg-white text-slate-800 sticky top-0 z-50 shadow-md border-b border-fuchsia-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-2 cursor-pointer group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-fuchsia-600 to-pink-500 flex items-center justify-center font-bold text-xl text-white shadow-md shadow-fuchsia-500/20 group-hover:scale-105 transition-transform">
              S
            </div>
            <span className="font-bold text-xl tracking-wide bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
              StoreApp
            </span>
          </Link>

          {/* Navegación Desktop */}
          <div className="hidden md:flex items-center space-x-6">
            
            {/* Home */}
            <Link 
              to="/" 
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all duration-200"
            >
              <Home size={18} className="text-fuchsia-500" />
              <span>Home</span>
            </Link>

            {/* Products */}
            <Link 
              to="/listpr" 
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all duration-200"
            >
              <ShoppingBag size={18} className="text-fuchsia-500" />
              <span>Productos</span>
            </Link>

            {/* Cart */}
            <Link 
              to="/cart" 
              className="relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all duration-200"
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
              <Link to="/market" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-600 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all duration-200">
                <Store size={18} className="text-fuchsia-500" />
                <span>Mi tienda</span>
              </Link>
            )}

            {/* Renderizado Condicional: Autenticación en Desktop */}
            {user ? (
              /* Usuario con sesión iniciada */
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md shadow-fuchsia-600/20"
                >
                  <UserAvatar />
                  <span>{user.name || user.email || 'Mi Cuenta'}</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Menú Desplegable de Usuario */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-fuchsia-100 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Link 
                      to="/profile" 
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-fuchsia-50 hover:text-fuchsia-600 transition-colors"
                    >
                      <User size={16} className="text-fuchsia-500" />
                      <span>Mi Perfil</span>
                    </Link>
                    <Link 
                      to="/favorites" 
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-fuchsia-50 hover:text-fuchsia-600 transition-colors"
                    >
                      <Heart size={16} className="text-fuchsia-500" />
                      <span>Favoritos</span>
                    </Link>
                    <hr className="my-1 border-fuchsia-100" />
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-pink-600 hover:bg-pink-50 transition-colors text-left"
                    >
                      <LogOut size={16} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Usuario SIN sesión iniciada */
              <Link
                to="/login"
                className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md shadow-fuchsia-600/20"
              >
                <LogIn size={18} />
                <span>Iniciar Sesión</span>
              </Link>
            )}

          </div>

          {/* Botón Menú Móvil */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-fuchsia-600 hover:bg-fuchsia-50 focus:outline-none transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

        </div>
      </div>

      {/* Menú Desplegable Móvil */}
      {isMobileMenuOpen && (
        <div className="absolute inset-x-0 top-full md:hidden bg-white border-b border-fuchsia-100 px-4 pt-2 pb-4 space-y-2 shadow-lg transition-all">
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 hover:text-fuchsia-600 hover:bg-fuchsia-50 text-base font-medium"
          >
            <Home size={20} className="text-fuchsia-500" />
            Inicio
          </Link>

          {user && !tiendaLoading && tienda && (
            <Link to="/market" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 hover:text-fuchsia-600 hover:bg-fuchsia-50 text-base font-medium">
              <Store size={20} className="text-fuchsia-500" />
              Mi tienda
            </Link>
          )}
          <Link
            to="/listpr"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 hover:text-fuchsia-600 hover:bg-fuchsia-50 text-base font-medium"
          >
            <ShoppingBag size={20} className="text-fuchsia-500" />
            Productos
          </Link>
          <Link
            to="/cart"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 hover:text-fuchsia-600 hover:bg-fuchsia-50 text-base font-medium"
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

          {/* Renderizado Condicional: Autenticación en Móvil */}
          <div className="pt-2 border-t border-fuchsia-100 space-y-1">
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
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 hover:text-fuchsia-600 hover:bg-fuchsia-50 text-base font-medium"
                >
                  <User size={20} className="text-fuchsia-500" />
                  Mi Perfil
                </Link>
                <Link
                  to="/favorites"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 hover:text-fuchsia-600 hover:bg-fuchsia-50 text-base font-medium"
                >
                  <Heart size={20} className="text-fuchsia-500" />
                  Favoritos
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-pink-600 hover:bg-pink-50 text-base font-medium"
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
    </nav>
  );
}
