import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plug, KeyRound, Send, Palette, ExternalLink } from 'lucide-react';
import StoreCard from './StoreCard';
import { useAuth } from '../../context/AuthContext';
import { ApiLoadingModal } from '../../components/LoadingScreen';
import api from '../../services/api';
import { PALETTE_OPTIONS } from '../../storefront/appearance';
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
  const [appearance, setAppearance] = useState({
    template: 'dashboard', theme: 'auto', palette: 'fucsia', color: '#c026d3', banner: '',
  });
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [tiktok, setTiktok] = useState({ client_id: '', client_secret: '', redirect_uri: '', scopes: '', enabled: true, configured: false, source: 'none' });
  const [savingTiktok, setSavingTiktok] = useState(false);
  const [tiktokMsg, setTiktokMsg] = useState('');
  const [pixel, setPixel] = useState({ id: '', token: '', tokenMasked: '', hasToken: false, saving: false, msg: '' });

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

  useEffect(() => {
    if (!tienda) return;
    setAppearance({
      template: tienda.storefrontTemplate || 'dashboard',
      theme: tienda.storefrontTheme || 'auto',
      palette: tienda.storefrontPalette || 'fucsia',
      color: tienda.storefrontColor || '#c026d3',
      banner: tienda.storefrontBanner || '',
    });
  }, [tienda?.storefrontTemplate, tienda?.storefrontTheme, tienda?.storefrontPalette, tienda?.storefrontColor, tienda?.storefrontBanner]);

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

  const handleSaveAppearance = async (e) => {
    e.preventDefault();
    setSavingAppearance(true);
    setError('');
    setNotice('');
    try {
      const res = await api.put('/tienda/storefront', appearance);
      setNotice(res.data?.message || 'Apariencia guardada con éxito.');
      refreshTienda?.();
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible guardar la apariencia.');
    } finally {
      setSavingAppearance(false);
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
      />
      {notice && <p className="panel__notice" role="status">{notice}</p>}

      <div className="market__grid">

      <section className="market__card" aria-labelledby="integrations-title">
        <h2 className="market__card-title" id="integrations-title">
          <Plug size={18} aria-hidden="true" /> Integraciones
        </h2>
        <p className="market__hint">Configura tus claves para sincronizar productos.</p>
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

        <article className="integration-card" style={{ marginTop: '1rem' }}>
          <div className="integration-card__brand">
            <span className="integration-logo" style={{ background: '#111', color: '#fff' }} aria-hidden="true">T</span>
            <div>
              <h3>TikTok Pixel</h3>
              <span className="integration-card__state">{pixel.id ? 'Configurado' : 'No configurado'}</span>
            </div>
          </div>
          <p className="market__hint" style={{ margin: '0.25rem 0 0.75rem' }}>
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
        </article>

        {tienda?.isMain && (
          <article className="integration-card" style={{ marginTop: '1rem' }}>
            <div className="integration-card__brand">
              <span className="integration-logo" style={{ background: '#111', color: '#fff' }} aria-hidden="true">T</span>
              <div>
                <h3>TikTok Auth</h3>
                <span className="integration-card__state">
                  {tiktok.configured ? 'Configurado' : 'No configurado'}{tiktok.source === 'env' ? ' · env' : ''}
                </span>
              </div>
            </div>
            <p className="market__hint" style={{ margin: '0.25rem 0 0.75rem' }}>
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
          </article>
        )}
      </section>

      <section className="market__card" aria-labelledby="appearance-title">
        <h2 className="market__card-title" id="appearance-title">
          <Palette size={18} aria-hidden="true" /> Apariencia de tu vitrina
        </h2>
        <p className="market__hint">Elige plantilla, tema y colores de tu tienda.</p>

        <form onSubmit={handleSaveAppearance}>
          <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.9rem' }}>Plantilla</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', margin: '0.5rem 0 1.25rem' }}>
            {[
              { id: 'dashboard', name: 'Dashboard', desc: 'Promos, descuentos y novedades' },
              { id: 'catalog', name: 'Catálogo', desc: 'Lista total de productos' },
              { id: 'boutique', name: 'Boutique', desc: 'Portada y destacados' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAppearance({ ...appearance, template: t.id })}
                style={{
                  textAlign: 'left', padding: '0.75rem', borderRadius: '0.75rem', cursor: 'pointer',
                  border: appearance.template === t.id ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: appearance.template === t.id ? '#f5f3ff' : 'white',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{t.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.desc}</div>
              </button>
            ))}
          </div>

          <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.9rem' }}>Tema</label>
          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0 1.25rem', flexWrap: 'wrap' }}>
            {[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([id, name]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAppearance({ ...appearance, theme: id })}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                  border: appearance.theme === id ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                  background: appearance.theme === id ? '#f5f3ff' : 'white', color: '#0f172a',
                }}
              >
                {name}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.9rem' }}>Paleta de colores</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', margin: '0.5rem 0 1rem', alignItems: 'center' }}>
            {PALETTE_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                onClick={() => setAppearance({ ...appearance, palette: p.id })}
                style={{
                  width: 40, height: 40, borderRadius: '50%', cursor: 'pointer',
                  backgroundImage: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                  border: appearance.palette === p.id ? '3px solid #0f172a' : '2px solid transparent',
                  boxShadow: '0 0 0 1px #cbd5e1',
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => setAppearance({ ...appearance, palette: 'custom' })}
              style={{
                padding: '0.4rem 0.8rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                border: appearance.palette === 'custom' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                background: appearance.palette === 'custom' ? '#f5f3ff' : 'white', color: '#0f172a',
              }}
            >
              Personalizado
            </button>
            {appearance.palette === 'custom' && (
              <input
                type="color"
                value={appearance.color}
                onChange={(e) => setAppearance({ ...appearance, color: e.target.value })}
                style={{ width: 40, height: 40, borderRadius: '0.5rem', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              />
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
              Banner (plantilla Boutique, opcional)
            </label>
            <input
              value={appearance.banner}
              onChange={(e) => setAppearance({ ...appearance, banner: e.target.value })}
              placeholder="https://…/banner.jpg"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="action-button" disabled={savingAppearance}>
              {savingAppearance ? 'Guardando…' : 'Guardar apariencia'}
            </button>
          </div>
        </form>
      </section>
      </div>
    </section>
  );
};

export default Market;
