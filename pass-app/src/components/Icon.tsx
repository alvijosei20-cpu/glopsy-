import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleProp, TextStyle } from 'react-native';
import { usePalette } from '../context/ThemeContext';

export type GlyphName = keyof typeof Ionicons.glyphMap;

interface IconProps {
  name: GlyphName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export default function Icon({ name, size = 22, color, style }: IconProps) {
  const c = usePalette();
  return <Ionicons name={name} size={size} color={color ?? c.text} style={style} />;
}
