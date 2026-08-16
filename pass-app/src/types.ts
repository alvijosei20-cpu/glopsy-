export type ItemType = 'password' | 'seed' | 'card' | 'note';

export interface VaultItem {
  id: string;
  type: ItemType;
  category: string;
  name: string;
  username: string;
  password: string;
  url: string;
  seed: string;
  cardNumber: string;
  cvv: string;
  expiry: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vault {
  version: number;
  items: VaultItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Argon2Params {
  m: number;
  t: number;
  p: number;
}

export interface User {
  username: string;
  salt: string;
  vault: { iv: string; data: string };
  wrappedKey?: { iv: string; data: string };
  kdf?: 'argon2id' | 'pbkdf2';
  kdfIterations?: number;
  kdfParams?: Argon2Params;
  pinLen: number;
  deviceId?: string;
  licenseCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  app: 'Pass';
  version: number;
  users: User[];
}

export interface Stats {
  total: number;
  password: number;
  seed: number;
  card: number;
  note: number;
}

export type ThemeMode = 'light' | 'dark';
