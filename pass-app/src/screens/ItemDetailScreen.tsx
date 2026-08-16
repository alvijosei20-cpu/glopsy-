import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import ProtectedText from '../components/ProtectedText';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePalette } from '../context/ThemeContext';
import { TYPES, VAULT, IoniconName } from '../lib/vault';
import { t } from '../i18n';
import type { RootStackScreenProps } from '../navigation/types';

export default function ItemDetailScreen({ navigation, route }: RootStackScreenProps<'ItemDetail'>) {
  const { state, persistVault } = useAuth();
  const c = usePalette();
  const vault = state.vault!;
  const item = vault.items.find((i) => i.id === route.params.id);
  if (!item) return null;

  const typeDef = TYPES[item.type] || TYPES.password;
  const cat = VAULT.cat(item.category);

  const onDelete = () => {
    Alert.alert(t('item.delete.title'), t('item.delete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.borrar'),
        style: 'destructive',
        onPress: async () => {
          VAULT.deleteItem(vault, item.id);
          await persistVault({ toast: t('addedit.deleted') });
          navigation.goBack();
        },
      },
    ]);
  };

  const onEdit = () => {
    navigation.replace('AddEdit', { id: item.id });
  };

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="close" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={styles.headMid}>
          <View style={[styles.typeIc, { backgroundColor: c.accentSoft }]}>
            <Icon name={typeDef.icon as IoniconName} size={20} color={c.accent} />
          </View>
          <Text style={[styles.itemName, { color: c.text }]} numberOfLines={2}>{item.name}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.meta, { color: c.text3 }]}>{cat.label} · {typeDef.label}</Text>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <ProtectedText label={t('item.password')} value={item.password} kind="password" />
          <ProtectedText label={t('item.username')} value={item.username} />
          <ProtectedText label={t('item.url')} value={item.url} />
          <ProtectedText label={t('item.seed')} value={item.seed} kind="seed" />
          <ProtectedText label={t('item.card')} value={item.cardNumber} kind="card" />
          <ProtectedText label={t('item.cvv')} value={item.cvv} kind="cvv" />
          <ProtectedText label={t('item.expiry')} value={item.expiry} />
          <ProtectedText label={t('item.notes')} value={item.notes} />
        </View>

        <View style={styles.actions}>
          <Button title={t('item.edit')} variant="ghost" icon="create" onPress={onEdit} />
          <Button title={t('common.borrar')} variant="danger" icon="trash" onPress={onDelete} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginHorizontal: 8,
  },
  typeIc: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
});
