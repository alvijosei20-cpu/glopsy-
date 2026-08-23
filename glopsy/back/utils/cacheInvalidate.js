export const invalidateEdgeCache = async () => {
  const endpoint = process.env.FRONTEND_URL;
  const secret = process.env.CACHE_INVALIDATE_SECRET;
  if (!endpoint || !secret) return;

  await fetch(`${endpoint}/api/_cache/invalidate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-invalidate-secret': secret,
    },
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
};
