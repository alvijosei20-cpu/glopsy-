// Registro automático del subdominio de cada tienda como "Workers Custom Domain".
// Con esto Cloudflare aprovisiona el DNS y el certificado del hostname automáticamente
// (no hace falta tocar DNS manualmente por cada tienda).
// Solo actúa si el backend tiene configuradas las variables de Cloudflare; si no, es no-op.

const CF_API = 'https://api.cloudflare.com/client/v4';

const getConfig = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN || '';
  const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const service = process.env.WORKER_SERVICE || 'glopsy';
  const suffix =
    (process.env.STORE_DOMAIN_SUFFIX || '').trim().toLowerCase() ||
    (() => {
      try {
        const host = new URL(process.env.FRONTEND_URL || '').hostname.toLowerCase();
        return host.replace(/^(app|www)\./, '');
      } catch {
        return '';
      }
    })();
  return { token, account, service, suffix };
};

const enabled = () => {
  const c = getConfig();
  return Boolean(c.token && c.account && c.suffix && c.suffix !== 'localhost' && c.suffix.includes('.'));
};

export const storeDomainHost = (slug) => {
  const c = getConfig();
  const clean = String(slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return clean && c.suffix ? `${clean}.${c.suffix}` : null;
};

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const registerStoreCustomDomain = async (slug) => {
  if (!enabled()) return { ok: false, reason: 'no_config' };
  const c = getConfig();
  const hostname = storeDomainHost(slug);
  if (!hostname) return { ok: false, reason: 'no_hostname' };

  try {
    const res = await fetch(`${CF_API}/accounts/${c.account}/workers/domains`, {
      method: 'POST',
      headers: headers(c.token),
      body: JSON.stringify({ hostname, service: c.service, environment: 'production' }),
    });
    const data = await res.json();
    // "already exists" y "duplicate" se tratan como éxito (idempotente).
    const ok = res.ok || /already|exist|duplicate/i.test(JSON.stringify(data?.errors || data || ''));
    if (!ok) {
      console.warn('[cloudflare] no se pudo registrar dominio de tienda:', hostname, JSON.stringify(data).slice(0, 300));
    }
    return { ok, hostname };
  } catch (error) {
    console.warn('[cloudflare] error registrando dominio de tienda:', error.message);
    return { ok: false, error: error.message };
  }
};

const findCustomDomainId = async (hostname) => {
  const c = getConfig();
  const res = await fetch(`${CF_API}/accounts/${c.account}/workers/domains`, {
    headers: headers(c.token),
  });
  const data = await res.json();
  const list = Array.isArray(data?.result) ? data.result : [];
  const found = list.find((d) => String(d.hostname).toLowerCase() === String(hostname).toLowerCase());
  return found?.id || null;
};

export const removeStoreCustomDomain = async (slug) => {
  if (!enabled()) return { ok: false, reason: 'no_config' };
  const c = getConfig();
  const hostname = storeDomainHost(slug);
  if (!hostname) return { ok: false, reason: 'no_hostname' };
  try {
    const id = await findCustomDomainId(hostname);
    if (!id) return { ok: true, hostname, reason: 'not_found' };
    const res = await fetch(`${CF_API}/accounts/${c.account}/workers/domains/${id}`, {
      method: 'DELETE',
      headers: headers(c.token),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[cloudflare] no se pudo quitar dominio de tienda:', hostname, JSON.stringify(data).slice(0, 300));
      return { ok: false, hostname };
    }
    return { ok: true, hostname };
  } catch (error) {
    console.warn('[cloudflare] error quitando dominio de tienda:', error.message);
    return { ok: false, error: error.message };
  }
};
