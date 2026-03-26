import React, { useEffect, useState, useMemo } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
  DefaultTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { AppTheme } from '../theme/theme.types';
import { getAccessToken, getLoggedInUser } from '../storage/auth.storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PORTALS, isBusinessUser } from '../utils/portals';
import { biometricStorage } from '../storage/biometric.storage';
import { promptBiometric } from '../hooks/useBiometric';
import { AuthNavigator } from './AuthNavigator';
import { OwnerTabNavigator } from './OwnerTabNavigator';
import { CustomerTabNavigator } from './CustomerTabNavigator';
import type { RootStackParamList } from './types';

// ─── Navigation Ref (for external use, e.g. axios 401 interceptor) ─────────

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ─── Stack ──────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Root Navigator ─────────────────────────────────────────────────────────

export function RootNavigator() {
  const { colors, palette, mode } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Navigation theme — reactive to accent and mode changes.
  const navigationTheme = useMemo(() => ({
    ...DefaultTheme,
    dark: mode === 'dark',
    colors: {
      ...DefaultTheme.colors,
      primary:      colors.primary,
      background:   palette.background,
      card:         palette.surface,
      text:         palette.onBackground,
      border:       palette.divider,
      notification: colors.primary,
    },
  }), [colors, palette, mode]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await getAccessToken();

        if (!token) {
          if (mounted) setInitialRoute('Auth');
          return;
        }

        const user = await getLoggedInUser();
        const roles = user?.roles ?? [];
        const types = user?.types ?? [];
        const isBusiness = isBusinessUser(roles, types);

        const savedPortal = await AsyncStorage.getItem('session:activeProfile');
        let route: keyof RootStackParamList;

        if (savedPortal === PORTALS.customer.key) {
          route = PORTALS.customer.route;
        } else if (savedPortal === PORTALS.business.key && isBusiness) {
          route = PORTALS.business.route;
        } else {
          route = isBusiness ? PORTALS.business.route : PORTALS.customer.route;
          const defaultKey = isBusiness ? PORTALS.business.key : PORTALS.customer.key;
          await AsyncStorage.setItem('session:activeProfile', defaultKey);
        }

        if (route !== 'Auth') {
          const biometricEnabled = await biometricStorage.isEnabled();
          if (biometricEnabled) {
            const passed = await promptBiometric('Verify your identity to continue');
            if (!passed) {
              await AsyncStorage.clear();
              route = 'Auth';
            }
          }
        }

        if (mounted) setInitialRoute(route);
      } catch {
        if (mounted) setInitialRoute('Auth');
      } finally {
        if (mounted) setIsReady(true);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (!isReady || !initialRoute) {
    return (
      <View style={[styles.loader, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, animation: 'none' }}
      >
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="OwnerTabs" component={OwnerTabNavigator} />
        <Stack.Screen name="CustomerTabs" component={CustomerTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
