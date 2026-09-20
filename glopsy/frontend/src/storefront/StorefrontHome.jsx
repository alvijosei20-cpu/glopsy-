import { useEffect } from 'react';
import { useStorefront } from './StorefrontContext';
import { useUserCity } from '../utils/location';
import { applyStorefrontAppearance } from './appearance';
import { DashboardTemplate, CatalogTemplate, BoutiqueTemplate } from './templates';
import './storefront.css';

export default function StorefrontHome() {
  const { slug, store } = useStorefront();
  const ciudad = useUserCity();

  useEffect(() => {
    if (!store) return;
    return applyStorefrontAppearance({
      theme: store.storefrontTheme,
      palette: store.storefrontPalette,
      color: store.storefrontColor,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.storefrontTheme, store?.storefrontPalette, store?.storefrontColor, store]);

  if (!slug) return null;

  const props = { store, slug, ciudad };
  const template = store?.storefrontTemplate || 'dashboard';
  if (template === 'catalog') return <CatalogTemplate {...props} />;
  if (template === 'boutique') return <BoutiqueTemplate {...props} />;
  return <DashboardTemplate {...props} />;
}
