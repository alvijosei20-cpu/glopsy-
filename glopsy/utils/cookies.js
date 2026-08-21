export const AUTH_COOKIE = 'glopsy_auth';

const secure = process.env.COOKIE_SECURE === 'true';

export const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
};

export const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
};
