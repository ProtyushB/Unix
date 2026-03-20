import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
  DefaultTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { darkPalette } from '../theme/colors';
import { getAccessToken, getLoggedInUser } from '../storage/auth.storage';
import { AuthNavigator } from './AuthNavigator';
import { OwnerTabNavigator } from './OwnerTabNavigator';
import { CustomerTabNavigator } from './CustomerTabNavigator';
import type { RootStackParamList } from './types';

// ─── Navigation Ref (for external use, e.g. axios 401 interceptor) ─────────

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ─── Dark Theme ─────────────────────────────────────────────────────────────

const DarkNavigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#f97316',
    background: darkPalette.bg,
    card: darkPalette.surface,
    text: darkPalette.text,
    border: darkPalette.border,
    notification: '#f97316',
  },
};

// ─── Determine initial route based on role ──────────────────────────────────

const OWNER_ROLES = ['ROLE_ADMIN', 'ROLE_OWNER', 'ROLE_EMPLOYEE'];

function isOwner(roles: string[]): boolean {
  return roles.some(role => OWNER_ROLES.includes(role));
}

// ─── Stack ──────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Root Navigator ─────────────────────────────────────────────────────────

export function RootNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await getAccessToken();

        if (!token) {
          if (mounted) {
            setInitialRoute('Auth');
          }
          return;
        }

        const user = await getLoggedInUser();
        const roles = user?.roles ?? [];

        if (mounted) {
          setInitialRoute(isOwner(roles) ? 'OwnerTabs' : 'CustomerTabs');
        }
      } catch {
        if (mounted) {
          setInitialRoute('Auth');
        }
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!isReady || !initialRoute) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={DarkNavigationTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="OwnerTabs" component={OwnerTabNavigator} />
        <Stack.Screen name="CustomerTabs" component={CustomerTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: darkPalette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
