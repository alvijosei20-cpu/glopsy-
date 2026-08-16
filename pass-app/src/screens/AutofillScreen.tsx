import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePalette } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { cancelFill, completeFill, finishAutofill, getFillContext, FillContext } from '../lib/autofill';
import { t } from '../i18n';
import { VaultItem } from '../types';

function normalizeHost(url: string): string {
  const u = String(url || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  return u.split('/')[0] || u;
}

function matches(item: VaultItem, ctx: FillContext | null): boolean {
  if (!ctx) return false;
  const url = String(item.url || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  const user = String(item.username || '').toLowerCase();
  const host = normalizeHost(item.url);
  const domain = (ctx.webDomain || '').toLowerCase().replace(/^www\./, '');
  const pkg = (ctx.packageName || '').toLowerCase();

  if (domain) {
    if (host && (host === domain || host.endsWith('.' + domain) || domain.endsWith('.' + host))) return true;
    if (url.includes(domain) || (host && domain.includes(host)) || name.includes(domain)) return true;
  }
  if (pkg) {
    if (url.includes(pkg) || name.includes(pkg) || user.includes(pkg)) return true;
  }
  return false;
}

export default function AutofillScreen() {
  const { state } = useAuth();
  const c = usePalette();
  const { showToast } = useToast();

  const [ctx, setCtx] = useState<FillContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getFillContext().then(setCtx);
  }, []);

  const vault = state.vault;
  const candidates = useMemo(() => {
    if (!vault) return [];
    return vault.items.filter((i) => (i.username || i.password) && i.type === 'password');
  }, [vault]);

  const matched = useMemo(
    () => (ctx ? candidates.filter((i) => matches(i, ctx)) : []),
    [candidates, ctx]
  );

  const baseList = matched.length ? matched : candidates;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseList;
    return candidates.filter((i) => {
      const name = String(i.name || '').toLowerCase();
      const user = String(i.username || '').toLowerCase();
      const url = String(i.url || '').toLowerCase();
      return name.includes(q) || user.includes(q) || url.includes(q);
    });
  }, [baseList, candidates, query]);

  const target = ctx ? ctx.webDomain || ctx.packageName : '';

  const doComplete = useCallback(
    async (item: VaultItem) => {
      if (busy) return;
      setBusy(true);
      const ok = await completeFill(item.username, item.password);
      if (ok) {
        await finishAutofill();
      } else {
        setBusy(false);
        showToast(t('autofill.err'), 'error');
      }
    },
    [busy, showToast]
  );

  const doCancel = useCallback(async () => {
    await cancelFill();
    await finishAutofill();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      doCancel();
      return true;
    });
    return () => sub.remove();
  }, [doCancel]);

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={doCancel} hitSlop={10} disabled={busy}>
          <Icon name="close" size={24} color={c.text2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>{t('autofill.title')}</Text>
      </View>

      <View style={[styles.targetBox, { backgroundColor: c.card }]}>
        <Icon name="key" size={20} color={c.accent} />
        <View style={styles.targetBody}>
          <Text style={[styles.targetLabel, { color: c.text3 }]}>{t('autofill.for')}</Text>
          <Text style={[styles.targetName, { color: c.text }]} numberOfLines={1}>
            {target || t('autofill.app')}
          </Text>
        </View>
      </View>

      {candidates.length > 3 ? (
        <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.border }]}>
          <Icon name="search" size={18} color={c.text3} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder={t('common.search') || 'Buscar...'}
            placeholderTextColor={c.text3}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="close-circle" size={18} color={c.text3} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {list.length ? (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }: { item: VaultItem }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: c.card }]}
              activeOpacity={0.7}
              disabled={busy}
              onPress={() => doComplete(item)}
            >
              <View style={[styles.ic, { backgroundColor: c.accentSoft }]}>
                <Icon name="lock-closed" size={18} color={c.accent} />
              </View>
              <View style={styles.body}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.meta, { color: c.text3 }]} numberOfLines={1}>
                  {item.username || item.url || t('autofill.nouser')}
                </Text>
              </View>
              <Icon name="checkmark" size={20} color={c.accent} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.empty}>
          <Icon name="file-tray-outline" size={40} color={c.text3} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('autofill.empty.title')}</Text>
          <Text style={[styles.emptyText, { color: c.text3 }]}>
            {t('autofill.empty.text')}
          </Text>
          <Button title={t('common.cancel')} variant="ghost" block onPress={doCancel} />
        </View>
      )}

      {busy ? (
        <View style={[styles.busyBar, { backgroundColor: c.card }]}>
          <Text style={[styles.busyText, { color: c.text2 }]}>{t('autofill.filling')}</Text>
        </View>
      ) : null}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    marginRight: 12,
    padding: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
  },
  targetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 12,
  },
  targetBody: {
    flex: 1,
  },
  targetLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  targetName: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  ic: {
    width: 38,
    height: 38,
    borderRadius: 11,
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
    marginBottom: 18,
    lineHeight: 19,
  },
  busyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 14,
    alignItems: 'center',
  },
  busyText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
