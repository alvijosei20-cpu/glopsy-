import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from '../components/AuthHeader';
import PinDots from '../components/PinDots';
import Keypad from '../components/Keypad';
import Icon from '../components/Icon';
import useShake from '../components/useShake';
import { useAuth, BioResult } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePalette } from '../context/ThemeContext';
import { Store } from '../lib/store';
import { loadSession } from '../lib/session';
import { lastUser, forgetLastUser, lockRemaining, registerFailedAttempt, clearLock, formatLockTime } from '../lib/persist';
import { t } from '../i18n';
import { syncClock } from '../lib/clock';
import type { RootStackScreenProps } from '../navigation/types';

const BIO_MSG: Record<string, string> = {
  'no-session': t('bio.no-session'),
  canceled: t('bio.canceled'),
  failed: t('bio.failed'),
  unavailable: t('bio.unavailable'),
  'bad-vault': t('bio.bad-vault'),
};

export default function LoginScreen({ navigation }: RootStackScreenProps<'Login'>) {
  const { login, biometricEnabled, biometricUnlock } = useAuth();
  const { showToast } = useToast();
  const c = usePalette();
  const { shake, style } = useShake();

  const [remembered, setRemembered] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [pinLen, setPinLen] = useState(4);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);
  const pinRef = useRef(pin);
  pinRef.current = pin;

  useEffect(() => {
    lastUser().then((lu) => {
      const u = lu && Store.getUser(lu) ? lu : null;
      setRemembered(u);
      if (u) setPinLen(Store.getUser(u)?.pinLen || 4);
    });
    syncClock();
  }, []);

  useEffect(() => {
    let active = true;
    loadSession().then((s) => {
      if (active) setHasSession(!!s);
    });
    return () => {
      active = false;
    };
  }, []);

  const canBio = !!biometricEnabled && hasSession;

  // Pide la huella automáticamente al montar, una sola vez.
  const onBiometricRef = useRef<() => void>(() => {});
  const triggered = useRef(false);
  useEffect(() => {
    onBiometricRef.current = onBiometric;
  });

  useEffect(() => {
    if (!canBio || triggered.current) return;
    triggered.current = true;
    const t = setTimeout(() => onBiometricRef.current(), 600);
    return () => clearTimeout(t);
  }, [canBio]);

  const activeUser = remembered || username.trim();

  const fail = (msg: string) => {
    setError(true);
    setErrorMsg(msg);
    setPin('');
    shake();
    setBusy(false);
    setProgress(null);
  };

  const doLogin = async (p: string) => {
    const user = activeUser;
    if (!user) {
      fail(t('login.err.userFirst'));
      inputRef.current?.focus();
      return;
    }
    try {
      const wait = await lockRemaining(user);
      if (wait > 0) {
        fail(t('login.err.locked', { time: formatLockTime(wait) }));
        return;
      }
      const found = Store.getUser(user);
      if (!found) {
        const w = await registerFailedAttempt(user);
        if (w > 0) {
          fail(t('login.err.badLocked', { time: formatLockTime(w) }));
        } else if (w < 0) {
          fail(t('login.err.badAttempts', { n: -w }));
        } else {
          fail(t('login.err.bad'));
        }
        return;
      }
      const ok = await login(user, p, setProgress);
      if (!ok) {
        const w = await registerFailedAttempt(user);
        if (w > 0) {
          fail(t('login.err.badLocked', { time: formatLockTime(w) }));
        } else if (w < 0) {
          fail(t('login.err.badAttempts', { n: -w }));
        } else {
          fail(t('login.err.bad'));
        }
        return;
      }
      await clearLock(user);
    } catch (e: any) {
      fail(e?.message || t('login.err.fail'));
    }
  };

  const handleKey = (k: string) => {
    Keyboard.dismiss();
    if (busy) return;
    let next = pinRef.current;
    if (k === 'del') next = next.slice(0, -1);
    else if (next.length < pinLen) next = next + k;
    setPin(next);
    setError(false);
    setErrorMsg('');
    if (next.length === pinLen) {
      setBusy(true);
      setTimeout(() => doLogin(next), 250);
    }
  };

  const submit = () => {
    if (busy) return;
    const p = pinRef.current;
    if (!p.length) return;
    setBusy(true);
    doLogin(p);
  };

  const onUsernameChange = (t: string) => {
    const clean = t.replace(/[^a-zA-Z0-9._@+-]/g, '').slice(0, 32);
    setUsername(clean);
    const u = Store.getUser(clean.trim());
    if (u) setPinLen(u.pinLen || 4);
    else setPinLen(4);
  };

  const onBiometric = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    const res = await biometricUnlock();
    setBioBusy(false);
    if (res !== 'ok') {
      showToast(BIO_MSG[res] || 'No se pudo desbloquear', res === 'no-session' || res === 'bad-vault' ? 'error' : '');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AuthHeader
        tagline={
          remembered
            ? t('login.remembered.tagline', { user: remembered.split(/[._-]/)[0] })
            : t('login.default.tagline')
        }
      />
      <Animated.View style={[styles.card, { backgroundColor: c.card, shadowColor: '#000' }, style]}>
        {remembered ? (
          <View style={styles.userRow}>
            <Icon name="person-circle" size={30} color={c.accent} />
            <Text style={[styles.userName, { color: c.text }]}>{remembered}</Text>
            <TouchableOpacity
              onPress={async () => {
                await forgetLastUser();
                setRemembered(null);
                setPin('');
                setPinLen(4);
              }}
            >
              <Text style={[styles.changeUser, { color: c.accent }]}>{t('login.change')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: c.text2 }]}>{t('login.user')}</Text>
            <TextInput
              ref={inputRef}
              style={[styles.input, { backgroundColor: c.card2, color: c.text, borderColor: c.border }]}
              placeholder={t('login.userPh')}
              placeholderTextColor={c.text3}
              maxLength={32}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              value={username}
              onChangeText={onUsernameChange}
            />
            <Text style={[styles.hint, { color: c.text3 }]}>{t('login.hint')}</Text>
          </View>
        )}
        <PinDots length={pinLen} filled={pin.length} error={error && pin.length === 0} />
        {error && pin.length === 0 ? <Text style={[styles.errorText, { color: c.red }]}>{errorMsg}</Text> : null}
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={c.accent} />
            <Text style={[styles.busyText, { color: c.text2 }]}>
              {progress != null ? t('login.unlockingPct', { pct: progress }) : t('login.unlocking')}
            </Text>
          </View>
        ) : null}
        <Keypad onPress={handleKey} />
        {canBio ? (
          <TouchableOpacity
            style={[styles.bioBtn, { borderColor: c.border }]}
            onPress={onBiometric}
            disabled={bioBusy}
            activeOpacity={0.7}
          >
            <Icon name="finger-print" size={22} color={c.accent} />
            <Text style={[styles.bioText, { color: c.text }]}>{t('login.bio')}</Text>
          </TouchableOpacity>
        ) : null}
        {biometricEnabled && !hasSession ? (
          <Text style={[styles.bioHint, { color: c.text3 }]}>{t('login.bio.hint')}</Text>
        ) : null}
        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: c.accent }]} onPress={submit} disabled={busy}>
          <Text style={styles.submitText}>{t('login.submit')}</Text>
        </TouchableOpacity>
      </Animated.View>
      <View style={styles.switchRow}>
        <Text style={{ color: c.text2 }}>{t('login.noAccount')} </Text>
        <TouchableOpacity onPress={() => navigation.replace('Register')}>
          <Text style={[styles.link, { color: c.accent }]}>{t('login.register')}</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 18,
    padding: 18,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  userName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  changeUser: {
    fontSize: 14,
    fontWeight: '700',
  },
  field: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
  },
  errorText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 2,
  },
  busyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  busyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bioBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  bioText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bioHint: {
    textAlign: 'center',
    fontSize: 12.5,
    marginTop: 10,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },
  link: {
    fontWeight: '700',
  },
});
