import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { AppTheme } from '../theme/theme.types';
import type { CustomerTabParamList, ProfileStackParamList } from './types';
import { ExploreScreen } from '../screens/customer/ExploreScreen';
import { BookingsScreen } from '../screens/customer/BookingsScreen';
import { CustomerOrdersScreen as OrdersScreen } from '../screens/customer/CustomerOrdersScreen';
import { BillsScreen } from '../screens/customer/BillsScreen';
import { CustomerProfileScreen } from '../screens/customer/CustomerProfileScreen';
import { SecurityScreen } from '../screens/shared/SecurityScreen';
import { AuthMethodsScreen } from '../screens/shared/AuthMethodsScreen';
import { BiometricOnboardingModal } from '../components/common/BiometricOnboardingModal';
import { UpdatePromptModal } from '../components/common/UpdatePromptModal';

// ─── Profile Stack ───────────────────────────────────────────────────────────

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={CustomerProfileScreen} />
      <ProfileStack.Screen name="Security" component={SecurityScreen} />
      <ProfileStack.Screen name="AuthMethods" component={AuthMethodsScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Tab icons ───────────────────────────────────────────────────────────────

/**
 * Each tab's icon is a real component defined ONCE at module scope, not an arrow written inline in
 * `options`. An inline arrow is a new component type on every render of the navigator, which makes
 * React unmount and remount the icon subtree rather than update it.
 *
 * `color` stays inline because the navigator supplies it per state (active/inactive) — only the
 * static half of the style belongs in the StyleSheet.
 */
const iconStyles = StyleSheet.create({
  emoji: { fontSize: 20 },
});

function makeTabIcon(emoji: string) {
  const TabIcon = ({ color }: { color: string }) => (
    <Text style={[iconStyles.emoji, { color }]}>{emoji}</Text>
  );
  TabIcon.displayName = `TabIcon(${emoji})`;
  return TabIcon;
}

const ExploreIcon = makeTabIcon('🧭');
const BookingsIcon = makeTabIcon('📅');
const OrdersIcon = makeTabIcon('🛍');
const BillsIcon = makeTabIcon('🧾');
const ProfileIcon = makeTabIcon('👤');

// ─── Tab Navigator ───────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<CustomerTabParamList>();

export function CustomerTabNavigator() {
  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.flex}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.divider,
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
            elevation: 0,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: palette.muted,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tab.Screen
          name="Explore"
          component={ExploreScreen}
          options={{ tabBarIcon: ExploreIcon }}
        />
        <Tab.Screen
          name="Bookings"
          component={BookingsScreen}
          options={{ tabBarIcon: BookingsIcon }}
        />
        <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarIcon: OrdersIcon }} />
        <Tab.Screen name="Bills" component={BillsScreen} options={{ tabBarIcon: BillsIcon }} />
        <Tab.Screen
          name="Profile"
          component={ProfileNavigator}
          options={{ tabBarIcon: ProfileIcon }}
        />
      </Tab.Navigator>
      <BiometricOnboardingModal />
      {/* See OwnerTabNavigator — mounted in both shells so a customer-only user
          still gets updates; the check itself runs once per process. */}
      <UpdatePromptModal />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    flex: { flex: 1 },
    tabLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
  });
}
