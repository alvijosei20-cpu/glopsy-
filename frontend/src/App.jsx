import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Navbar from './components/navbar';
import Home from './pages/home/home';
import Cart from './pages/cart/cart';
import Checkout from './pages/cart/checkout';
import Products from './pages/product/product';
import ProductDetail from './pages/product/product';
import Login from './pages/log/login';
import AuthSuccess from './pages/log/authSuccess';
import Panel from './pages/panel/panel';
import Market from './pages/market/market';
import MarketConfig from './pages/market/MarketConfig';
import Publish from './pages/publish/publish';
import Listpr from './pages/listpr/listpr';
import Favorites from './pages/favorites/favorites';
import Compras from './pages/compras/compras';
import CompraDetail from './pages/compras/compraDetail';
import Profile from './pages/profile/profile';

import { useState, useEffect } from 'react';
import { LoadingScreen, ConfiguringScreen } from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
// 1. IMPORTAR useAuth JUNTO A AuthProvider
import { AuthProvider, useAuth } from './context/AuthContext';

// Componente para proteger rutas privadas
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function StoreRoute({ children }) {
  const { user, isLoading, tienda, tiendaLoading } = useAuth();
  if (isLoading || tiendaLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!tienda) return <Navigate to="/" replace />;
  return children;
}

// Separamos el contenido principal para poder usar `useAuth` de forma segura
function MainApp() {
  console.log('MainApp RENDER');
  const [showSplash, setShowSplash] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, isLoading } = useAuth();
  const [locationReady, setLocationReady] = useState(
    sessionStorage.getItem('location_confirmed') === 'true'
  );

  useEffect(() => {
    const checkLocation = () => {
      setLocationReady(sessionStorage.getItem('location_confirmed') === 'true');
    };
    window.addEventListener('storage', checkLocation);
    const interval = setInterval(checkLocation, 500);
    return () => {
      window.removeEventListener('storage', checkLocation);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  // Mostrar splash si la ubicación ya está confirmada
  useEffect(() => {
    if (locationReady) {
      setShowSplash(true);
      const t = setTimeout(() => setShowSplash(false), 1700);
      return () => clearTimeout(t);
    }
  }, [locationReady]);

  if (!locationReady) {
    return <LoadingScreen onLocationReady={() => setLocationReady(true)} />;
  }

  if (loading || isLoading) {
    return <ConfiguringScreen message="Configurando Glopsy ..." />;
  }
  if (showSplash) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#181818',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            border: '6px solid #444',
            borderTop: '6px solid #fff',
            borderRadius: '50%',
            animation: 'spinSplash 1s linear infinite',
            marginBottom: 30,
          }}
        />
        <h2 style={{ fontWeight: 900, fontSize: '2rem', marginBottom: 12 }}>
          Configurando Glopsy ...
        </h2>
        <style>
          {`
            @keyframes spinSplash {
              0% { transform: rotate(0deg);}
              100% { transform: rotate(360deg);}
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />

      <main className="app-content">
        <Routes>
          {/* RUTAS PÚBLICAS */}
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ErrorBoundary><ProductDetail /></ErrorBoundary>} />
          <Route path="/products/:id" element={<ErrorBoundary><ProductDetail /></ErrorBoundary>} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          
          <Route
            path="/login" 
            element={user ? <Navigate to="/panel" replace /> : <Login />} 
          />
          <Route path="/auth/success" element={<AuthSuccess />} />

          <Route path="/listpr" element={<Listpr />} />
          <Route 
            path="/favorites" 
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/compras" 
            element={
              <ProtectedRoute>
                <Compras />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/compras/:hash" 
            element={
              <ProtectedRoute>
                <CompraDetail />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route path="/market" element={<StoreRoute><Market /></StoreRoute>} />
          <Route path="/market/config" element={<StoreRoute><MarketConfig /></StoreRoute>} />
          <Route path="/publish" element={<StoreRoute><Publish /></StoreRoute>} />

          
         <Route 
            path="/panel" 
            element={
              <ProtectedRoute>
                <Panel />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}


// Exportamos App envuelta en el AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
