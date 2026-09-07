export const AUTH_COOKIE = 'glopsy_auth';

const secure = process.env.COOKIE_SECURE === 'true';

// En modo multi-tienda cada tienda vive en <slug>.glopsy.shop. Para que la sesión del
// comprador sea la misma en todos los subdominios se fija COOKIE_DOMAIN=.glopsy.shop.
const domain = process.env.COOKIE_DOMAIN
  ? String(process.env.COOKIE_DOMAIN).trim().replace(/^\./, '')
  : null;

const baseOptions = () => ({
  httpOnly: true,
  secure,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  ...(domain ? { domain: `.${domain}` } : {}),
});

export const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE, token, baseOptions());
};

export const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/', ...(domain ? { domain: `.${domain}` } : {}) });
};
