// ==========================================
// Apariencia de la vitrina: paletas y tema claro/oscuro/auto.
// ==========================================

export const PALETTES = {
  fucsia: { name: 'Fucsia Glopsy', from: '#c026d3', to: '#db2777' },
  azul: { name: 'Azul', from: '#2563eb', to: '#0891b2' },
  esmeralda: { name: 'Esmeralda', from: '#059669', to: '#10b981' },
  naranja: { name: 'Naranja', from: '#ea580c', to: '#f59e0b' },
  grafito: { name: 'Grafito', from: '#334155', to: '#0f172a' },
};

export const PALETTE_OPTIONS = Object.entries(PALETTES).map(([id, p]) => ({ id, ...p }));

const hexToRgba = (hex, alpha = 1) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return `rgba(192,38,211,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const resolvePalette = (palette, customColor) => {
  if (palette === 'custom' && /^#[0-9a-fA-F]{6}$/.test(customColor || '')) {
    return { name: 'Personalizado', from: customColor, to: customColor, ring: hexToRgba(customColor, 0.35) };
  }
  const p = PALETTES[palette] || PALETTES.fucsia;
  return { ...p, ring: hexToRgba(p.from, 0.35) };
};

// Aplica las variables de color y el modo oscuro al documento.
// Devuelve una función de limpieza para cuando se sale de la vitrina.
export const applyStorefrontAppearance = ({ theme = 'auto', palette = 'fucsia', color = null } = {}) => {
  const root = document.documentElement;
  const p = resolvePalette(palette, color);
  const prev = {
    from: root.style.getPropertyValue('--sf-from'),
    to: root.style.getPropertyValue('--sf-to'),
    ring: root.style.getPropertyValue('--sf-ring'),
    dark: root.classList.contains('sf-dark'),
    light: root.classList.contains('sf-light'),
  };

  root.style.setProperty('--sf-from', p.from);
  root.style.setProperty('--sf-to', p.to);
  root.style.setProperty('--sf-ring', p.ring);

  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  const applyDark = () => {
    const dark = theme === 'dark' || (theme === 'auto' && !!mq?.matches);
    root.classList.toggle('sf-dark', dark);
    root.classList.toggle('sf-light', !dark);
  };
  applyDark();
  mq?.addEventListener?.('change', applyDark);

  return () => {
    mq?.removeEventListener?.('change', applyDark);
    if (prev.from) root.style.setProperty('--sf-from', prev.from); else root.style.removeProperty('--sf-from');
    if (prev.to) root.style.setProperty('--sf-to', prev.to); else root.style.removeProperty('--sf-to');
    if (prev.ring) root.style.setProperty('--sf-ring', prev.ring); else root.style.removeProperty('--sf-ring');
    root.classList.toggle('sf-dark', prev.dark);
    root.classList.toggle('sf-light', prev.light);
  };
};
