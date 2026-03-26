import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { darkPalette, themes } from '../theme/colors';
import type {
  OwnerTabParamList,
  CatalogStackParamList,
  OperationsStackParamList,
  InventoryStackParamList,
  PeopleStackParamList,
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: themes.default.primary,
        tabBarInactiveTintColor: darkPalette.muted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⊞</Text> }}
      />
      <Tab.Screen
        name="Catalog"
        component={CatalogNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📦</Text> }}
      />
      <Tab.Screen
        name="Operations"
        component={OperationsNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text> }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🗄</Text> }}
      />
      <Tab.Screen
        name="People"
        component={PeopleNavigator}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👥</Text> }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: darkPalette.surface,
    borderTopColor: darkPalette.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 0,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
