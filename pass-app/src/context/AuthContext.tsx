import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Vault, User } from '../types';
import * as Crypto from '../lib/crypto';
import { Store } from '../lib/store';
import { rememberLastUser, forgetLastUser, clearLock, getBiometricEnabled, setBiometricEnabled } from '../lib/persist';
import { saveSession, loadSession, clearSession } from '../lib/session';
import { useToast } from './ToastContext';
import { t } from '../i18n';
import { getDeviceId, deviceBindingAvailable } from '../lib/deviceBinding';
import { verifyLicenseCode } from '../lib/license';
import { syncClock } from '../lib/clock';

interface AuthState {
  user: string | null;
  salt: string | null;
  key: Uint8Array | null;
  vault: Vault | null;
}

interface AuthContextValue {
  state: AuthState;
  booted: boolean;
  hasUsers: boolean;
  saving: boolean;
  biometricEnabled: boolean;
  biometricReady: boolean;
  refreshUsers: () => void;
  unlock: (user: string, salt: string, key: Uint8Array, vault: Vault) => Promise<void>;
  login: (username: string, pin: string, onProgress?: (pct: number) => void) => Promise<boolean>;
  logout: () => void;
  persistVault: (opts?: { toast?: string }) => Promise<void>;
  verifyPin: (pin: string, onProgress?: (pct: number) => void) => Promise<boolean>;
  changePin: (newPin: string) => Promise<void>;
  wipeAccount: () => Promise<void>;
  importDatabase: () => Promise<void>;
  biometricUnlock: () => Promise<BioResult>;
  setBiometricEnabledPref: (v: boolean) => Promise<boolean>;
  checkBioStatus: () => Promise<BioStatus>;
  checkDeviceBinding: (user: User) => Promise<'ok' | 'unavailable' | 'mismatch' | 'invalid-license'>;
}

export type BioResult = 'ok' | 'no-session' | 'canceled' | 'failed' | 'unavailable' | 'bad-vault';

