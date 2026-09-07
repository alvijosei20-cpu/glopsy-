import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { getStoreSlug } from '../utils/storeHost';

const StorefrontContext = createContext({ slug: null, store: null, ready: false });

export function StorefrontProvider({ children }) {
  const slug = useMemo(() => getStoreSlug(), []);
  const [store, setStore] = useState(null);
  const [ready, setReady] = useState(!slug);

  useEffect(() => {
    if (!slug) {
      setReady(true);
      return;
    }
    let alive = true;
    setReady(false);
    api
      .get(`/storefront/${slug}`)
      .then(({ data }) => {
        if (!alive) return;
        setStore(data?.store || null);
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setStore(null);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <StorefrontContext.Provider value={{ slug, store, ready }}>
      {children}
    </StorefrontContext.Provider>
  );
}

export const useStorefront = () => useContext(StorefrontContext);
