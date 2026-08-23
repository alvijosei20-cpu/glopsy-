export function openDeepLink(scheme, fallback, navigate) {
  if (!scheme) return;
  const fb = fallback || '/';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const openFallback = () => {
    if (!fb) return;
    if (fb.startsWith('/')) {
      if (navigate) navigate(fb);
      else window.location.href = fb;
    } else if (fb.startsWith('http')) {
      window.location.href = fb;
    }
  };

  if (isIOS) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = scheme;
    document.body.appendChild(iframe);
    setTimeout(() => {
      iframe.remove();
      if (!document.hidden) openFallback();
    }, 1500);
    return;
  }

  window.location.href = scheme;
  setTimeout(() => {
    if (!document.hidden) openFallback();
  }, 1500);
}
