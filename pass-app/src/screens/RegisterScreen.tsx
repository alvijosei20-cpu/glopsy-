import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthHeader from '../components/AuthHeader';
import PinDots from '../components/PinDots';
import Keypad from '../components/Keypad';
import Icon from '../components/Icon';
import useShake from '../components/useShake';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePalette } from '../context/ThemeContext';
import { Store } from '../lib/store';
import * as Crypto from '../lib/crypto';
import { VAULT } from '../lib/vault';
import { Vault } from '../types';
import { getDeviceId, deviceBindingAvailable } from '../lib/deviceBinding';
import { verifyLicenseCode, formatLicenseCode, normalizeLicenseCode } from '../lib/license';
import * as Clipboard from 'expo-clipboard';
import { t } from '../i18n';
import type { RootStackScreenProps } from '../navigation/types';

export default function RegisterScreen({ navigation }: RootStackScreenProps<'Register'>) {
  const { unlock, refreshUsers } = useAuth();
  const { showToast } = useToast();
  const c = usePalette();
  const { shake, style } = useShake();

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'pin' | 'confirm'>('pin');
  const [sub, setSub] = useState(t('reg.sub.choose'));
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [licenseCode, setLicenseCode] = useState('');
  const [activated, setActivated] = useState(false);
  const [bindingLoading, setBindingLoading] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!deviceBindingAvailable) {
      setBindingLoading(false);
      return;
    }
    getDeviceId()
      .then((id) => setDeviceId(id))
      .finally(() => setBindingLoading(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onActivate = () => {
    if (!deviceId) {
      showToast(t('license.unavailable'), 'error');
      return;
    }
    const clean = normalizeLicenseCode(licenseCode);
    if (!clean) {
      showToast(t('license.err.empty'), 'error');
      codeRef.current?.focus();
      return;
    }
    if (!verifyLicenseCode(deviceId, clean)) {
      showToast(t('license.err.invalid'), 'error');
      setLicenseCode('');
      codeRef.current?.focus();
      return;
    }
    setActivated(true);
    showToast(t('license.ok'), 'success');
  };

  const copyDeviceId = async () => {
    if (!deviceId) return;
    await Clipboard.setStringAsync(deviceId);
    showToast(t('license.copied'), 'success');
  };

  const doPin = async (p: string) => {
    const user = username.trim();
    if (!user) {
      showToast(t('reg.err.user'), 'error');
      setPin('');
      setBusy(false);
      inputRef.current?.focus();
      return;
    }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(user)) {
      showToast(t('reg.err.userFormat'), 'error');
      setPin('');
      setBusy(false);
      return;
    }
    if (Store.getUser(user)) {
      showToast(t('reg.err.exists'), 'error');
      setPin('');
      setBusy(false);
      return;
    }
    if (!activated) {
      showToast(t('license.err.empty'), 'error');
      setPin('');
      setBusy(false);
      codeRef.current?.focus();
      return;
    }
    if (step === 'pin') {
      if (Crypto.isWeakPin(p)) {
        showToast(t('reg.err.weakPin'), 'error');
        setPin('');
        shake();
        setBusy(false);
        return;
      }
      setFirstPin(p);
      setStep('confirm');
      setSub(t('reg.sub.confirm'));
      setPin('');
      setBusy(false);
      return;
    }
    if (p !== firstPin) {
      showToast(t('reg.err.mismatch'), 'error');
      setStep('pin');
      setFirstPin(null);
      setSub(t('reg.sub.choose'));
      setPin('');
      shake();
      setBusy(false);
      return;
    }
    try {
      const salt = Crypto.randomSalt();
      const canA2 = await Crypto.canUseArgon2();
      const kdf = canA2 ? 'argon2id' : 'pbkdf2';
      const pinKey = await Crypto.derivePinKey(
        p,
        salt,
        kdf === 'argon2id' ? { kdf: 'argon2id' } : { kdf: 'pbkdf2', iterations: Crypto.DEFAULT_ITERATIONS },
        setProgress
      );
      const masterKey = Crypto.randomBytes(32);
      const vault = VAULT.create();
      const encVault = Crypto.encrypt(vault, masterKey);
      const wrappedKey = Crypto.wrapKey(masterKey, pinKey);
      await Store.saveUser({
        username: user,
        salt,
        vault: encVault,
        wrappedKey,
        kdf,
        kdfIterations: kdf === 'argon2id' ? undefined : Crypto.DEFAULT_ITERATIONS,
        kdfParams: kdf === 'argon2id' ? Crypto.ARGON2_PARAMS : undefined,
        pinLen: 6,
        deviceId: deviceId || undefined,
        licenseCode: normalizeLicenseCode(licenseCode) || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      refreshUsers();
      await unlock(user, salt, masterKey, vault);
    } catch (e: any) {
      showToast(e?.message || t('reg.err.create'), 'error');
      setPin('');
      shake();
      setBusy(false);
    }
  };

  const handleKey = (k: string) => {
    Keyboard.dismiss();
    if (busy) return;
    let next = pin;
    if (k === 'del') next = pin.slice(0, -1);
    else if (pin.length < 6) next = pin + k;
    setPin(next);
    if (next.length === 6) {
      setBusy(true);
      setTimeout(() => doPin(next), 250);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AuthHeader tagline={t('reg.tagline')} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.card, { backgroundColor: c.card, shadowColor: '#000' }, style]}>
          {bindingLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={c.accent} />
              <Text style={[styles.loadingText, { color: c.text3 }]}>{t('license.title')}…</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.licenseTitle, { color: c.text }]}>{t('license.title')}</Text>
              <Text style={[styles.licenseSub, { color: c.text3 }]}>{t('license.subtitle')}</Text>

              {deviceId ? (
                <>
                  <Text style={[styles.fieldLabel, { color: c.text2 }]}>{t('license.deviceLabel')}</Text>
                  <View style={styles.idRow}>
                    <Text style={[styles.deviceId, { color: c.text }]} numberOfLines={1} selectable>{deviceId}</Text>
                    <TouchableOpacity style={[styles.copyBtn, { backgroundColor: c.card2 }]} onPress={copyDeviceId} hitSlop={8}>
                      <Icon name="copy" size={17} color={c.text2} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.sendHint, { color: c.text3 }]}>{t('license.sendMe')}</Text>

                  <Text style={[styles.fieldLabel, { color: c.text2 }]}>{t('license.codeLabel')}</Text>
                  <View style={styles.codeRow}>
                    <TextInput
                      ref={codeRef}
                      style={[styles.codeInput, { backgroundColor: c.card2, color: c.text, borderColor: activated ? c.green : c.border }]}
                      placeholder={t('license.codePh')}
                      placeholderTextColor={c.text3}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={19}
                      editable={!activated}
                      value={licenseCode}
                      onChangeText={(v) => setLicenseCode(formatLicenseCode(v))}
                      onSubmitEditing={onActivate}
                    />
                    {activated ? (
                      <Icon name="checkmark-circle" size={22} color={c.green} />
                    ) : (
                      <TouchableOpacity style={[styles.activateBtn, { backgroundColor: c.accent }]} onPress={onActivate}>
                        <Text style={styles.activateText}>{t('license.activate')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <Text style={[styles.sendHint, { color: c.red }]}>{t('license.unavailable')}</Text>
              )}
            </>
          )}

          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: c.text2 }]}>{t('reg.user')}</Text>
            <TextInput
              ref={inputRef}
              style={[styles.input, { backgroundColor: c.card2, color: c.text, borderColor: c.border }]}
              placeholder={t('reg.userPh')}
              placeholderTextColor={c.text3}
              maxLength={32}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              value={username}
              onChangeText={(v) => setUsername(v.replace(/[@+]/g, '').replace(/[^a-zA-Z0-9._@+-]/g, '').slice(0, 32))}
            />
          </View>
          <Text style={[styles.sub, { color: c.text2 }]}>{sub}</Text>
          {busy ? (
            <Text style={[styles.progress, { color: c.text3 }]}>
              {progress != null ? t('reg.creatingPct', { pct: progress }) : t('reg.creating')}
            </Text>
          ) : null}
          <PinDots length={6} filled={pin.length} />
          <Keypad onPress={handleKey} />
        </Animated.View>
        <View style={styles.switchRow}>
          <Text style={{ color: c.text2 }}>{t('reg.hasAccount')} </Text>
          <TouchableOpacity onPress={() => navigation.replace('Login')}>
            <Text style={[styles.link, { color: c.accent }]}>{t('reg.signin')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.termsRow} onPress={() => navigation.navigate('Terms')}>
          <Text style={[styles.termsText, { color: c.text3 }]}>
            {t('reg.terms')} <Text style={{ color: c.accent }}>{t('reg.termsLink')}</Text>.
          </Text>
        </TouchableOpacity>
        </ScrollView>
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 16,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  licenseTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  licenseSub: {
    fontSize: 12.5,
    marginTop: 2,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
    marginLeft: 2,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceId: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendHint: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  activateBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  activateText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 14,
  },
  field: {
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  sub: {
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 8,
  },
  progress: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },
  link: {
    fontWeight: '700',
  },
  termsRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 20,
  },
});
