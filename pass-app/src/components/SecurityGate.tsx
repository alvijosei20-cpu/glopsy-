import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, NativeModules, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';
import { t } from '../i18n';

type GateState = 'checking' | 'ok' | 'rooted' | 'overlay';

/**
 * Bloquea la app si el dispositivo tiene root o si hay superposiciones
 * (overlays) de terceros activas. FLAG_SECURE se aplica por pantalla sensible
 * vía useSecureScreen (no en login/autofill, para no bloquear gestores externos).
 */
export default function SecurityGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const active = useRef(true);

  const runCheck = async () => {
    const mod = NativeModules.PassSecurity;
    if (!mod) {
      setState('ok');
      return;
    }
    try {
      const rooted = await mod.isDeviceRooted();
      if (!active.current) return;
      if (rooted) {
        setState('rooted');
        return;
      }
      const overlay = await mod.isOverlayDanger();
      if (!active.current) return;
      setState(overlay ? 'overlay' : 'ok');
    } catch {
      if (active.current) setState('ok');
    }
  };

  useEffect(() => {
    runCheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') runCheck();
    });
    return () => {
      active.current = false;
      sub.remove();
    };
  }, []);

  if (state === 'checking') {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>{t('gate.checking')}</Text>
      </View>
    );
  }

  if (state === 'ok') return <>{children}</>;

  const blocked = state === 'rooted';
  return (
    <View style={styles.center}>
      <Icon name={blocked ? 'lock-closed' : 'eye-off'} size={44} color="#E5484D" />
      <Text style={styles.title}>
        {blocked ? t('gate.rooted.title') : t('gate.overlay.title')}
      </Text>
      <Text style={styles.body}>
        {blocked ? t('gate.rooted.body') : t('gate.overlay.body')}
      </Text>
      {blocked ? (
        <TouchableOpacity style={styles.btn} onPress={() => BackHandler.exitApp()}>
          <Text style={styles.btnText}>{t('common.close')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            setState('checking');
            runCheck();
          }}
        >
          <Text style={styles.btnText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#0B0E14',
  },
  title: {
    color: '#EDEFF3',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  body: {
    color: '#9AA4B2',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: 24,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
