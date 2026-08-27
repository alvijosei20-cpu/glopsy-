import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Navbar from './components/navbar';

import { useState, useEffect, lazy, Suspense } from 'react';
import { LoadingScreen, ConfiguringScreen } from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
// 1. IMPORTAR useAuth JUNTO A AuthProvider
import { AuthProvider, useAuth } from './context/AuthContext';
import { loadGA, trackPageView } from './utils/analytics';
import NotificationCenter from './components/NotificationCenter';

const Home = lazy(() => import('./pages/home/home'));
const Cart = lazy(() => import('./pages/cart/cart'));
const Checkout = lazy(() => import('./pages/cart/checkout'));
const ProductDetail = lazy(() => import('./pages/product/product'));
const Login = lazy(() => import('./pages/log/login'));
const AuthSuccess = lazy(() => import('./pages/log/authSuccess'));
const Panel = lazy(() => import('./pages/panel/panel'));
const Market = lazy(() => import('./pages/market/market'));
const MarketConfig = lazy(() => import('./pages/market/MarketConfig'));
const Analytics = lazy(() => import('./pages/market/Analytics'));
const ProductsManage = lazy(() => import('./pages/market/ProductsManage'));
const Publish = lazy(() => import('./pages/publish/publish'));
const Listpr = lazy(() => import('./pages/listpr/listpr'));
const Favorites = lazy(() => import('./pages/favorites/favorites'));
const Compras = lazy(() => import('./pages/compras/compras'));
const CompraDetail = lazy(() => import('./pages/compras/compraDetail'));
const ConsultarPedido = lazy(() => import('./pages/compras/consultarPedido'));
const Profile = lazy(() => import('./pages/profile/profile'));
const DeepLinkPage = lazy(() => import('./pages/DeepLinkPage'));
const Terms = lazy(() => import('./pages/terms/terms'));
const Privacidad = lazy(() => import('./pages/privacidad/privacidad'));

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
  const location = useLocation();
  const [locationReady, setLocationReady] = useState(
    sessionStorage.getItem('location_confirmed') === 'true'
  );

  useEffect(() => {
    loadGA();
  }, []);

  useEffect(() => {
    if (!locationReady) return;
    const t = setTimeout(() => trackPageView(location.pathname + location.search), 300);
    return () => clearTimeout(t);
  }, [location, locationReady]);

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
        <Suspense fallback={<ConfiguringScreen message="Cargando Glopsy ..." />}>
        <Routes>
          {/* RUTAS PÚBLICAS */}
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<ProductDetail />} />
          <Route path="/product/:id" element={<ErrorBoundary><ProductDetail /></ErrorBoundary>} />
          <Route path="/products/:id" element={<ErrorBoundary><ProductDetail /></ErrorBoundary>} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          
          <Route
            path="/login" 
            element={user ? <Navigate to="/panel" replace /> : <ErrorBoundary><Login /></ErrorBoundary>} 
          />
          <Route path="/auth/success" element={<AuthSuccess />} />

          <Route path="/listpr" element={<Listpr />} />
          <Route path="/terminos" element={<Terms />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route 
            path="/favorites" 
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
          <Route path="/consultar-pedido" element={<ConsultarPedido />} />
          <Route path="/deep-link" element={<DeepLinkPage />} />
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
            element={<CompraDetail />}
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
          <Route path="/market/analytics" element={<StoreRoute><Analytics /></StoreRoute>} />
          <Route path="/market/products" element={<StoreRoute><ProductsManage /></StoreRoute>} />
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
        </Suspense>
      </main>
    </div>
  );
}


// Exportamos App envuelta en el AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
      <NotificationCenter />
    </AuthProvider>
  );
}
