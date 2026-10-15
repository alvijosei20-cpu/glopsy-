import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Palette, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiLoadingModal } from '../../components/LoadingScreen';
import api from '../../services/api';
import { PALETTE_OPTIONS } from '../../storefront/appearance';
import '../panel/panel.css';
import './market.css';

const TEMPLATES = [
  { id: 'dashboard', name: 'Dashboard', desc: 'Promos, descuentos y novedades' },
  { id: 'catalog', name: 'Catálogo', desc: 'Lista total de productos' },
  { id: 'boutique', name: 'Boutique', desc: 'Portada y destacados' },
];

const THEMES = [
  ['auto', 'Automático'],
  ['light', 'Claro'],
  ['dark', 'Oscuro'],
];

const Vitrina = () => {
  const { tienda, refreshTienda } = useAuth();
  const [appearance, setAppearance] = useState({
    template: 'dashboard', theme: 'auto', palette: 'fucsia', color: '#c026d3', banner: '',
  });
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

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

  if (!tienda) return null;

  const handleSaveAppearance = async (e) => {
    e.preventDefault();
    setSavingAppearance(true);
    setApiStatus('loading');
    setError('');
    setNotice('');
    try {
      const res = await api.put('/tienda/storefront', appearance);
      setApiStatus('success');
      setNotice(res.data?.message || 'Apariencia guardada con éxito.');
      refreshTienda?.();
      setTimeout(() => setApiStatus('idle'), 1400);
    } catch (err) {
      setApiStatus('error');
      setError(err.response?.data?.message || 'No fue posible guardar la apariencia.');
      setTimeout(() => setApiStatus('idle'), 2000);
    } finally {
      setSavingAppearance(false);
    }
  };

  const label = { display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.9rem' };

  return (
    <section className="panel" aria-labelledby="vitrina-title">
      <ApiLoadingModal
        status={apiStatus}
        message="Guardando..."
        successMessage="¡Guardado con éxito!"
        errorMessage="Ocurrió un error"
      />

      <div className="market__top">
        <div className="market__intro">
          <p className="panel__eyebrow">Panel de control</p>
          <h1 id="vitrina-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Palette size={26} color="#7e22ce" aria-hidden="true" /> Apariencia de tu vitrina
          </h1>
          <p className="market__subtitle">Elige plantilla, tema y colores de tu tienda.</p>
        </div>
        <Link
          to="/market"
          className="market__visit"
          style={{ backgroundImage: 'none', background: '#7e22ce' }}
        >
          <ArrowLeft size={16} /> Volver a mi tienda
        </Link>
      </div>

      {error && <div className="panel__error" role="alert">{error}</div>}
      {notice && <p className="panel__notice" role="status">{notice}</p>}

      <section className="market__card" aria-labelledby="appearance-title">
        <h2 className="market__card-title" id="appearance-title">
          <Palette size={18} aria-hidden="true" /> Personaliza tu tienda
        </h2>
        <p className="market__hint">Los cambios se aplican a tu vitrina pública.</p>

        <form onSubmit={handleSaveAppearance}>
          <label style={label}>Plantilla</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', margin: '0.5rem 0 1.25rem' }}>
            {TEMPLATES.map((t) => (
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

          <label style={label}>Tema</label>
          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0 1.25rem', flexWrap: 'wrap' }}>
            {THEMES.map(([id, name]) => (
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

          <label style={label}>Paleta de colores</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', margin: '0.5rem 0 1rem', alignItems: 'center' }}>
            {PALETTE_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                aria-label={p.name}
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
                aria-label="Color personalizado"
                value={appearance.color}
                onChange={(e) => setAppearance({ ...appearance, color: e.target.value })}
                style={{ width: 40, height: 40, borderRadius: '0.5rem', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              />
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ ...label, marginBottom: '0.35rem' }}>
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

export default Vitrina;
