import React from 'react';
import { StyleSheet, View } from 'react-native';
import { usePalette } from '../context/ThemeContext';

export default function PinDots({ length, filled, error }: { length: number; filled: number; error?: boolean }) {
  const c = usePalette();
  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                borderColor: error ? c.red : c.border,
                backgroundColor: error && !isFilled ? c.red : isFilled ? c.accent : 'transparent',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 18,
  },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2,
  },
});
