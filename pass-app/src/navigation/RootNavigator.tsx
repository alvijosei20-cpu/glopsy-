import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePalette } from '../context/ThemeContext';
import { getFillContext } from '../lib/autofill';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import VaultScreen from '../screens/VaultScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddEditScreen from '../screens/AddEditScreen';
import ItemDetailScreen from '../screens/ItemDetailScreen';
import ChangePinScreen from '../screens/ChangePinScreen';
import TermsScreen from '../screens/TermsScreen';
import AutofillScreen from '../screens/AutofillScreen';

import AppTabBar from '../components/AppTabBar';
import type { RootStackParamList, MainTabParamList } from './types';

const AuthStack = createNativeStackNavigator<RootStackParamList>();
const MainStack = createNativeStackNavigator<RootStackParamList>();
const AutofillStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthFlow() {
  const { hasUsers } = useAuth();
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false, animation: 'fade' }}
      initialRouteName={hasUsers ? 'Login' : 'Register'}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="Terms" component={TermsScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Vault" component={VaultScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function MainFlow() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Main" component={MainTabs} />
      <MainStack.Screen name="AddEdit" component={AddEditScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <MainStack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <MainStack.Screen name="ChangePin" component={ChangePinScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <MainStack.Screen name="Terms" component={TermsScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </MainStack.Navigator>
  );
}

function AutofillFlow() {
  return (
    <AutofillStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Autofill">
      <AutofillStack.Screen name="Autofill" component={AutofillScreen} />
    </AutofillStack.Navigator>
  );
}

function Splash() {
  const c = usePalette();
  return (
    <View style={[styles.splash, { backgroundColor: c.bg }]}>
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}

export default function RootNavigator() {
  const { state, booted } = useAuth();
  const { isDark } = useTheme();
  const c = usePalette();
  const [autofillPending, setAutofillPending] = useState(false);

  // Detecta si la app fue abierta por una petición de Autofill (otra app).
  useEffect(() => {
    if (!booted) return;
    let active = true;
    const check = async () => {
      const ctx = await getFillContext();
      if (active) setAutofillPending(!!ctx);
    };
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [booted]);

  if (!booted) return <Splash />;

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: c.bg,
      card: c.card,
      text: c.text,
      border: c.border,
      primary: c.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {autofillPending ? (
        state.key ? <AutofillFlow /> : <AuthFlow />
      ) : state.key ? (
        <MainFlow />
      ) : (
        <AuthFlow />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
