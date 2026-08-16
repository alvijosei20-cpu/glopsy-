import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { Field, Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePalette } from '../context/ThemeContext';
import { VAULT, TYPES, CATEGORIES, sanitizeValue, IoniconName } from '../lib/vault';
import * as Crypto from '../lib/crypto';
import { t } from '../i18n';
import { ItemType, VaultItem } from '../types';
import type { RootStackScreenProps } from '../navigation/types';

interface FormState {
  type: ItemType;
  category: string;
  name: string;
  username: string;
  password: string;
  url: string;
  seed: string;
  cardNumber: string;
  cvv: string;
  expiry: string;
  notes: string;
}

const emptyForm: FormState = {
  type: 'password',
  category: 'otro',
  name: '',
  username: '',
  password: '',
  url: '',
  seed: '',
  cardNumber: '',
  cvv: '',
  expiry: '',
  notes: '',
};

function formFromItem(item?: VaultItem): FormState {
  if (!item) return { ...emptyForm };
  return {
    type: item.type,
    category: item.category,
    name: item.name,
    username: item.username,
    password: item.password,
    url: item.url,
    seed: item.seed,
    cardNumber: item.cardNumber,
    cvv: item.cvv,
    expiry: item.expiry,
    notes: item.notes,
  };
}

const sanitizeMap: Record<string, string> = {
  name: 'name',
  username: 'username',
  password: 'text',
  url: 'url',
  seed: 'text',
  cardNumber: 'card',
  cvv: 'digits',
  expiry: 'expiry',
  notes: 'text',
};

