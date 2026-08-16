import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';
import { usePalette } from '../context/ThemeContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

export default function AppHeader() {
  const c = usePalette();
  const { isDark, toggleTheme } = useTheme();
  const { saving } = useAuth();
  return (
    <View style={[styles.header, { borderBottomColor: c.border }]}>
      <View style={styles.logoRow}>
        <View style={[styles.logoBox, { backgroundColor: c.accentSoft }]}>
          <Icon name="shield-checkmark" size={19} color={c.accent} />
        </View>
        <Text style={[styles.brand, { color: c.text }]}>Pass</Text>
        <Text style={[styles.sub, { color: c.text3 }]}>{t('app.tagline')}</Text>
      </View>
      <View style={styles.right}>
        {saving ? <Text style={[styles.saving, { color: c.text3 }]}>{t('app.saving')}</Text> : null}
        <TouchableOpacity style={styles.btn} onPress={toggleTheme} hitSlop={8}>
          <Icon name={isDark ? 'sunny' : 'moon'} size={21} color={c.text2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 19,
    fontWeight: '800',
  },
  sub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saving: {
    fontSize: 12,
    fontWeight: '600',
  },
  btn: {
    padding: 4,
  },
});
