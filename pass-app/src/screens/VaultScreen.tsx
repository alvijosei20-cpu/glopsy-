import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import ItemRow from '../components/ItemRow';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { usePalette } from '../context/ThemeContext';
import { VAULT, CATEGORIES, IoniconName } from '../lib/vault';
import { t } from '../i18n';
import { VaultItem } from '../types';
import { useSecureScreen } from '../components/useSecureScreen';
import type { MainTabScreenProps } from '../navigation/types';

export default function VaultScreen({ navigation }: MainTabScreenProps<'Vault'>) {
  useSecureScreen();
  const { state } = useAuth();
  const c = usePalette();
  const vault = state.vault!;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todos');

  const results = VAULT.search(vault, q, cat);
  const chips = [{ id: 'todos', label: t('vault.all'), icon: 'grid' as IoniconName }, ...CATEGORIES];

  const openItem = (id: string) => navigation.navigate('ItemDetail', { id });

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <AppHeader />
      <View style={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>{t('vault.title')}</Text>
        <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <Icon name="search" size={18} color={c.text3} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder={t('vault.search')}
            placeholderTextColor={c.text3}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
          />
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={chips}
          keyExtractor={(item) => item.id}
          style={styles.chipsList}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.chip,
                { backgroundColor: cat === item.id ? c.accent : c.card, borderColor: cat === item.id ? c.accent : c.border },
              ]}
              onPress={() => setCat(item.id)}
            >
              <Icon name={item.icon} size={15} color={cat === item.id ? '#fff' : c.text2} />
              <Text style={[styles.chipText, { color: cat === item.id ? '#fff' : c.text2 }]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
        {results.length ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: VaultItem }) => <ItemRow item={item} onPress={openItem} />}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.empty}>
            <Icon name="search" size={40} color={c.text3} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>{t('vault.empty.title')}</Text>
            <Text style={[styles.emptyText, { color: c.text3 }]}>{t('vault.empty.text')}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    fontSize: 14.5,
  },
  chipsList: {
    flexGrow: 0,
  },
  chips: {
    gap: 8,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    color: '#999',
  },
});