export default function AddEditScreen({ navigation, route }: RootStackScreenProps<'AddEdit'>) {
  const { state, persistVault } = useAuth();
  const { showToast } = useToast();
  const c = usePalette();

  const vault = state.vault!;
  const editing = route.params?.id;
  const editingItem = editing ? vault.items.find((i) => i.id === editing) : undefined;
  const [form, setForm] = useState<FormState>(() => formFromItem(editingItem));
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState, value: string, kind?: string) => {
    const sanitize = kind || sanitizeMap[key];
    const clean = sanitizeValue(value, sanitize);
    setForm((f) => ({ ...f, [key]: clean }));
  };

  const isNote = form.type === 'note';

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    const data = { ...form };
    if (editing) {
      VAULT.updateItem(vault, editing, data as Partial<VaultItem>);
      await persistVault({ toast: t('addedit.saved') });
    } else {
      VAULT.addItem(vault, data as Partial<VaultItem>);
      await persistVault({ toast: t('addedit.savedNew') });
    }
    setSaving(false);
    navigation.goBack();
  };

  const onDelete = () => {
    Alert.alert(t('addedit.delete.title'), t('addedit.delete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!editing) return;
          VAULT.deleteItem(vault, editing);
          await persistVault({ toast: t('addedit.deleted') });
          navigation.goBack();
        },
      },
    ]);
  };

  const generatePass = () => {
    const pw = Crypto.generatePassword(20);
    setForm((f) => ({ ...f, password: pw }));
    setShowPass(true);
    showToast(t('addedit.pwgen'), 'success');
  };

  const typeButton = (id: ItemType) => {
    const t = TYPES[id];
    const active = form.type === id;
    return (
      <TouchableOpacity
        key={id}
        style={[styles.seg, { backgroundColor: active ? c.accent : c.card, borderColor: active ? c.accent : c.border }]}
        onPress={() => setForm((f) => ({ ...f, type: id }))}
      >
        <Icon name={t.icon as IoniconName} size={16} color={active ? '#fff' : c.text2} />
        <Text style={[styles.segText, { color: active ? '#fff' : c.text2 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.label.split(' ')[0]}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="close" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>{editing ? t('addedit.edit') : t('addedit.new')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.segmented}>{Object.keys(TYPES).map((id) => typeButton(id as ItemType))}</View>

        <Text style={[styles.catLabel, { color: c.text2 }]}>{t('addedit.category')}</Text>
        <View style={styles.catWrap}>
          {CATEGORIES.map((cat) => {
            const active = form.category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, { backgroundColor: active ? c.accentSoft : c.card, borderColor: active ? c.accent : c.border }]}
                onPress={() => setForm((f) => ({ ...f, category: cat.id }))}
              >
                <Icon name={cat.icon} size={15} color={active ? c.accent : c.text2} />
                <Text style={[styles.catText, { color: active ? c.accent : c.text2 }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Field label={t('addedit.name')} placeholder={t('addedit.namePh')} maxLength={60} value={form.name} onChangeText={(v) => set('name', v)} />

        {form.type === 'password' && (
          <>
            <Field label={t('addedit.username')} maxLength={128} value={form.username} onChangeText={(v) => set('username', v)} />
            <View style={styles.passRow}>
              <Field
                label={t('addedit.password')}
                maxLength={200}
                secureTextEntry={!showPass}
                value={form.password}
                onChangeText={(v) => set('password', v)}
                style={styles.passField}
              />
              <TouchableOpacity style={[styles.eyeBtn, { backgroundColor: c.card2 }]} onPress={() => setShowPass((s) => !s)}>
                <Icon name={showPass ? 'eye-off' : 'eye'} size={20} color={c.text2} />
              </TouchableOpacity>
            </View>
            <Button title={t('addedit.generate')} variant="ghost" icon="refresh" onPress={generatePass} />
            <Field label={t('addedit.url')} placeholder={t('addedit.urlPh')} maxLength={2048} value={form.url} onChangeText={(v) => set('url', v)} keyboardType="url" />
          </>
        )}

        {form.type === 'seed' && (
          <Field label={t('addedit.seed')} placeholder={t('addedit.seedPh')} maxLength={300} value={form.seed} onChangeText={(v) => set('seed', v)} multiline style={{ minHeight: 84 }} />
        )}

        {form.type === 'card' && (
          <>
            <Field label={t('addedit.card')} placeholder={t('addedit.cardPh')} maxLength={19} value={form.cardNumber} onChangeText={(v) => set('cardNumber', v)} keyboardType="number-pad" />
            <View style={styles.pair}>
              <Field label={t('addedit.cvv')} maxLength={4} value={form.cvv} onChangeText={(v) => set('cvv', v)} keyboardType="number-pad" style={styles.pairItem} />
              <Field label={t('addedit.expiry')} placeholder={t('addedit.expiryPh')} maxLength={5} value={form.expiry} onChangeText={(v) => set('expiry', v)} keyboardType="number-pad" style={styles.pairItem} />
            </View>
            <Field label={t('addedit.holder')} maxLength={60} value={form.username} onChangeText={(v) => set('username', v, 'holder')} />
          </>
        )}

        {form.type === 'note' ? (
          <Field label={t('addedit.note')} maxLength={2000} value={form.notes} onChangeText={(v) => set('notes', v)} multiline style={{ minHeight: 110 }} />
        ) : (
          <Field label={t('addedit.notes')} placeholder={t('addedit.optional')} maxLength={2000} value={form.notes} onChangeText={(v) => set('notes', v)} multiline style={{ minHeight: 70 }} />
        )}

        <Button title={editing ? t('addedit.save') : t('addedit.saveNew')} icon="shield-checkmark" block onPress={onSave} disabled={saving} />
        {editing ? (
          <View style={{ marginTop: 10 }}>
            <Button title={t('common.delete')} variant="danger" icon="trash" block onPress={onDelete} />
          </View>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
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
  headerTitle: {
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
  segmented: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  seg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
  },
  segText: {
    fontSize: 13,
    fontWeight: '700',
  },
  select: {
    display: 'none',
  },
  catWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  catLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  catText: {
    fontSize: 13,
    fontWeight: '600',
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  passField: {
    flex: 1,
  },
  eyeBtn: {
    width: 46,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pair: {
    flexDirection: 'row',
    gap: 10,
  },
  pairItem: {
    flex: 1,
  },
});
