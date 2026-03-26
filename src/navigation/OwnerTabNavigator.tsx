import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { AppTheme } from '../theme/theme.types';
import type {
  OwnerTabParamList,
  CatalogStackParamList,
  OperationsStackParamList,
  InventoryStackParamList,
  PeopleStackParamList,
  ProfileStackParamList,
} from './types';
import DashboardScreen from '../screens/owner/DashboardScreen';
import CatalogScreen from '../screens/owner/CatalogScreen';
import ProductDetailScreen from '../screens/owner/ProductDetailScreen';
import ServiceDetailScreen from '../screens/owner/ServiceDetailScreen';
import OperationsScreen from '../screens/owner/OperationsScreen';
import { OrderDetailScreen } from '../screens/owner/OrderDetailScreen';
import { AppointmentDetailScreen } from '../screens/owner/AppointmentDetailScreen';
import { BillingDetailScreen } from '../screens/owner/BillingDetailScreen';
import { InventoryScreen } from '../screens/owner/InventoryScreen';
import { PeopleScreen } from '../screens/owner/PeopleScreen';
import { AccountScreen } from '../screens/owner/AccountScreen';
import { SecurityScreen } from '../screens/shared/SecurityScreen';
import { AuthMethodsScreen } from '../screens/shared/AuthMethodsScreen';
import { BiometricOnboardingModal } from '../components/common/BiometricOnboardingModal';

// ─── Account/Profile Stack ───────────────────────────────────────────────────

const AccountProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function AccountNavigator() {
  return (
    <AccountProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <AccountProfileStack.Screen name="ProfileMain" component={AccountScreen} />
      <AccountProfileStack.Screen name="Security" component={SecurityScreen} />
      <AccountProfileStack.Screen name="AuthMethods" component={AuthMethodsScreen} />
    </AccountProfileStack.Navigator>
  );
}

// ─── Stack Navigators ───────────────────────────────────────────────────────

const CatalogStack = createNativeStackNavigator<CatalogStackParamList>();
const OperationsStack = createNativeStackNavigator<OperationsStackParamList>();
const InventoryStack = createNativeStackNavigator<InventoryStackParamList>();
const PeopleStack = createNativeStackNavigator<PeopleStackParamList>();

function CatalogNavigator() {
  return (
    <CatalogStack.Navigator screenOptions={{ headerShown: false }}>
      <CatalogStack.Screen name="CatalogMain" component={CatalogScreen} />
      <CatalogStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <CatalogStack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
    </CatalogStack.Navigator>
  );
}

function OperationsNavigator() {
  return (
    <OperationsStack.Navigator screenOptions={{ headerShown: false }}>
      <OperationsStack.Screen name="OperationsMain" component={OperationsScreen} />
      <OperationsStack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <OperationsStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
      <OperationsStack.Screen name="BillingDetail" component={BillingDetailScreen} />
    </OperationsStack.Navigator>
  );
}

function InventoryNavigator() {
  return (
    <InventoryStack.Navigator screenOptions={{ headerShown: false }}>
      <InventoryStack.Screen name="InventoryMain" component={InventoryScreen} />
    </InventoryStack.Navigator>
  );
}

function PeopleNavigator() {
  return (
    <PeopleStack.Navigator screenOptions={{ headerShown: false }}>
      <PeopleStack.Screen name="PeopleMain" component={PeopleScreen} />
    </PeopleStack.Navigator>
  );
}

// ─── Tab Navigator ──────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<OwnerTabParamList>();

const ICON_SIZE = 22;

export function OwnerTabNavigator() {
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
          tabBarActiveTintColor:   colors.primary,
          tabBarInactiveTintColor: palette.muted,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: ICON_SIZE }}>⊞</Text> }}
        />
        <Tab.Screen
          name="Catalog"
          component={CatalogNavigator}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: ICON_SIZE }}>📦</Text> }}
        />
        <Tab.Screen
          name="Operations"
          component={OperationsNavigator}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: ICON_SIZE }}>📋</Text> }}
        />
        <Tab.Screen
          name="Inventory"
          component={InventoryNavigator}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: ICON_SIZE }}>🗄</Text> }}
        />
        <Tab.Screen
          name="People"
          component={PeopleNavigator}
          options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: ICON_SIZE }}>👥</Text> }}
        />
        <Tab.Screen
          name="Account"
          component={AccountNavigator}
          options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: ICON_SIZE }}>👤</Text> }}
        />
      </Tab.Navigator>
      <BiometricOnboardingModal />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

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