export type BioStatus = 'ok' | 'no-hardware' | 'not-enrolled';

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [state, setState] = useState<AuthState>({ user: null, salt: null, key: null, vault: null });
  const [booted, setBooted] = useState(false);
  const [hasUsers, setHasUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);

  const checkBioAvailable = useCallback(async (): Promise<boolean> => {
    try {
      const hw = await LocalAuthentication.hasHardwareAsync();
      if (!hw) return false;
      return LocalAuthentication.isEnrolledAsync();
    } catch {
      return false;
    }
  }, []);

  const checkDeviceBinding = useCallback(
    async (user: User): Promise<'ok' | 'unavailable' | 'mismatch' | 'invalid-license'> => {
      // Cuentas creadas antes de esta versión no están vinculadas.
      if (!user.deviceId || !user.licenseCode) return 'ok';
      if (!deviceBindingAvailable) return 'unavailable';
      const id = await getDeviceId();
      if (!id) return 'unavailable';
      if (id !== user.deviceId) return 'mismatch';
      if (!verifyLicenseCode(id, user.licenseCode)) return 'invalid-license';
      return 'ok';
    },
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      await Store.load();
      if (!active) return;
      setHasUsers(Store.listUsers().length > 0);
      // Sincroniza la hora con el servidor para los bloqueos por intentos.
      syncClock();
      const bioEnabled = await getBiometricEnabled();
      setBiometricEnabledState(bioEnabled);
      const s = await loadSession();
      if (s) {
        const user = Store.getUser(s.user);
        if (!user) {
          await clearSession();
        } else {
          const key = Crypto.importKey(s.keyB64);
          const vault = Crypto.decrypt(user.vault, key) as Vault | null;
          if (!vault) {
            await clearSession();
          } else if (bioEnabled) {
            // Huella activada: no auto-desbloquear, la pantalla de login
            // mostrará el botón de huella.
            const avail = await checkBioAvailable();
            setBiometricReady(avail);
          } else {
            setState({ user: user.username, salt: user.salt, key, vault });
            await rememberLastUser(user.username);
          }
        }
      }
      setBooted(true);
    })();
    return () => {
      active = false;
    };
  }, [checkBioAvailable]);

  const refreshUsers = useCallback(() => {
    setHasUsers(Store.listUsers().length > 0);
  }, []);

  const unlock = useCallback(async (user: string, salt: string, key: Uint8Array, vault: Vault) => {
    setState({ user, salt, key, vault });
    await rememberLastUser(user);
    await saveSession(user, Crypto.exportKey(key));
  }, []);

  const logout = useCallback(() => {
    // Bloquea la bóveda: vuelve al login pero CONSERVA la sesión guardada
    // y la preferencia de huella, para que la huella siga funcionando.
    setState({ user: null, salt: null, key: null, vault: null });
  }, []);

  const persistVault = useCallback(
    async (opts?: { toast?: string }) => {
      if (!state.user || !state.key || !state.vault) return;
      setSaving(true);
      const enc = Crypto.encrypt(state.vault, state.key);
      const user = Store.getUser(state.user);
      if (!user) {
        setSaving(false);
        return;
      }
      user.vault = enc;
      user.updatedAt = new Date().toISOString();
      await Store.saveUser(user);
      setState((s) =>
        s.vault ? { ...s, vault: { ...s.vault, items: [...s.vault.items], updatedAt: s.vault.updatedAt } } : s
      );
      setSaving(false);
      if (opts?.toast) showToast(opts.toast, 'success');
    },
    [state, showToast]
  );

  const login = useCallback(
    async (username: string, pin: string, onProgress?: (pct: number) => void): Promise<boolean> => {
      const user = Store.getUser(username);
      if (!user) return false;
      const pinKey = await Crypto.derivePinKey(
        pin,
        user.salt,
        { kdf: user.kdf, iterations: user.kdfIterations, params: user.kdfParams },
        onProgress
      );
      let masterKey: Uint8Array | null;
      if (user.wrappedKey) {
        masterKey = Crypto.unwrapKey(user.wrappedKey, pinKey);
      } else {
        // Cuenta legada (sin wrap): la bóveda está cifrada con la clave del PIN.
        masterKey = pinKey;
      }
      if (!masterKey) return false;
      const vault = Crypto.decrypt(user.vault, masterKey) as Vault | null;
      if (!vault) return false;
      // Device Binding: la cuenta debe pertenecer a este dispositivo.
      const binding = await checkDeviceBinding(user);
      if (binding === 'mismatch') throw new Error(t('license.deviceMismatch'));
      if (binding === 'invalid-license') throw new Error(t('license.err.invalid'));
      if (binding === 'unavailable') throw new Error(t('license.unavailable'));
      // Migración: wrap de master key + Argon2id (si el entorno lo permite).
      if (!user.wrappedKey || user.kdf !== 'argon2id') {
        const canA2 = await Crypto.canUseArgon2();
        const target = canA2 ? 'argon2id' : 'pbkdf2';
        const newsalt = Crypto.randomSalt();
        const newPinKey = await Crypto.derivePinKey(
          pin,
          newsalt,
          target === 'argon2id' ? { kdf: 'argon2id' } : { kdf: 'pbkdf2', iterations: Crypto.DEFAULT_ITERATIONS },
          onProgress
        );
        const newMasterKey = !user.wrappedKey ? Crypto.randomBytes(32) : masterKey;
        user.salt = newsalt;
        user.kdf = target;
        user.kdfIterations = target === 'argon2id' ? undefined : Crypto.DEFAULT_ITERATIONS;
        user.kdfParams = target === 'argon2id' ? Crypto.ARGON2_PARAMS : undefined;
        if (!user.wrappedKey) user.vault = Crypto.encrypt(vault, newMasterKey);
        user.wrappedKey = Crypto.wrapKey(newMasterKey, newPinKey);
        user.updatedAt = new Date().toISOString();
        await Store.saveUser(user);
        masterKey = newMasterKey;
      }
      setState({ user: user.username, salt: user.salt, key: masterKey, vault });
      await clearLock(user.username);
      await rememberLastUser(user.username);
      await saveSession(user.username, Crypto.exportKey(masterKey));
      return true;
    },
    []
  );

  const verifyPin = useCallback(
    async (pin: string, onProgress?: (pct: number) => void): Promise<boolean> => {
      if (!state.user) return false;
      return login(state.user, pin, onProgress);
    },
    [state.user, login]
  );

  const changePin = useCallback(
    async (newPin: string) => {
      if (!state.user || !state.vault) return;
      const canA2 = await Crypto.canUseArgon2();
      const target = canA2 ? 'argon2id' : 'pbkdf2';
      const salt = Crypto.randomSalt();
      const pinKey = await Crypto.derivePinKey(
        newPin,
        salt,
        target === 'argon2id' ? { kdf: 'argon2id' } : { kdf: 'pbkdf2', iterations: Crypto.DEFAULT_ITERATIONS }
      );
      const user = Store.getUser(state.user);
      if (!user) throw new Error(t('auth.notFound'));
      let masterKey = state.key;
      let enc = user.vault;
      if (!masterKey || !user.wrappedKey) {
        // Cuenta legada sin migrar: crear master key y recifrar la bóveda.
        masterKey = Crypto.randomBytes(32);
        enc = Crypto.encrypt(state.vault, masterKey);
      }
      user.salt = salt;
      user.vault = enc;
      user.wrappedKey = Crypto.wrapKey(masterKey, pinKey);
      user.kdf = target;
      user.kdfIterations = target === 'argon2id' ? undefined : Crypto.DEFAULT_ITERATIONS;
      user.kdfParams = target === 'argon2id' ? Crypto.ARGON2_PARAMS : undefined;
      user.pinLen = 6;
      user.updatedAt = new Date().toISOString();
      await Store.saveUser(user);
      setState({ user: user.username, salt, key: masterKey, vault: state.vault });
      await saveSession(user.username, Crypto.exportKey(masterKey));
    },
    [state]
  );

  const wipeAccount = useCallback(async () => {
    if (!state.user) return;
    await Store.deleteUser(state.user);
    await forgetLastUser();
    await clearSession();
    setState({ user: null, salt: null, key: null, vault: null });
    refreshUsers();
  }, [state.user, refreshUsers]);

  const importDatabase = useCallback(async () => {
    try {
      await Store.importDatabase();
      await clearSession();
      setState({ user: null, salt: null, key: null, vault: null });
      refreshUsers();
      showToast(t('auth.import.ok'), 'success');
    } catch (e: any) {
      if (e?.message === 'cancelado') return;
      showToast(e?.message || t('auth.import.err'), 'error');
    }
  }, [refreshUsers, showToast]);

  const biometricUnlock = useCallback(async (): Promise<BioResult> => {
    const s = await loadSession();
    if (!s) return 'no-session';
    let auth;
    try {
      auth = await LocalAuthentication.authenticateAsync({
        promptMessage: t('auth.bio.prompt'),
        cancelLabel: t('auth.bio.cancel'),
        disableDeviceFallback: true,
      });
    } catch {
      return 'unavailable';
    }
    if (!auth.success) {
      if (auth.error === 'user_cancel' || auth.error === 'system_cancel' || auth.error === 'app_cancel') {
        return 'canceled';
      }
      if (auth.error === 'not_available' || auth.error === 'not_enrolled' || auth.error === 'lockout') {
        return 'unavailable';
      }
      return 'failed';
    }
    const user = Store.getUser(s.user);
    if (!user) {
      await clearSession();
      return 'bad-vault';
    }
    const key = Crypto.importKey(s.keyB64);
    const vault = Crypto.decrypt(user.vault, key) as Vault | null;
    if (!vault) {
      await clearSession();
      return 'bad-vault';
    }
    const binding = await checkDeviceBinding(user);
    if (binding !== 'ok') {
      await clearSession();
      return 'bad-vault';
    }
    setState({ user: user.username, salt: user.salt, key, vault });
    await rememberLastUser(user.username);
    return 'ok';
  }, []);

  const setBiometricEnabledPref = useCallback(
    async (v: boolean): Promise<boolean> => {
      if (v) {
        // Solo exigimos sensor físico; el estado de huella registrada se
        // comprueba al desbloquear (puede dar falsos negativos según el OEM).
        let hw = false;
        try {
          hw = await LocalAuthentication.hasHardwareAsync();
        } catch {}
        if (!hw) return false;
        // Asegurar que exista una sesión guardada con la clave actual.
        if (state.user && state.key) {
          await saveSession(state.user, Crypto.exportKey(state.key));
        }
        await setBiometricEnabled(true);
        setBiometricEnabledState(true);
        setBiometricReady(true);
        return true;
      }
      await setBiometricEnabled(false);
      setBiometricEnabledState(false);
      setBiometricReady(false);
      return true;
    },
    [state.user, state.key]
  );

  const checkBioStatus = useCallback(async (): Promise<BioStatus> => {
    try {
      const hw = await LocalAuthentication.hasHardwareAsync();
      if (!hw) return 'no-hardware';
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled ? 'ok' : 'not-enrolled';
    } catch {
      return 'no-hardware';
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      booted,
      hasUsers,
      saving,
      biometricEnabled,
      biometricReady,
      refreshUsers,
      unlock,
      login,
      logout,
      persistVault,
      verifyPin,
      changePin,
      wipeAccount,
      importDatabase,
      biometricUnlock,
      setBiometricEnabledPref,
      checkBioStatus,
      checkDeviceBinding,
    }),
    [state, booted, hasUsers, saving, biometricEnabled, biometricReady, refreshUsers, unlock, login, logout, persistVault, verifyPin, changePin, wipeAccount, importDatabase, biometricUnlock, setBiometricEnabledPref, checkBioStatus, checkDeviceBinding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export type { User };
