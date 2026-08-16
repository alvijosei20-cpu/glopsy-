import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import ItemRow from '../components/ItemRow';
import Icon from '../components/Icon';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePalette } from '../context/ThemeContext';
import { VAULT, IoniconName } from '../lib/vault';
import { t } from '../i18n';
import { VaultItem } from '../types';
import type { MainTabScreenProps } from '../navigation/types';

interface StatProps {
  label: string;
  icon: IoniconName;
  count: number;
  accent: string;
}

function Stat({ label, icon, count, accent }: StatProps) {
  const c = usePalette();
  return (
    <View style={[styles.stat, { backgroundColor: c.card }]}>
      <View style={[styles.statIc, { backgroundColor: accent + '22' }]}>
        <Icon name={icon} size={19} color={accent} />
      </View>
      <View>
        <Text style={[styles.statNum, { color: c.text }]}>{count}</Text>
        <Text style={[styles.statLbl, { color: c.text3 }]}>{label}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const { state } = useAuth();
  const c = usePalette();
  const vault = state.vault!;
  const s = VAULT.stats(vault);
  const recent = VAULT.recent(vault, 4);
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('home.greet.morning') : hour < 20 ? t('home.greet.afternoon') : t('home.greet.evening');
  const raw = (state.user || '').split(/[._-]/)[0];
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);

  const openItem = (id: string) => navigation.navigate('ItemDetail', { id });
  const goAdd = () => navigation.navigate('AddEdit', {});

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.greet, { color: c.text3 }]}>{greet},</Text>
        <Text style={[styles.name, { color: c.text }]}>{name}</Text>

        <View style={styles.statGrid}>
          <Stat label={t('home.stat.total')} icon="cube" count={s.total} accent={c.accent} />
          <Stat label={t('home.stat.password')} icon="key" count={s.password} accent="#6d4dff" />
          <Stat label={t('home.stat.crypto')} icon="logo-bitcoin" count={s.seed} accent="#b45309" />
          <Stat label={t('home.stat.cards')} icon="card" count={s.card} accent="#0e7490" />
        </View>

        {recent.length ? (
          <>
            <Text style={[styles.sectionTitle, { color: c.text2 }]}>{t('home.recent')}</Text>
            {recent.map((item: VaultItem) => (
              <ItemRow key={item.id} item={item} onPress={openItem} />
            ))}
            <View style={styles.center}>
              <Button
                title={t('home.openVault')}
                variant="ghost"
                icon="shield"
                onPress={() => navigation.navigate('Vault')}
              />
            </View>
          </>
        ) : (
          <View style={[styles.empty, { backgroundColor: c.card }]}>
            <Icon name="lock-open" size={40} color={c.text3} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>{t('home.empty.title')}</Text>
            <Text style={[styles.emptyText, { color: c.text3 }]}>{t('home.empty.text')}</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: c.accent }]} onPress={goAdd}>
              <Icon name="add" size={18} color="#fff" style={styles.emptyBtnIcon} />
              <Text style={styles.emptyBtnText}>{t('home.add')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 30,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  greet: {
    fontSize: 15,
    marginTop: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  stat: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  statIc: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNum: {
    fontSize: 19,
    fontWeight: '800',
  },
  statLbl: {
    fontSize: 12.5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  center: {
    alignItems: 'center',
    marginTop: 8,
  },
  empty: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 28,
    marginTop: 12,
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
    marginBottom: 16,
    lineHeight: 19,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  emptyBtnIcon: {
    marginRight: 8,
  },
  emptyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
