import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';
import { usePalette } from '../context/ThemeContext';
import { TYPES, VAULT, itemMeta, IoniconName } from '../lib/vault';
import { VaultItem } from '../types';

const TYPE_ACCENTS: Record<string, string> = {
  password: '#6d4dff',
  seed: '#b45309',
  card: '#0e7490',
  note: '#059669',
};

export default function ItemRow({ item, onPress }: { item: VaultItem; onPress: (id: string) => void }) {
  const c = usePalette();
  const t = TYPES[item.type] || TYPES.password;
  const accent = TYPE_ACCENTS[item.type] || c.accent;
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: c.card }]} activeOpacity={0.7} onPress={() => onPress(item.id)}>
      <View style={[styles.ic, { backgroundColor: accent + '22' }]}>
        <Icon name={t.icon as IoniconName} size={20} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.meta, { color: c.text3 }]} numberOfLines={1}>{itemMeta(item)}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={c.text3} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  ic: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
});
