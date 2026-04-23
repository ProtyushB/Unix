import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useThemedStyles } from '../hooks/useThemedStyles';
import type { AppTheme } from '../theme/theme.types';
import type { OwnerTabParamList, ProfileStackParamList } from './types';

// Re-exports kept so orphaned composite screens (OperationsScreen, CatalogScreen,
// and the detail screens) still type-check even though they are no longer
// mounted here. Remove once those files are removed or rewritten.
export type {
  CatalogStackParamList,
  OperationsStackParamList,
  InventoryStackParamList,
  PeopleStackParamList,
} from './types';
import DashboardScreen from '../screens/owner/DashboardScreen';
import { InventoryScreen } from '../screens/owner/InventoryScreen';
import { AccountScreen } from '../screens/owner/AccountScreen';
import { OrdersScreen } from '../screens/owner/OrdersScreen';
import { AppointmentsScreen } from '../screens/owner/AppointmentsScreen';
import { BillingScreen } from '../screens/owner/BillingScreen';
import { ProductsScreen } from '../screens/owner/ProductsScreen';
import { ServicesScreen } from '../screens/owner/ServicesScreen';
import { PackagesScreen } from '../screens/owner/PackagesScreen';
import { SubscriptionsScreen } from '../screens/owner/SubscriptionsScreen';
import { ServicePlansScreen } from '../screens/owner/ServicePlansScreen';
import { ConsumptionsScreen } from '../screens/owner/ConsumptionsScreen';
import { StockTransfersScreen } from '../screens/owner/StockTransfersScreen';
import { WastageScreen } from '../screens/owner/WastageScreen';
import { CustomersScreen } from '../screens/owner/CustomersScreen';
import { EmployeesScreen } from '../screens/owner/EmployeesScreen';
import { WarrantyClaimsScreen } from '../screens/owner/WarrantyClaimsScreen';
import { LoyaltyScreen } from '../screens/owner/LoyaltyScreen';
import { ReportsScreen } from '../screens/owner/ReportsScreen';
import { SecurityScreen } from '../screens/shared/SecurityScreen';
import { AuthMethodsScreen } from '../screens/shared/AuthMethodsScreen';
import { BiometricOnboardingModal } from '../components/common/BiometricOnboardingModal';
import { BottomGroupNav } from '../components/navigation/BottomGroupNav';
import { GroupSheetOverlay } from '../components/navigation/GroupSheetOverlay';
import { BusinessSheetOverlay } from '../components/navigation/BusinessSheetOverlay';

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

// ─── Tab Navigator ──────────────────────────────────────────────────────────
// Every navbar item maps to its own tab.

const Tab = createBottomTabNavigator<OwnerTabParamList>();

export function OwnerTabNavigator() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.flex}>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomGroupNav {...props} />}
      >
        <Tab.Screen name="Dashboard"      component={DashboardScreen} />
        <Tab.Screen name="Orders"         component={OrdersScreen} />
        <Tab.Screen name="Appointments"   component={AppointmentsScreen} />
        <Tab.Screen name="Billing"        component={BillingScreen} />
        <Tab.Screen name="Products"       component={ProductsScreen} />
        <Tab.Screen name="Services"       component={ServicesScreen} />
        <Tab.Screen name="Packages"       component={PackagesScreen} />
        <Tab.Screen name="Subscriptions"  component={SubscriptionsScreen} />
        <Tab.Screen name="ServicePlans"   component={ServicePlansScreen} />
        <Tab.Screen name="Inventory"      component={InventoryScreen} />
        <Tab.Screen name="Consumptions"   component={ConsumptionsScreen} />
        <Tab.Screen name="StockTransfers" component={StockTransfersScreen} />
        <Tab.Screen name="Wastage"        component={WastageScreen} />
        <Tab.Screen name="Customers"      component={CustomersScreen} />
        <Tab.Screen name="Employees"      component={EmployeesScreen} />
        <Tab.Screen name="WarrantyClaims" component={WarrantyClaimsScreen} />
        <Tab.Screen name="Loyalty"        component={LoyaltyScreen} />
        <Tab.Screen name="Reports"        component={ReportsScreen} />
        <Tab.Screen name="Account"        component={AccountNavigator} />
      </Tab.Navigator>
      <GroupSheetOverlay />
      <BusinessSheetOverlay />
      <BiometricOnboardingModal />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    flex: { flex: 1 },
  });
}
