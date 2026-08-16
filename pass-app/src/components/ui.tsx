import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import Icon, { GlyphName } from './Icon';
import { usePalette } from '../context/ThemeContext';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const c = usePalette();
  return <Text style={[styles.sectionTitle, { color: c.text2 }]}>{children}</Text>;
}

interface FieldProps extends TextInputProps {
  label?: string;
}

export function Field({ label, style, ...rest }: FieldProps) {
  const c = usePalette();
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.fieldLabel, { color: c.text2 }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={c.text3}
        style={[
          styles.input,
          {
            backgroundColor: c.card,
            color: c.text,
            borderColor: c.border,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  icon?: GlyphName;
  block?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', icon, block, disabled }: ButtonProps) {
  const c = usePalette();
  const stylesBtn = {
    primary: { bg: c.accent, color: '#ffffff', border: 'transparent' },
    ghost: { bg: 'transparent', color: c.text, border: c.border },
    danger: { bg: 'transparent', color: c.red, border: c.border },
    soft: { bg: c.accentSoft, color: c.accent, border: 'transparent' },
  }[variant];
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: stylesBtn.bg,
          borderColor: stylesBtn.border,
          opacity: disabled ? 0.5 : 1,
        },
        block && styles.block,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={stylesBtn.color} style={styles.btnIcon} /> : null}
      <Text style={[styles.buttonText, { color: stylesBtn.color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

interface SettingRowProps {
  icon: GlyphName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}

export function SettingRow({ icon, title, subtitle, onPress, danger, right }: SettingRowProps) {
  const c = usePalette();
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.settingRow, { backgroundColor: c.card }]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.settingIc, { backgroundColor: danger ? c.red + '1a' : c.accentSoft }]}>
        <Icon name={icon} size={19} color={danger ? c.red : c.accent} />
      </View>
      <View style={styles.settingBody}>
        <Text style={[styles.settingTitle, { color: danger ? c.red : c.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.settingSub, { color: c.text3 }]}>{subtitle}</Text> : null}
      </View>
      {right ? right : onPress ? <Icon name="chevron-forward" size={17} color={c.text3} /> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  block: {
    alignSelf: 'stretch',
  },
  btnIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  settingIc: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingBody: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
});
