import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NavigationRoute } from '@react-navigation/native';
import type { ParamListBase } from '@react-navigation/native';
import Icon, { GlyphName } from './Icon';
import { usePalette } from '../context/ThemeContext';
import { t } from '../i18n';

export default function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const c = usePalette();
  const insets = useSafeAreaInsets();

  const labels: Record<string, string> = { Home: t('tab.home'), Vault: t('tab.vault'), Settings: t('tab.settings') };
  const icons: Record<string, GlyphName> = { Home: 'home', Vault: 'shield', Settings: 'settings' };

  const renderTab = (route: NavigationRoute<ParamListBase, string>, index: number) => {
    const isFocused = state.index === index;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };
    return (
      <TouchableOpacity key={route.key} style={styles.item} onPress={onPress} activeOpacity={0.7}>
        <Icon name={icons[route.name] || 'cube'} size={23} color={isFocused ? c.accent : c.text3} />
        <Text style={[styles.label, { color: isFocused ? c.accent : c.text3 }]}>{labels[route.name] || route.name}</Text>
      </TouchableOpacity>
    );
  };

  const addButton = (
    <View key="__ADD__" style={styles.item}>
      <TouchableOpacity
        style={[styles.addBtn, { backgroundColor: c.accent }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AddEdit', {})}
      >
        <Icon name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const children: React.ReactNode[] = [];
  state.routes.forEach((route, index) => {
    children.push(renderTab(route, index));
    if (route.name === 'Vault') children.push(addButton);
  });

  return (
    <View style={[styles.bar, { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: insets.bottom }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
