// src/components/LoadingScreen.tsx

import { useEffect, useState } from 'react';
import { MapPin, AlertTriangle, RefreshCw, Send, CheckCircle2 } from 'lucide-react';

// 1. Pantalla para pedir la ubicación (cuando no hay coordenadas)
export function LoadingScreen({ onLocationReady }: { onLocationReady?: () => void }) {
  const [geoStatus, setGeoStatus] = useState<'pending' | 'denied' | 'error' | 'success'>('pending');
  const [geoError, setGeoError] = useState('');
  const [locateMsg, setLocateMsg] = useState('Solicitando permiso de ubicación...');
  const [deniedCount, setDeniedCount] = useState(0);

  useEffect(() => {
    pedirUbicacion();
  }, []);

  const pedirUbicacion = () => {
    setGeoError('');
    setGeoStatus('pending');
    setLocateMsg('Solicitando permiso de ubicación...');
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoError('La geolocalización no está disponible en tu navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setLocateMsg('Obteniendo tu ciudad...');
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`)
          .then(res => res.json())
          .then(data => {
            sessionStorage.setItem('location_city', data.city || data.locality || 'Ciudad desconocida');
            sessionStorage.setItem('location_country', data.countryName || 'País desconocido');
            sessionStorage.setItem('location_confirmed', 'true');
            setGeoStatus('success');
            if (onLocationReady) onLocationReady();
          })
          .catch(() => {
            setGeoStatus('error');
            setGeoError('No se pudo obtener tus datos de ciudad.');
          });
      },
      error => {
        setGeoStatus('denied');
        setDeniedCount(count => count + 1);
        if (error.code === 1) setGeoError('Debes permitir la ubicación para continuar.');
        else setGeoError('Ocurrió un error obteniendo tu ubicación.');
      },
      { timeout: 10000 }
    );
  };

  if (geoStatus === 'success') return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {geoStatus === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
            <div style={styles.spinner}></div>
            <h2 style={{ color: '#ffffff', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.75rem 0', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
              Permiso de Ubicación Requerido
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#e2e8f0', fontSize: '0.95rem', margin: 0 }}>
              <MapPin style={{ color: '#ec4899', flexShrink: 0 }} size={18} />
              <span>{locateMsg}</span>
            </div>
          </div>
        )}
        {(geoStatus === 'denied' || geoStatus === 'error') && (
          <>
            <AlertTriangle color="#fbbf24" size={32} style={{ marginBottom: '6px' }} />
            <p style={{...styles.text, marginBottom:'0.5rem', color:'#fbbf24'}}>{geoError}</p>
            <button 
              onClick={pedirUbicacion} 
              style={{
                padding: '0.7rem 1.3rem', borderRadius: '9px',
                border: '0',
                background: 'linear-gradient(90deg,#db2777 30%, #9333ea 100%)',
                color: '#fff', fontWeight: 700, fontSize: '1rem',
                letterSpacing: '.02em', boxShadow: '0 2px 12px #7c3aed30',
                display:'flex',alignItems:'center',gap:'7px',
                margin:'0.2rem', cursor:'pointer'
              }}
            >
              <RefreshCw size={18} /> Volver a intentar
            </button>
            {deniedCount >= 2 && (
              <div style={{ color: '#fff', marginTop: 16, fontSize: '1rem', background: 'rgba(128, 0, 128, 0.2)', borderRadius: 12, padding: '1.1rem 1.2rem', boxShadow: '0 4px 18px #0003', textAlign: 'left', maxWidth: 350 }}>
                <div style={{display:'flex',alignItems:'center',marginBottom:8}}>
                  <AlertTriangle size={20} color="#fbbf24" style={{marginRight:8}} />
                  <b>¿No aparece la solicitud de ubicación?</b>
                </div>
                <span style={{color:'#fbbf24',fontWeight:600,fontSize:'1rem'}}>¡Sigue estos pasos para activarla!:</span>
                <ol style={{paddingLeft:22,margin:'10px 0 0'}}>
                  <li style={{marginBottom:5}}><span style={{color:'#a5b4fc'}}>1️⃣</span> Haz clic en el <b>icono del candado</b> (🔒) a la izquierda de la barra de direcciones.</li>
                  <li style={{marginBottom:5}}><span style={{color:'#a5b4fc'}}>2️⃣</span> Busca la sección <b>«Permisos»</b> y selecciona <span style={{color:'#fbbf24'}}>Permitir</span> en Ubicación.</li>
                  <li style={{marginBottom:5}}><span style={{color:'#a5b4fc'}}>3️⃣</span> Recarga <b>esta página</b> y cuando aparezca el cuadro, elige <span style={{color:'#34d399'}}>Permitir</span>.</li>
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// 2. Pantalla cuando ya hay coordenadas y se entra a la web ("Configurando Glopsy")
export function ConfiguringScreen({ message = 'Configurando Glopsy ...' }: { message?: string }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.spinner}></div>
        <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          {message}
        </h2>
        <p style={{ color: '#cbd5e1', fontSize: '0.95rem', margin: 0, textAlign: 'center' }}>
          Preparando tu experiencia...
        </p>
      </div>
    </div>
  );
}

// 3. Modal flotante transparente para peticiones al backend ("Enviando" y confirmación de éxito)
export function ApiLoadingModal({
  status,
  message = 'Enviando...',
  successMessage = '¡Guardado con éxito!',
  errorMessage = 'Ocurrió un error',
}: {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  successMessage?: string;
  errorMessage?: string;
}) {
  if (status === 'idle') return null;

  return (
    <div style={styles.apiModalOverlay}>
      <div style={styles.apiModalCard}>
        {status === 'loading' && (
          <>
            <div style={styles.apiModalSpinner}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Send style={{ color: '#db2777' }} size={20} />
              <h3 style={{ color: '#ffffff', fontSize: '1.15rem', fontWeight: 600, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
                {message}
              </h3>
            </div>
          </>
        )}
        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
            <CheckCircle2 style={{ color: '#34d399' }} size={42} />
            <h3 style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: 700, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
              {successMessage}
            </h3>
          </div>
        )}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
            <AlertTriangle style={{ color: '#fbbf24' }} size={40} />
            <h3 style={{ color: '#fbbf24', fontSize: '1.1rem', fontWeight: 600, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
              {errorMessage}
            </h3>
          </div>
        )}
      </div>
    </div>
  );
}

// Estilos inline centralizados
const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100vw',
    height: '100dvh',
    backgroundColor: 'rgba(221, 7, 100, 1.0)',
    background: 'linear-gradient(0deg, rgba(221, 7, 100, 1.0), rgba(1, 1, 1, 1.0))', 
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '2rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    minWidth: 'min(320px, 80vw)',
  },
  spinner: {
    width: '45px',
    height: '45px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderLeftColor: '#db2777',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '1.1rem',
  },
  text: {
    marginTop: '1rem',
    color: '#f8fafc',
    fontSize: '1.04rem',
    fontWeight: '500',
    fontFamily: 'sans-serif',
    textAlign: 'center' as const,
    marginBottom: '0.1rem',
    textShadow: '0 1px 6px #18181b33',
  },
  apiModalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  apiModalCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '1.5rem 2.2rem',
    borderRadius: '14px',
    backgroundColor: '#18181b',
    border: '1px solid rgba(219, 39, 119, 0.3)',
    boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.7), 0 0 15px rgba(219, 39, 119, 0.2)',
  },
  apiModalSpinner: {
    width: '38px',
    height: '38px',
    border: '3px solid rgba(255, 255, 255, 0.1)',
    borderTopColor: '#db2777',
    borderLeftColor: '#9333ea',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    marginBottom: '0.85rem',
  },
};

if (typeof window !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(styleSheet);
}
