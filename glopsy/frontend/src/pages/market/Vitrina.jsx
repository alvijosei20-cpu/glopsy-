import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Palette, ArrowLeft, LayoutTemplate, Moon, Droplet, Image as ImageIcon, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiLoadingModal } from '../../components/LoadingScreen';
import api from '../../services/api';
import { PALETTE_OPTIONS } from '../../storefront/appearance';
import '../panel/panel.css';

const TEMPLATES = [
  { id: 'dashboard', name: 'Dashboard', desc: 'Promos, descuentos y novedades' },
  { id: 'catalog', name: 'Catálogo', desc: 'Lista total de productos' },
  { id: 'boutique', name: 'Boutique', desc: 'Portada y destacados' },
  { id: 'minimal', name: 'Minimalista', desc: 'Limpia y enfocada en productos' },
  { id: 'lookbook', name: 'Lookbook', desc: 'Portada editorial y selección' },
];

const THEMES = [
  ['auto', 'Automático'],
  ['light', 'Claro'],
  ['dark', 'Oscuro'],
];

const Step = ({ n, title, hint, icon: Icon, children }) => (
  <div className="relative pl-12">
    <span className="absolute left-0 top-0 w-8 h-8 rounded-full bg-fuchsia-600 text-white text-sm font-extrabold flex items-center justify-center">{n}</span>
    <div className="pb-6">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={16} className="text-fuchsia-600" />}
        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>
      {hint && <p className="text-xs text-slate-500 mb-3">{hint}</p>}
      {children}
    </div>
  </div>
);

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

  const pal = PALETTE_OPTIONS.find((p) => p.id === appearance.palette);
  const from = pal?.from || appearance.color;
  const to = pal?.to || appearance.color;
  const dark = appearance.theme === 'dark';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ApiLoadingModal status={apiStatus} message="Guardando..." successMessage="¡Guardado con éxito!" errorMessage="Ocurrió un error" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white flex items-center justify-center"><Palette size={22} /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Apariencia de tu vitrina</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Plantilla, tema y color. Los cambios se aplican a tu tienda pública.</p>
        </div>
        <Link to="/market" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-zinc-700">
          <ArrowLeft size={16} /> Mi tienda
        </Link>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-4 py-2.5">{notice}</div>}

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* Cascada de pasos */}
        <form onSubmit={handleSaveAppearance} className="relative">
          <span className="absolute left-4 top-4 bottom-16 w-px bg-slate-200 dark:bg-zinc-800" aria-hidden="true" />

          <Step n={1} title="Plantilla" hint="Cómo se organiza tu portada." icon={LayoutTemplate}>
            <div className="grid sm:grid-cols-3 gap-2">
              {TEMPLATES.map((t) => {
                const active = appearance.template === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setAppearance({ ...appearance, template: t.id })}
                    className={`text-left rounded-xl border p-3 transition-colors ${active ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{t.name}</div>
                    <div className="text-[11px] text-slate-500">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={2} title="Tema" hint="Claro, oscuro o según el dispositivo." icon={Moon}>
            <div className="flex flex-wrap gap-2">
              {THEMES.map(([id, name]) => {
                const active = appearance.theme === id;
                return (
                  <button key={id} type="button" onClick={() => setAppearance({ ...appearance, theme: id })}
                    className={`px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors ${active ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30 text-fuchsia-700 dark:text-fuchsia-300' : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
                    {name}
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={3} title="Color" hint="Paleta de tu marca." icon={Droplet}>
            <div className="flex flex-wrap items-center gap-2.5">
              {PALETTE_OPTIONS.map((p) => (
                <button key={p.id} type="button" title={p.name} aria-label={p.name}
                  onClick={() => setAppearance({ ...appearance, palette: p.id })}
                  className="w-9 h-9 rounded-full transition-transform hover:scale-105"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                    boxShadow: appearance.palette === p.id ? '0 0 0 2px #0f172a' : '0 0 0 1px #cbd5e1',
                  }} />
              ))}
              <button type="button" onClick={() => setAppearance({ ...appearance, palette: 'custom' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${appearance.palette === 'custom' ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30 text-fuchsia-700 dark:text-fuchsia-300' : 'border-slate-200 dark:border-zinc-700 text-slate-500'}`}>
                Personalizado
              </button>
              {appearance.palette === 'custom' && (
                <input type="color" aria-label="Color personalizado" value={appearance.color}
                  onChange={(e) => setAppearance({ ...appearance, color: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-slate-200 dark:border-zinc-700 cursor-pointer bg-transparent" />
              )}
            </div>
          </Step>

          <Step n={4} title="Banner" hint="Solo para la plantilla Boutique (opcional)." icon={ImageIcon}>
            <input value={appearance.banner} onChange={(e) => setAppearance({ ...appearance, banner: e.target.value })}
              placeholder="https://…/banner.jpg"
              className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400" />
          </Step>

          <div className="relative pl-12">
            <span className="absolute left-0 top-0 w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center"><Check size={16} /></span>
            <button type="submit" disabled={savingAppearance}
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold px-5 py-2.5 text-sm hover:opacity-90 disabled:opacity-60">
              {savingAppearance ? 'Guardando…' : 'Guardar apariencia'}
            </button>
          </div>
        </form>

        {/* Vista previa */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-semibold text-slate-500 mb-2">Vista previa</p>
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="h-24 flex items-end p-4 text-white" style={{ backgroundImage: `linear-gradient(120deg, ${from}, ${to})` }}>
              <div>
                <p className="text-[10px] uppercase tracking-wide opacity-80">Tu tienda</p>
                <p className="font-extrabold">{tienda.name || 'Mi tienda'}</p>
              </div>
            </div>
            <div className={`p-4 space-y-3 ${dark ? 'bg-zinc-900 text-white' : 'bg-white text-slate-800'}`}>
              {appearance.banner && appearance.template === 'boutique' && (
                <img src={appearance.banner} alt="banner" className="w-full h-20 object-cover rounded-lg" onError={(e) => { e.target.style.display = 'none'; }} />
              )}
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`rounded-lg border ${dark ? 'border-zinc-700 bg-zinc-800' : 'border-slate-200 bg-slate-50'} p-2`}>
                    <div className={`h-12 rounded ${dark ? 'bg-zinc-700' : 'bg-slate-200'}`} />
                    <div className="h-2 w-3/4 rounded bg-slate-300 dark:bg-zinc-600 mt-2" />
                    <div className="h-2 w-1/2 rounded mt-1" style={{ background: to }} />
                  </div>
                ))}
              </div>
              <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: to }}>
                {TEMPLATES.find((t) => t.id === appearance.template)?.name || 'Plantilla'}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Vitrina;
