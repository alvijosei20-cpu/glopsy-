import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import PinDots from '../components/PinDots';
import Keypad from '../components/Keypad';
import useShake from '../components/useShake';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePalette } from '../context/ThemeContext';
import { Store } from '../lib/store';
import * as Crypto from '../lib/crypto';
import { lockRemaining, registerFailedAttempt, formatLockTime } from '../lib/persist';
import { t } from '../i18n';
import { useSecureScreen } from '../components/useSecureScreen';
import type { RootStackScreenProps } from '../navigation/types';

type Step = 'old' | 'new' | 'confirm';

export default function ChangePinScreen({ navigation }: RootStackScreenProps<'ChangePin'>) {
  useSecureScreen();
  const { state, verifyPin, changePin } = useAuth();
  const { showToast } = useToast();
  const c = usePalette();
  const { shake, style } = useShake();

  const currentLen = Store.getUser(state.user!)?.pinLen || 4;
  const [step, setStep] = useState<Step>('old');
  const [pin, setPin] = useState('');
  const [len, setLen] = useState(currentLen);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [sub, setSub] = useState(t('pin.sub.old'));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handleKey = (k: string) => {
    if (busy) return;
    let next = pin;
    if (k === 'del') next = pin.slice(0, -1);
    else if (pin.length < len) next = pin + k;
    setPin(next);
    if (next.length === len) {
      setBusy(true);
      setTimeout(() => doPin(next), 250);
    }
  };

  const doPin = async (p: string) => {
    if (step === 'old') {
      const wait = await lockRemaining(state.user!);
      if (wait > 0) {
        showToast(t('pin.err.locked'), 'error');
        setPin('');
        shake();
        setBusy(false);
        return;
      }
      const ok = await verifyPin(p, setProgress);
      if (!ok) {
        const w = await registerFailedAttempt(state.user!);
        if (w > 0) {
          showToast(t('pin.err.blocked', { time: formatLockTime(w) }), 'error');
        } else {
          showToast(t('pin.err.wrong'), 'error');
        }
        setPin('');
        shake();
        setBusy(false);
        return;
      }
      setStep('new');
      setSub(t('pin.sub.new'));
      setLen(6);
      setPin('');
      setBusy(false);
      return;
    }
    if (step === 'new') {
      if (Crypto.isWeakPin(p)) {
        showToast(t('reg.err.weakPin'), 'error');
        setPin('');
        shake();
        setBusy(false);
        return;
      }
      setNewPin(p);
      setStep('confirm');
      setSub(t('pin.sub.confirm'));
      setPin('');
      setBusy(false);
      return;
    }
    if (p !== newPin) {
      showToast(t('reg.err.mismatch'), 'error');
      setStep('new');
      setNewPin(null);
      setSub(t('pin.sub.new'));
      setPin('');
      shake();
      setBusy(false);
      return;
    }
    try {
      await changePin(p);
      showToast(t('pin.ok'), 'success');
      navigation.goBack();
    } catch (e: any) {
      showToast(e?.message || t('pin.err.change'), 'error');
      setStep('new');
      setNewPin(null);
      setSub(t('pin.sub.new'));
      setPin('');
      shake();
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="close" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('pin.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.sub, { color: c.text2 }]}>{sub}</Text>
        {busy ? (
          <Text style={[styles.progress, { color: c.text3 }]}>
            {progress != null ? t('login.unlockingPct', { pct: progress }) : t('login.unlocking')}
          </Text>
        ) : null}
        <PinDots length={len} filled={pin.length} />
        <Keypad onPress={handleKey} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sub: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  progress: {
    fontSize: 13,
    marginBottom: 2,
  },
});
