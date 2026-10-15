import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plug, KeyRound, Send, ExternalLink, ChevronDown } from 'lucide-react';
import StoreCard from './StoreCard';
import { useAuth } from '../../context/AuthContext';
import { ApiLoadingModal } from '../../components/LoadingScreen';
import api from '../../services/api';
import '../panel/panel.css';
import './market.css';
const Market = () => {
  const navigate = useNavigate();
  const { tienda, setTienda, refreshTienda } = useAuth();
  if (!tienda) return null;

  const [updating, setUpdating] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [apiKeys, setApiKeys] = useState({ mastershop: '', dropi: '' });
  const [initialApiKeys, setInitialApiKeys] = useState({ mastershop: '', dropi: '' });
  // Acordeón de integraciones: todas plegadas por defecto.
  const [openIntegration, setOpenIntegration] = useState(null);
  const toggleIntegration = (id) => setOpenIntegration((prev) => (prev === id ? null : id));
  const [tiktok, setTiktok] = useState({ client_id: '', client_secret: '', redirect_uri: '', scopes: '', enabled: true, configured: false, source: 'none' });
  const [savingTiktok, setSavingTiktok] = useState(false);
  const [tiktokMsg, setTiktokMsg] = useState('');
  const [pixel, setPixel] = useState({ id: '', token: '', tokenMasked: '', hasToken: false, saving: false, msg: '', testCode: '', testing: false, testResult: '' });

  const sendTestEvent = async () => {
    setPixel((p) => ({ ...p, testing: true, testResult: '' }));
    setError('');
    try {
      const { data } = await api.post('/tienda/integraciones/tiktok-pixel/test-event', {
        test_event_code: pixel.testCode.trim() || undefined,
      });
      setPixel((p) => ({
        ...p,
        testResult: data?.ok
          ? 'Evento de prueba enviado ✓ (revisa Events Manager → Test Events)'
          : `TikTok respondió: ${data?.response?.message || data?.reason || 'error'}`,
      }));
    } catch (err) {
      setPixel((p) => ({ ...p, testResult: err.response?.data?.message || 'No se pudo enviar el evento de prueba.' }));
    } finally {
      setPixel((p) => ({ ...p, testing: false }));
    }
  };

  // Pixel + token de TikTok de la tienda (marketing / Events API).
  useEffect(() => {
    setPixel((p) => ({ ...p, id: tienda?.tiktokPixelId || '', hasToken: Boolean(tienda?.tiktokAccessTokenSet) }));
    if (!tienda?.id) return;
    let alive = true;
    api
      .get('/tienda/integraciones/tiktok-pixel')
      .then(({ data }) => {
        if (!alive) return;
        const p = data?.pixel || {};
        setPixel((prev) => ({
          ...prev,
          id: p.pixel_id || prev.id,
          tokenMasked: p.access_token_masked || '',
          hasToken: Boolean(p.has_access_token),
        }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tienda?.id, tienda?.tiktokPixelId, tienda?.tiktokAccessTokenSet]);

  const savePixel = async () => {
    setPixel((p) => ({ ...p, saving: true, msg: '' }));
    setError('');
    try {
      const payload = { tiktok_pixel_id: pixel.id.trim() };
      if (pixel.token.trim()) payload.tiktok_access_token = pixel.token.trim();
      await api.patch('/tienda', payload);
      refreshTienda?.();
      setPixel((p) => ({ ...p, token: '', msg: 'Configuración de TikTok guardada.' }));
      setTimeout(() => setPixel((p) => ({ ...p, msg: '' })), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar la integración de TikTok.');
    } finally {
      setPixel((p) => ({ ...p, saving: false }));
    }
  };

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
          const loaded = {
            mastershop: data.integraciones.mastershop || '',
            dropi: data.integraciones.dropi || '',
          };
          setApiKeys(loaded);
          setInitialApiKeys(loaded);
        }
      } catch (err) {
        console.error('Error al cargar integraciones:', err);
      }
    };
    fetchIntegraciones();
  }, []);

  // Credenciales globales de TikTok Auth: solo la tienda principal.
  useEffect(() => {
    if (!tienda?.isMain) return;
    let alive = true;
    api
      .get('/tienda/integraciones/tiktok')
      .then(({ data }) => {
        if (alive && data?.auth) setTiktok(data.auth);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tienda?.isMain]);

  const saveTiktok = async () => {
    setSavingTiktok(true);
    setTiktokMsg('');
    setError('');
    try {
      const { data } = await api.post('/tienda/integraciones/tiktok', {
        clientId: tiktok.client_id,
        clientSecret: tiktok.client_secret,
        redirectUri: tiktok.redirect_uri,
        scopes: tiktok.scopes,
        enabled: tiktok.enabled,
      });
      if (data?.auth) setTiktok(data.auth);
      setTiktokMsg('Credenciales de TikTok guardadas.');
      setTimeout(() => setTiktokMsg(''), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudieron guardar las credenciales de TikTok.');
    } finally {
      setSavingTiktok(false);
    }
  };

  const updateKey = (provider, value) => setApiKeys((current) => ({ ...current, [provider]: value }));

  const saveKey = async (provider) => {
    setEditingKey(null);
    setError('');
    setNotice('');
    setApiStatus('loading');
    try {
      // Si la clave no cambió (sigue siendo el valor enmascarado), no enviar y conservar la existente
      const keyUnchanged = apiKeys[provider] === initialApiKeys[provider];
      const { data } = await api.post('/tienda/integraciones', {
        provider,
        ...(keyUnchanged ? {} : { apiKey: apiKeys[provider] }),
      });
      if (data && data.integraciones) {
        const loaded = {
          mastershop: data.integraciones.mastershop || '',
          dropi: data.integraciones.dropi || '',
        };
        setApiKeys(loaded);
        setInitialApiKeys(loaded);
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

      <div className="market__top">
        <div className="market__intro">
          <p className="panel__eyebrow">Panel de control</p>
          <h1 id="market-title">Mi tienda</h1>
          <p className="market__subtitle">Gestiona tu vitrina, integraciones y publicaciones.</p>
        </div>
        {tienda?.slug && (
          <a
            className="market__visit"
            href={`https://${tienda.slug}.${tienda.dominio_raiz || 'glopsy.shop'}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} />
            Ver mi tienda
          </a>
        )}
      </div>

      {error && <div className="panel__error" role="alert">{error}</div>}
      <StoreCard
        tienda={tienda}
        updating={updating}
        onToggleStatus={toggleStatus}
        onConfig={() => navigate('/market/config')}
        onPublish={() => navigate('/publish')}
        onAnalytics={() => navigate('/market/analytics')}
        onProducts={() => navigate('/market/products')}
        onMarketing={() => navigate('/market/marketing')}
        onLiquidaciones={() => navigate('/market/liquidaciones')}
        onAppearance={() => navigate('/market/vitrina')}
      />
      {notice && <p className="panel__notice" role="status">{notice}</p>}

      <div className="market__grid">

      <section className="market__card" aria-labelledby="integrations-title">
        <h2 className="market__card-title" id="integrations-title">
          <Plug size={18} aria-hidden="true" /> Integraciones
        </h2>
        <p className="market__hint">Configura tus claves para sincronizar productos.</p>
        <div className="accordion">
          {integrations.map((integration) => {
            const isEditing = editingKey === integration.id;
            const isOpen = openIntegration === integration.id;
            return (
              <div className={`accordion__item ${isOpen ? 'is-open' : ''}`} key={integration.id}>
                <button type="button" className="accordion__head" onClick={() => toggleIntegration(integration.id)} aria-expanded={isOpen}>
                  <span className={`integration-logo ${integration.className}`} aria-hidden="true">{integration.mark}</span>
                  <span className="accordion__meta">
                    <span className="accordion__title">{integration.name}</span>
                    <span className="integration-card__state">API key</span>
                  </span>
                  <ChevronDown size={18} className="accordion__chevron" aria-hidden="true" />
                </button>
                {isOpen && (
                  <div className="accordion__body">
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
                  </div>
                )}
              </div>
            );
          })}

          <div className={`accordion__item ${openIntegration === 'tiktok-pixel' ? 'is-open' : ''}`}>
            <button type="button" className="accordion__head" onClick={() => toggleIntegration('tiktok-pixel')} aria-expanded={openIntegration === 'tiktok-pixel'}>
              <span className="integration-logo" style={{ background: '#111', color: '#fff' }} aria-hidden="true">T</span>
              <span className="accordion__meta">
                <span className="accordion__title">TikTok Pixel</span>
                <span className="integration-card__state">{pixel.id ? 'Configurado' : 'No configurado'}</span>
              </span>
              <ChevronDown size={18} className="accordion__chevron" aria-hidden="true" />
            </button>
            {openIntegration === 'tiktok-pixel' && (
              <div className="accordion__body">
                <p className="market__hint" style={{ margin: '0 0 0.75rem' }}>
                  Pixel de TikTok de tu tienda para medir conversiones (visitas, carrito, compras) en tus campañas.
                </p>
                <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.8rem' }}>Pixel ID</label>
                <input
                  type="text"
                  value={pixel.id}
                  onChange={(e) => setPixel((p) => ({ ...p, id: e.target.value.trim() }))}
                  placeholder="Ej. C1A2B3D4E5F6G7H8"
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.6rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginTop: '0.3rem' }}
                />

                <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.8rem', marginTop: '0.6rem' }}>
                  Access Token <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Events API)</span>
                  {pixel.hasToken && <span style={{ color: '#15803d', fontWeight: 700 }}> · Guardado ✓</span>}
                </label>
                <input
                  type="password"
                  value={pixel.token}
                  onChange={(e) => setPixel((p) => ({ ...p, token: e.target.value }))}
                  placeholder={pixel.hasToken ? 'Guardado (deja vacío para conservar)' : 'Pega el token de acceso de TikTok'}
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.6rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginTop: '0.3rem' }}
                />
                <p className="market__hint" style={{ margin: '0.3rem 0 0' }}>
                  Se guarda cifrado y sirve para enviar conversiones server-side (Events API). No se muestra en la tienda.
                </p>
                {pixel.msg && <p className="panel__notice" role="status" style={{ marginTop: '0.6rem' }}>{pixel.msg}</p>}

                <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.8rem', marginTop: '0.9rem' }}>
                  Test Event Code <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional, para probar)</span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem' }}>
                  <input
                    type="text"
                    value={pixel.testCode}
                    onChange={(e) => setPixel((p) => ({ ...p, testCode: e.target.value.trim() }))}
                    placeholder="Ej. TEST12345"
                    autoComplete="off"
                    style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: '0.6rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={sendTestEvent}
                    disabled={pixel.testing || !pixel.id || !pixel.hasToken}
                    className="integration-button integration-button--edit"
                  >
                    <Send size={15} /> {pixel.testing ? 'Enviando…' : 'Probar'}
                  </button>
                </div>
                {pixel.testResult && (
                  <p className="market__hint" style={{ marginTop: '0.4rem', color: pixel.testResult.includes('✓') ? '#15803d' : '#b91c1c' }}>
                    {pixel.testResult}
                  </p>
                )}

                <div className="integration-card__actions">
                  <button
                    className="integration-button integration-button--send"
                    type="button"
                    onClick={savePixel}
                    disabled={pixel.saving}
                  >
                    <Send size={16} /> {pixel.saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>

        {tienda?.isMain && (
          <div className={`accordion__item ${openIntegration === 'tiktok-auth' ? 'is-open' : ''}`}>
            <button type="button" className="accordion__head" onClick={() => toggleIntegration('tiktok-auth')} aria-expanded={openIntegration === 'tiktok-auth'}>
              <span className="integration-logo" style={{ background: '#111', color: '#fff' }} aria-hidden="true">T</span>
              <span className="accordion__meta">
                <span className="accordion__title">TikTok Auth</span>
                <span className="integration-card__state">
                  {tiktok.configured ? 'Configurado' : 'No configurado'}{tiktok.source === 'env' ? ' · env' : ''}
                </span>
              </span>
              <ChevronDown size={18} className="accordion__chevron" aria-hidden="true" />
            </button>
            {openIntegration === 'tiktok-auth' && (
              <div className="accordion__body">
                <p className="market__hint" style={{ margin: '0 0 0.75rem' }}>
                  Credenciales globales de TikTok Login Kit para que tus clientes inicien sesión con TikTok.
                </p>

                <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.8rem', marginTop: '0.4rem' }}>Client Key</label>
                <input
                  type="text"
                  value={tiktok.client_id || ''}
                  onChange={(e) => setTiktok((t) => ({ ...t, client_id: e.target.value }))}
                  placeholder="Client Key de TikTok"
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.6rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />

                <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.8rem', marginTop: '0.6rem' }}>Client Secret</label>
                <input
                  type="password"
                  value={tiktok.client_secret || ''}
                  onChange={(e) => setTiktok((t) => ({ ...t, client_secret: e.target.value }))}
                  placeholder="Client Secret"
                  autoComplete="new-password"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.6rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />

                <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.8rem', marginTop: '0.6rem' }}>Redirect URI</label>
                <input
                  type="url"
                  value={tiktok.redirect_uri || ''}
                  onChange={(e) => setTiktok((t) => ({ ...t, redirect_uri: e.target.value }))}
                  placeholder="https://tu-backend.com/api/auth/tiktok/callback"
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.6rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />

                <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.8rem', marginTop: '0.6rem' }}>Scopes (opcional)</label>
                <input
                  type="text"
                  value={tiktok.scopes || ''}
                  onChange={(e) => setTiktok((t) => ({ ...t, scopes: e.target.value }))}
                  placeholder="user.info.basic,user.info.profile"
                  autoComplete="off"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.6rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.7rem', fontSize: '0.82rem', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={tiktok.enabled !== false}
                    onChange={(e) => setTiktok((t) => ({ ...t, enabled: e.target.checked }))}
                  />
                  Login con TikTok habilitado
                </label>

                {tiktokMsg && <p className="panel__notice" role="status" style={{ marginTop: '0.6rem' }}>{tiktokMsg}</p>}

                <div className="integration-card__actions">
                  <button
                    className="integration-button integration-button--send"
                    type="button"
                    onClick={saveTiktok}
                    disabled={savingTiktok || !tiktok.client_id?.trim() || !tiktok.redirect_uri?.trim() || (!tiktok.client_secret?.trim() && !tiktok.configured)}
                  >
                    <Send size={16} /> {savingTiktok ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </section>

      </div>
    </section>
  );
};

export default Market;
