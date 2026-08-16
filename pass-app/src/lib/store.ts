import { File, Directory, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { shareJsonFile } from './export';
import { Database, User } from '../types';
import { t } from '../i18n';

const DB_NAME = 'pass-database.json';

let _db: Database = { app: 'Pass', version: 1, users: [] };

function baseDir(): Directory {
  const dir = new Directory(Paths.document, 'pass');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
}

function dbFile(): File {
  return new File(baseDir(), DB_NAME);
}

function cloneDB(): Database {
  return { app: 'Pass', version: 1, users: _db.users.map((u) => ({ ...u })) };
}

export const Store = {
  async load(): Promise<Database> {
    _db = { app: 'Pass', version: 1, users: [] };
    const f = dbFile();
    if (!f.exists) return _db;
    try {
      const text = await f.text();
      const db = text ? JSON.parse(text) : null;
      if (db && db.app === 'Pass' && Array.isArray(db.users)) _db = db;
    } catch (e) {
      // archivo aún no existe o corrupto: base vacía
    }
    return _db;
  },

  async save(): Promise<void> {
    const f = dbFile();
    if (!f.exists) f.create();
    f.write(JSON.stringify(_db, null, 2));
  },

  listUsers() {
    return _db.users
      .map((u) => ({ username: u.username, createdAt: u.createdAt || '' }))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  },

  getUser(username: string): User | null {
    return _db.users.find((u) => u.username === username) || null;
  },

  async saveUser(user: User): Promise<void> {
    const i = _db.users.findIndex((u) => u.username === user.username);
    if (i >= 0) _db.users[i] = user;
    else _db.users.push(user);
    return this.save();
  },

  async deleteUser(username: string): Promise<void> {
    _db.users = _db.users.filter((u) => u.username !== username);
    return this.save();
  },

  async wipe(): Promise<void> {
    _db.users = [];
    return this.save();
  },

  buildDB(): Database {
    return {
      app: 'Pass',
      version: 1,
      users: _db.users.map((u) => ({ ...u })),
    };
  },

  async exportDatabase(): Promise<boolean> {
    return shareJsonFile(DB_NAME, JSON.stringify(this.buildDB(), null, 2), 'Guardar base de datos (pass-database.json)');
  },

  async importDatabase(): Promise<{ count: number; db: Database }> {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.length) {
      throw new Error('cancelado');
    }
    const asset = res.assets[0];
    const file = new File(asset.uri);
    const text = await file.text();
    const db: Database = JSON.parse(text);
    if (!db || db.app !== 'Pass' || !Array.isArray(db.users)) {
      throw new Error(t('store.notDB'));
    }
    const valid = db.users.filter((u) => u && u.username && u.salt && u.vault && u.vault.iv && u.vault.data);
    if (!valid.length) throw new Error(t('store.notValid'));
    valid.forEach((u) => {
      const i = _db.users.findIndex((x) => x.username === u.username);
      if (i >= 0) _db.users[i] = u;
      else _db.users.push(u);
    });
    await this.save();
    return { count: valid.length, db: cloneDB() };
  },

  async importData(db: Database): Promise<number> {
    if (!db || db.app !== 'Pass' || !Array.isArray(db.users)) {
      throw new Error(t('store.notDB'));
    }
    const valid = db.users.filter((u) => u && u.username && u.salt && u.vault && u.vault.iv && u.vault.data);
    if (!valid.length) throw new Error(t('store.notValid'));
    valid.forEach((u) => {
      const i = _db.users.findIndex((x) => x.username === u.username);
      if (i >= 0) _db.users[i] = u;
      else _db.users.push(u);
    });
    await this.save();
    return valid.length;
  },
};
