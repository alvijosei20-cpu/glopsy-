import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import { SectionTitle, SettingRow } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { usePalette } from '../context/ThemeContext';
import { Store } from '../lib/store';
import { shareJsonFile } from '../lib/export';
import { VAULT } from '../lib/vault';
import { openAutofillSettings, autofillStatus } from '../lib/autofill';
import { t, tp } from '../i18n';
import type { MainTabScreenProps } from '../navigation/types';

export default function SettingsScreen({ navigation }: MainTabScreenProps<'Settings'>) {
  const { state, saving, logout, persistVault, wipeAccount, importDatabase, refreshUsers, biometricEnabled, setBiometricEnabledPref, checkBioStatus } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const c = usePalette();

  const user = state.user!;
  const vault = state.vault!;
  const s = VAULT.stats(vault);

  const onExportDB = async () => {
    try {
      await Store.exportDatabase();
    } catch (e) {
      showToast(t('settings.err.db'), 'error');
    }
  };

  const onImportDB = () => {
    Alert.alert(t('settings.restore.title'), t('settings.restore.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.continue'), onPress: () => importDatabase() },
    ]);
  };

  const onExportVault = async () => {
    const name = `pass-backup-${new Date().toISOString().slice(0, 10)}.json`;
    await shareJsonFile(name, JSON.stringify(vault, null, 2), t('settings.exported'));
    showToast(t('settings.exported'), 'success');
  };

  const onBioToggle = async (v: boolean) => {
    if (v) {
      const status = await checkBioStatus();
      if (status === 'no-hardware') {
        showToast(t('settings.err.nobio'), 'error');
        return;
      }
    }
    await setBiometricEnabledPref(v);
  };

  const onAutofill = async () => {
    const status = autofillStatus();
    if (status === 'not-android') {
      showToast(t('settings.autofill.android'), 'error');
      return;
    }
    if (status === 'not-built') {
      showToast('Autofill solo está disponible en Android', 'error');
      return;
    }
    const ok = await openAutofillSettings();
    if (!ok) showToast(t('settings.autofill.err'), 'error');
  };

  const onWipe = () => {
    Alert.alert(t('settings.wipe.title'), t('settings.wipe.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => await wipeAccount() },
    ]);
  };

  const onSupport = async () => {
    const channel = '1332457717821866046/1537960195550875718';
    try {
      await Linking.openURL(`discord://-/channels/${channel}`);
    } catch {
      try {
        await Linking.openURL(`https://discord.com/channels/${channel}`);
      } catch {}
    }
  };

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>{t('settings.account')}</SectionTitle>
        <SettingRow icon="person" title={user} subtitle={tp('settings.items', s.total, { n: s.total })} />

        <SectionTitle>{t('settings.security')}</SectionTitle>
        <SettingRow icon="key" title={t('settings.changePin')} subtitle={t('settings.changePin.sub')} onPress={() => navigation.navigate('ChangePin')} />
        <SettingRow
          icon="finger-print"
          title={t('settings.bio')}
          subtitle={t('settings.bio.sub')}
          right={
            <Switch
              value={biometricEnabled}
              onValueChange={onBioToggle}
              trackColor={{ true: c.accent, false: c.border }}
            />
          }
        />
        <SettingRow
          icon="text"
          title={t('settings.autofill')}
          subtitle={t('settings.autofill.sub')}
          onPress={onAutofill}
        />

        <SectionTitle>{t('settings.appearance')}</SectionTitle>
        <SettingRow
          icon={isDark ? 'moon' : 'sunny'}
          title={isDark ? t('settings.night') : t('settings.day')}
          subtitle={t('settings.theme.sub')}
          right={<Switch value={isDark} onValueChange={toggleTheme} trackColor={{ true: c.accent, false: c.border }} />}
        />

        <SectionTitle>{t('settings.db')}</SectionTitle>
        <SettingRow icon="folder" title={t('settings.dbFile')} subtitle={t('settings.dbFile.sub')} />
        <SettingRow icon="download" title={t('settings.dbSave')} subtitle={t('settings.dbSave.sub')} onPress={onExportDB} />
        <SettingRow icon="cloud-upload" title={t('settings.dbRestore')} subtitle={t('settings.dbRestore.sub')} onPress={onImportDB} />

        <SectionTitle>{t('settings.data')}</SectionTitle>
        <SettingRow icon="document-text" title={t('settings.export')} subtitle={t('settings.export.sub')} onPress={onExportVault} />

        <SectionTitle>{t('settings.session')}</SectionTitle>
        <SettingRow icon="log-out" title={t('settings.logout')} subtitle={t('settings.logout.sub')} onPress={logout} />

        <SectionTitle>{t('settings.danger')}</SectionTitle>
        <SettingRow icon="trash" title={t('settings.wipe')} subtitle={t('settings.wipe.sub')} danger onPress={onWipe} />

        <SectionTitle>{t('settings.support')}</SectionTitle>
        <SettingRow icon="logo-discord" title="Discord" subtitle={t('settings.support.sub')} onPress={onSupport} />

        <SectionTitle>{t('settings.legal')}</SectionTitle>
        <SettingRow icon="document-text" title={t('settings.terms')} subtitle={t('settings.terms.sub')} onPress={() => navigation.navigate('Terms')} />

        <Text style={[styles.foot, { color: c.text3 }]}>{saving ? t('app.saving') : ' '}</Text>
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
    paddingBottom: 40,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  foot: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
  },
});
