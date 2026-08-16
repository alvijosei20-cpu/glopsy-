import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from './ThemeContext';

type ToastType = 'success' | 'error' | '';

interface ToastContextValue {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; type: ToastType; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = '') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, type, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? <ToastHost key={toast.key} msg={toast.msg} type={toast.type} /> : null}
    </ToastContext.Provider>
  );
}

function ToastHost({ msg, type }: { msg: string; type: ToastType }) {
  const c = usePalette();
  const bg = type === 'error' ? c.red : type === 'success' ? c.green : c.toastBg;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={[styles.toast, { backgroundColor: bg, shadowColor: '#000' }]}>
        <Text style={[styles.text, { color: type === 'success' || type === 'error' ? '#ffffff' : c.text }]}>{msg}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    maxWidth: '86%',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
