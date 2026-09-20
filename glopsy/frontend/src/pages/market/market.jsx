import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plug, KeyRound, Send, Palette } from 'lucide-react';
import StoreCard from './StoreCard';
import { useAuth } from '../../context/AuthContext';
import { ApiLoadingModal } from '../../components/LoadingScreen';
import api from '../../services/api';
import { PALETTE_OPTIONS } from '../../storefront/appearance';
import '../panel/panel.css';
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
        onAnalytics={() => navigate('/market/analytics')}
        onProducts={() => navigate('/market/products')}
        onMarketing={() => navigate('/market/marketing')}
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

      <section className="integrations" aria-labelledby="appearance-title">
        <div className="integrations__heading">
          <div>
            <p className="panel__eyebrow">Diseño de tu tienda</p>
            <h2 className="font-bold text-xl tracking-wide bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent" id="appearance-title">
              <Palette size={22} aria-hidden="true" /> Apariencia de tu vitrina
            </h2>
          </div>
          <p>Elige plantilla, tema y colores de tu tienda.</p>
        </div>

        <form onSubmit={handleSaveAppearance} style={{ marginTop: '1rem' }}>
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
    </section>
  );
};

export default Market;
