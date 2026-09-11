import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { initGA } from '../utils/analytics';
import { getStoreSlug } from '../utils/storeHost';

const StorefrontContext = createContext({ slug: null, store: null, ready: false });

export function StorefrontProvider({ children }) {
  const slug = useMemo(() => getStoreSlug(), []);
  const [store, setStore] = useState(null);
  const [ready, setReady] = useState(!slug);

  useEffect(() => {
    if (!slug) {
      // Sin subdominio: se carga la tienda principal para conocer su país
      // (moneda/locale) y formatear precios correctamente en el marketplace.
      let alive = true;
      api
        .get('/storefront/main')
        .then(({ data }) => {
          if (alive) setStore(data?.store || null);
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setReady(true);
        });
      return () => {
        alive = false;
      };
    }
    let alive = true;
    setReady(false);
    api
      .get(`/storefront/${slug}`)
      .then(({ data }) => {
        if (!alive) return;
        const st = data?.store || null;
        setStore(st);
        setReady(true);
        // Cada tienda reporta a SU propiedad de Google Analytics.
        if (st?.gaId) initGA(st.gaId);
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
