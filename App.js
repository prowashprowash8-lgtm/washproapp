import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { LaundryTimerProvider } from './src/context/LaundryTimerContext';
import { configureLaundryNotificationHandler } from './src/services/laundryTimerService';
import { colors, typography, borderRadius } from './src/theme/colors';

import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import ConfigRequiredScreen from './src/screens/auth/ConfigRequiredScreen';

import PayScreen from './src/screens/PayScreen';
import LaundryDetailScreen from './src/screens/LaundryDetailScreen';
import AideScreen from './src/screens/AideScreen';
import TransactionScreen from './src/screens/TransactionScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WalletScreen from './src/screens/WalletScreen';
import MissionsScreen from './src/screens/MissionsScreen';
import MissionDetailScreen from './src/screens/MissionDetailScreen';
import ScrollableTabBar from './src/components/ScrollableTabBar';

const IS_WEB = Platform.OS === 'web';
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const AuthStack = createStackNavigator();

function PayStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PayHome" component={PayScreen} />
      <Stack.Screen name="LaundryDetail" component={LaundryDetailScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="MissionsList" component={MissionsScreen} />
      <Stack.Screen name="MissionDetail" component={MissionDetailScreen} />
      <Stack.Screen name="Aide" component={AideScreen} />
    </Stack.Navigator>
  );
}

function TabIcon({ name, label, focused }) {
  const iconColor = focused ? colors.primary : '#000000';
  return (
    <View style={[styles.iconFrame, focused && styles.iconFrameFocused]}>
      <View style={styles.iconWrapper}>
        <MaterialCommunityIcons name={name} size={20} color={iconColor} />
      </View>
      <Text style={[styles.frameLabel, { color: iconColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      tabBar={(props) => <ScrollableTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#000000',
      }}
    >
      <Tab.Screen
        name="Laver"
        component={PayStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="washing-machine" label={t('tabWash')} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Activité"
        component={TransactionScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="format-list-bulleted" label={t('tabActivity')} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="account-circle-outline" label={t('tabProfile')} focused={focused} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const current = state.routes[state.index];
            if (current?.name !== 'Profil') return;
            const profilRoute = state.routes.find((r) => r.name === 'Profil');
            const nested = profilRoute?.state;
            if (nested && typeof nested.index === 'number' && nested.index > 0) {
              e.preventDefault();
              navigation.navigate('Profil', { screen: 'ProfileMain' });
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen
        name="Bienvenue"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Connexion"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Inscription"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="MotDePasseOublie"
        component={ForgotPasswordScreen}
        options={{ headerShown: false }}
      />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading, configured } = useAuth();
  const { t } = useLanguage();

  if (!configured) {
    return (
      <View style={styles.appContainer}>
        <ConfigRequiredScreen />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.appContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.appContainer}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <Stack.Screen name="Main" component={MainTabs} />
          ) : (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const FONT_LOAD_TIMEOUT_MS = 5000;

export default function App() {
  const [fontsLoaded, fontError] = useFonts(
    IS_WEB
      ? {} // Web : pas de polices Google (évite page blanche)
      : { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold }
  );
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    configureLaundryNotificationHandler();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  const canRender = fontsLoaded || fontError || fontTimeout;
  if (!canRender) {
    return (
      <View style={[styles.appContainer, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <LanguageProvider>
          <LaundryTimerProvider>
            <AuthProvider>
              <AppNavigator />
            </AuthProvider>
          </LaundryTimerProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && { minHeight: '100vh' }),
  },
  iconWrapper: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrame: {
    minWidth: 68,
    maxWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFrameFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  frameLabel: {
    fontSize: 8,
    fontWeight: typography.semibold,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
