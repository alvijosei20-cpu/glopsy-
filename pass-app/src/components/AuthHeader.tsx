import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { usePalette } from '../context/ThemeContext';
import { t } from '../i18n';

export default function AuthHeader({ tagline }: { tagline: string }) {
  const c = usePalette();
  return (
    <View style={styles.wrap}>
      <View style={styles.logoRow}>
        <View style={[styles.logoBox, { backgroundColor: c.accentSoft }]}>
          <Icon name="shield-checkmark" size={26} color={c.accent} />
        </View>
        <View>
          <Text style={[styles.brand, { color: c.text }]}>Pass</Text>
          <Text style={[styles.tag, { color: c.text3 }]}>{t('app.tagline')}</Text>
        </View>
      </View>
      <Text style={[styles.tagline, { color: c.text2 }]}>{tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 26,
  },
  tag: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagline: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
  },
});
