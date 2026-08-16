import { Vault, VaultItem, ItemType, Stats } from '../types';
import * as Crypto from './crypto';
import { t } from '../i18n';

export type IoniconName =
  | 'key' | 'logo-bitcoin' | 'card' | 'document-text' | 'people' | 'business' | 'mail'
  | 'briefcase' | 'cart' | 'cube' | 'grid' | 'lock-closed' | 'shield-checkmark';

export interface TypeDef {
  label: string;
  icon: IoniconName;
}

export interface CategoryDef {
  id: string;
  label: string;
  icon: IoniconName;
}

export const TYPES: Record<ItemType, TypeDef> = {
  password: { label: t('type.password'), icon: 'key' },
  seed: { label: t('type.seed'), icon: 'logo-bitcoin' },
  card: { label: t('type.card'), icon: 'card' },
  note: { label: t('type.note'), icon: 'document-text' },
};

export const CATEGORIES: CategoryDef[] = [
  { id: 'cripto', label: t('cat.cripto'), icon: 'logo-bitcoin' },
  { id: 'banca', label: t('cat.banca'), icon: 'business' },
  { id: 'social', label: t('cat.social'), icon: 'people' },
  { id: 'email', label: t('cat.email'), icon: 'mail' },
  { id: 'trabajo', label: t('cat.trabajo'), icon: 'briefcase' },
  { id: 'compras', label: t('cat.compras'), icon: 'cart' },
  { id: 'otro', label: t('cat.otro'), icon: 'cube' },
];

export const VAULT = {
  create(): Vault {
    return { version: 1, items: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  },

  cat(id: string): CategoryDef {
    return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  },

  addItem(vault: Vault, data: Partial<VaultItem>): VaultItem {
    const now = new Date().toISOString();
    const item: VaultItem = {
      id: Crypto.uid(),
      type: (data.type as ItemType) || 'password',
      category: data.category || 'otro',
      name: (data.name || '').trim() || t('vault.unnamed'),
      username: data.username || '',
      password: data.password || '',
      url: data.url || '',
      seed: data.seed || '',
      cardNumber: data.cardNumber || '',
      cvv: data.cvv || '',
      expiry: data.expiry || '',
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    };
    vault.items.push(item);
    vault.updatedAt = now;
    return item;
  },

  updateItem(vault: Vault, id: string, data: Partial<VaultItem>): VaultItem | null {
    const item = vault.items.find((i) => i.id === id);
    if (!item) return null;
    const fields: (keyof VaultItem)[] = ['type', 'category', 'name', 'username', 'password', 'url', 'seed', 'cardNumber', 'cvv', 'expiry', 'notes'];
    fields.forEach((f) => {
      if (data[f] !== undefined) (item as any)[f] = (data as any)[f];
    });
    if (data.name !== undefined) item.name = String(data.name).trim() || t('vault.unnamed');
    item.updatedAt = new Date().toISOString();
    vault.updatedAt = item.updatedAt;
    return item;
  },

  deleteItem(vault: Vault, id: string): boolean {
    const before = vault.items.length;
    vault.items = vault.items.filter((i) => i.id !== id);
    if (vault.items.length !== before) vault.updatedAt = new Date().toISOString();
    return vault.items.length !== before;
  },

  search(vault: Vault, query: string, category: string): VaultItem[] {
    const q = (query || '').trim().toLowerCase();
    return vault.items
      .filter((i) => {
        if (category && category !== 'todos' && i.category !== category) return false;
        if (!q) return true;
        const hay = [i.name, i.username, i.url, i.notes, i.password, i.seed, i.category].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  stats(vault: Vault): Stats {
    const items = vault.items;
    return {
      total: items.length,
      password: items.filter((i) => i.type === 'password').length,
      seed: items.filter((i) => i.type === 'seed').length,
      card: items.filter((i) => i.type === 'card').length,
      note: items.filter((i) => i.type === 'note').length,
    };
  },

  recent(vault: Vault, n = 5): VaultItem[] {
    return [...vault.items]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, n);
  },
};

export function maskCard(n: string): string {
  const d = String(n).replace(/\D/g, '');
  return d ? t('vault.cardMask', { last: d.slice(-4) }) : t('vault.cardEmpty');
}

export function itemMeta(item: VaultItem): string {
  switch (item.type) {
    case 'seed': return t('vault.seedMeta', { cat: VAULT.cat(item.category).label });
    case 'card': return maskCard(item.cardNumber);
    case 'note': return t('vault.noteMeta');
    default: return item.username || item.url || (item.password ? '••••••••' : VAULT.cat(item.category).label);
  }
}

export function sanitizeValue(value: string, kind: string): string {
  let s = String(value ?? '');
  switch (kind) {
    case 'digits':
      s = s.replace(/\D/g, '');
      break;
    case 'card':
      s = s.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
      break;
    case 'expiry':
      s = s.replace(/[^\d]/g, '').slice(0, 4);
      if (s.length > 2) s = s.slice(0, 2) + '/' + s.slice(2);
      break;
    case 'url':
      s = s.replace(/[^\w\-._~:/?#\[\]@!$&'()*+,;=%]/g, '');
      break;
    case 'username':
      s = s.replace(/[^a-zA-Z0-9._@+-]/g, '').slice(0, 128);
      break;
    case 'name':
      s = s.replace(/[<>]/g, '').slice(0, 60);
      break;
    case 'holder':
      s = s.replace(/[^a-zA-ZÀ-ÿ0-9 .,'’-]/g, '').slice(0, 60);
      break;
    case 'text':
    default:
      s = s.replace(/[<>]/g, '').slice(0, 2000);
  }
  return s;
}
