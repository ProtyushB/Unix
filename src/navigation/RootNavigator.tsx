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
import { PORTALS, isBusinessUser, CUSTOMER_PORTAL_ENABLED } from '../utils/portals';
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

        // `types` is cached at sign-in by LoginScreen.cacheProfile, which swallows
        // every failure and returns [] — a network blip during login leaves the
        // cache empty while login still succeeds. So "no types" means WE DON'T
        // KNOW, not "not a business user".
        //
        // Deliberately keyed on `types` alone, NOT on roles. Despite the comment in
        // portals.ts calling roles a fallback, auth returns roles like
        // ["CUSTOMER","USER","PLATFORM_ADMIN"] and never BUSINESS_OWNER, so roles
        // is useless as positive evidence and actively misleading as negative
        // evidence — it is always non-empty, which would make this guard a no-op.
        const haveProfileSignal = types.length > 0;

        let route: keyof RootStackParamList;

        if (!CUSTOMER_PORTAL_ENABLED) {
          // Kill switch. Deliberately does NOT touch session:activeProfile — a
          // user who last chose 'customer' keeps that stored preference, so it is
          // honoured again the moment the portal is re-enabled rather than being
          // quietly rewritten while the feature is off.
          route = PORTALS.business.route;
        } else if (savedPortal === PORTALS.customer.key) {
          route = PORTALS.customer.route;
        } else if (savedPortal === PORTALS.business.key) {
          // A stored 'business' choice is itself evidence of access: nothing writes
          // that key unless the business portal was offered, and it is only offered
          // to business users. Honour it unless access is positively disproved.
          //
          // Critically, this branch no longer writes to storage. It used to fall
          // through to the else below, which overwrote the key with 'customer' —
          // so one unlucky launch permanently discarded the user's portal choice
          // and every subsequent launch opened the customer portal on its own.
          route = isBusiness || !haveProfileSignal
            ? PORTALS.business.route
            : PORTALS.customer.route;
        } else {
          // No stored choice at all — derive one. This is the only path that may
          // write the key, and it only does so when the profile cache actually
          // told us something: recording "customer" off an empty cache would bake
          // a guess into storage and make the next launch treat it as the user's
          // decision. Leaving the key unset instead lets this re-derive, and
          // self-correct as soon as `types` is populated.
          route = isBusiness ? PORTALS.business.route : PORTALS.customer.route;
          if (haveProfileSignal) {
            const defaultKey = isBusiness ? PORTALS.business.key : PORTALS.customer.key;
            await AsyncStorage.setItem('session:activeProfile', defaultKey);
          }
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
