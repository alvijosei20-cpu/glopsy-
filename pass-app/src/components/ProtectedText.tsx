import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';
import { usePalette } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import * as Clipboard from 'expo-clipboard';
import { t } from '../i18n';

const MASKED_KINDS = ['password', 'seed', 'cvv', 'card'];

interface ProtectedTextProps {
  label: string;
  value: string;
  kind?: string;
}

export default function ProtectedText({ label, value, kind = 'text' }: ProtectedTextProps) {
  const c = usePalette();
  const { showToast } = useToast();
  const [revealed, setRevealed] = useState(false);

  if (!value) return null;
  const masked = MASKED_KINDS.includes(kind);
  const display =
    kind === 'card'
      ? '•••• ' + String(value).replace(/\D/g, '').slice(-4)
      : masked && !revealed
        ? '••••••••'
        : value;

  const copy = async () => {
    await Clipboard.setStringAsync(value);
    showToast(t('protected.copied'), 'success');
  };

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: c.text3 }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: c.text }]} numberOfLines={4} selectable>{display}</Text>
        {masked ? (
          <TouchableOpacity style={styles.btn} onPress={() => setRevealed((r) => !r)}>
            <Icon name={revealed ? 'eye-off' : 'eye'} size={19} color={c.text2} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.btn} onPress={copy}>
          <Icon name="copy" size={18} color={c.text2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000018',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  value: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  btn: {
    padding: 8,
    marginLeft: 4,
  },
});
