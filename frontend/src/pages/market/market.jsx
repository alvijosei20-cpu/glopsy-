import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plug, KeyRound, Send } from 'lucide-react';
import StoreCard from './StoreCard';
import { useAuth } from '../../context/AuthContext';
import { ApiLoadingModal } from '../../components/LoadingScreen';
import api from '../../services/api';
import '../panel/panel.css';

const Market = () => {
  const navigate = useNavigate();
  const { tienda, setTienda } = useAuth();
  if (!tienda) return null;

  const [updating, setUpdating] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [apiKeys, setApiKeys] = useState({ mastershop: '', dropi: '' });

  const integrations = [
    { id: 'mastershop', name: 'Mastershop', mark: 'M', className: 'integration-logo--mastershop' },
    { id: 'dropi', name: 'Dropi', mark: 'D', className: 'integration-logo--dropi' },
  ];

  // Cargar integraciones al montar
  useEffect(() => {
    const fetchIntegraciones = async () => {
      try {
        const { data } = await api.get('/tienda/integraciones');
        if (data && data.integraciones) {
          setApiKeys({
            mastershop: data.integraciones.mastershop || '',
            dropi: data.integraciones.dropi || '',
          });
        }
      } catch (err) {
        console.error('Error al cargar integraciones:', err);
      }
    };
    fetchIntegraciones();
  }, []);

  const updateKey = (provider, value) => setApiKeys((current) => ({ ...current, [provider]: value }));

  const saveKey = async (provider) => {
    setEditingKey(null);
    setError('');
    setNotice('');
    setApiStatus('loading');
    try {
      const { data } = await api.post('/tienda/integraciones', {
        provider,
        apiKey: apiKeys[provider],
      });
      if (data && data.integraciones) {
        setApiKeys({
          mastershop: data.integraciones.mastershop || '',
          dropi: data.integraciones.dropi || '',
        });
      }
      setApiStatus('success');
      setNotice(`API key de ${provider === 'mastershop' ? 'Mastershop' : 'Dropi'} guardada con éxito.`);
      setTimeout(() => setApiStatus('idle'), 1400);
    } catch (err) {
      setApiStatus('error');
      setError(err.response?.data?.message || 'No se pudo guardar la integración.');
      setTimeout(() => setApiStatus('idle'), 2000);
    }
  };

  const toggleStatus = async () => {
    if (!tienda || updating) return;
    setUpdating(true);
    setApiStatus('loading');
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch('/tienda/estado', { isActive: !tienda.isActive });
      setTienda(data.tienda);
      setApiStatus('success');
      setTimeout(() => setApiStatus('idle'), 1400);
    } catch {
      setApiStatus('error');
      setError('No se pudo actualizar el estado. Inténtalo de nuevo.');
      setTimeout(() => setApiStatus('idle'), 2000);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="market-title">
      <ApiLoadingModal
        status={apiStatus}
        message="Enviando..."
        successMessage="¡Guardado con éxito!"
        errorMessage="Ocurrió un error"
      />

      <div className="panel__heading">
        <div>
          <p className="panel__eyebrow">Panel de control</p>
          <h1 id="market-title">Mi tienda</h1>
          <p>Gestiona la disponibilidad de tu espacio comercial.</p>
        </div>
      </div>

      {error && <div className="panel__error" role="alert">{error}</div>}
      <StoreCard
        tienda={tienda}
        updating={updating}
        onToggleStatus={toggleStatus}
        onConfig={() => navigate('/market/config')}
        onPublish={() => navigate('/publish')}
      />
      {notice && <p className="panel__notice" role="status">{notice}</p>}

      <section className="integrations" aria-labelledby="integrations-title">
        <div className="integrations__heading">
          <div>
            <p className="panel__eyebrow">Conecta tus proveedores</p>
            <h2 className="font-bold text-xl tracking-wide bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent" id="integrations-title">
              <Plug size={22} aria-hidden="true" /> Integraciones
            </h2>
          </div>
          <p>Configura tus claves para sincronizar productos.</p>
        </div>
        <div className="integrations__grid">
          {integrations.map((integration) => {
            const isEditing = editingKey === integration.id;
            return (
              <article className="integration-card" key={integration.id}>
                <div className="integration-card__brand">
                  <span className={`integration-logo ${integration.className}`} aria-hidden="true">{integration.mark}</span>
                  <div>
                    <h3>{integration.name}</h3>
                    <span className="integration-card__state">API key</span>
                  </div>
                </div>
                <label className="integration-card__label" htmlFor={`${integration.id}-key`}>Clave de API</label>
                <div className="integration-card__key-field">
                  <KeyRound size={17} aria-hidden="true" />
                  <input
                    id={`${integration.id}-key`}
                    type="password"
                    value={apiKeys[integration.id]}
                    onChange={(event) => updateKey(integration.id, event.target.value)}
                    placeholder="Ingresa tu API key"
                    disabled={!isEditing}
                    autoComplete="off"
                  />
                </div>
                <div className="integration-card__actions">
                  <button className="integration-button integration-button--edit" type="button" onClick={() => setEditingKey(isEditing ? null : integration.id)}>
                    <Pencil size={16} /> {isEditing ? 'Cancelar' : 'Editar'}
                  </button>
                  <button
                    className="integration-button integration-button--send"
                    type="button"
                    onClick={() => saveKey(integration.id)}
                    disabled={integration.id === 'dropi' || !isEditing || !apiKeys[integration.id].trim()}
                    title={integration.id === 'dropi' ? 'Próximamente disponible' : undefined}
                  >
                    <Send size={16} /> Enviar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
};

export default Market;
