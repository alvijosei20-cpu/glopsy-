import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';
import { usePalette } from '../context/ThemeContext';

type KeyValue = string | 'del';

const ROWS: (KeyValue | null)[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'del'],
];

interface KeypadProps {
  onPress: (k: string) => void;
}

export default function Keypad({ onPress }: KeypadProps) {
  const c = usePalette();
  return (
    <View style={styles.keypad}>
      {ROWS.flat().map((k, idx) => {
        if (k === null) return <View key={`e${idx}`} style={[styles.key, styles.empty]} />;
        return (
          <TouchableOpacity
            key={k}
            style={[styles.key, { backgroundColor: c.card2 }]}
            activeOpacity={0.6}
            onPress={() => onPress(k)}
          >
            {k === 'del' ? (
              <Icon name="close" size={24} color={c.text2} />
            ) : (
              <Text style={[styles.keyText, { color: c.text }]}>{k}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 6,
  },
  key: {
    width: 74,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
  },
});
