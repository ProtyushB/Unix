import React, { useRef } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BlurTargetView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { BlurTargetProvider } from '../components/common/BlurTargetContext';
import { TabConfigProvider } from '../backend/tab-config';
import type { AppTheme } from '../theme/theme.types';
import type {
  AppointmentsStackParamList,
  BillingStackParamList,
  CatalogStackParamList,
  InventoryStackParamList,
  OrdersStackParamList,
  OwnerTabParamList,
  ProfileStackParamList,
  ServicesStackParamList,
} from './types';

import DashboardScreen from '../screens/owner/DashboardScreen';
import { InventoryScreen } from '../screens/owner/inventory/InventoryScreen';
import { BatchDetailScreen } from '../screens/owner/inventory/detail/BatchDetailScreen';
import { AccountScreen } from '../screens/owner/AccountScreen';
import { OrdersScreen } from '../screens/owner/orders/OrdersScreen';
import { OrderDetailScreen } from '../screens/owner/orders/detail/OrderDetailScreen';
import { AppointmentsScreen } from '../screens/owner/appointments/AppointmentsScreen';
import { AppointmentDetailScreen } from '../screens/owner/appointments/detail/AppointmentDetailScreen';
import { BillingScreen } from '../screens/owner/billing/BillingScreen';
import { BillDetailScreen } from '../screens/owner/billing/detail/BillDetailScreen';
import { ProductsScreen } from '../screens/owner/products/ProductsScreen';
import { ProductDetailScreen } from '../screens/owner/products/detail/ProductDetailScreen';
import { ServicesScreen } from '../screens/owner/services/ServicesScreen';
import { ServiceDetailScreen } from '../screens/owner/services/detail/ServiceDetailScreen';
import { PackagesScreen } from '../screens/owner/PackagesScreen';
import { SubscriptionsScreen } from '../screens/owner/SubscriptionsScreen';
import { ServicePlansScreen } from '../screens/owner/ServicePlansScreen';
import { ConsumptionsScreen } from '../screens/owner/ConsumptionsScreen';
import { StockTransfersScreen } from '../screens/owner/StockTransfersScreen';
import { WastageScreen } from '../screens/owner/WastageScreen';
import { PlaceholderScreen } from '../screens/owner/PlaceholderScreen';
import { CustomersScreen } from '../screens/owner/CustomersScreen';
import { EmployeesScreen } from '../screens/owner/EmployeesScreen';
import { WarrantyClaimsScreen } from '../screens/owner/WarrantyClaimsScreen';
import { LoyaltyScreen } from '../screens/owner/LoyaltyScreen';
import { ReportsScreen } from '../screens/owner/ReportsScreen';
import { SecurityScreen } from '../screens/shared/SecurityScreen';
import { AuthMethodsScreen } from '../screens/shared/AuthMethodsScreen';
import { BiometricOnboardingModal } from '../components/common/BiometricOnboardingModal';
import { UpdatePromptModal } from '../components/common/UpdatePromptModal';
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

// ─── Catalog Stack ───────────────────────────────────────────────────────────

const CatalogStack = createNativeStackNavigator<CatalogStackParamList>();

/**
 * NESTED inside the Products tab, not mounted at the root.
 *
 * `TabConfigProvider` wraps the tab navigator below, so a root-level detail route would fall
 * outside it — `useTabConfig()` would hand back the unprovided default, `useIsTabEnabled('INVENTORY')`
 * would read false, and the Inventory card would silently vanish from the detail screen.
 */
function CatalogNavigator() {
  return (
    <CatalogStack.Navigator screenOptions={{ headerShown: false }}>
      <CatalogStack.Screen name="ProductsMain" component={ProductsScreen} />
      <CatalogStack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </CatalogStack.Navigator>
  );
}

// ─── Inventory Stack ─────────────────────────────────────────────────────────

const InventoryStack = createNativeStackNavigator<InventoryStackParamList>();

/** Nested inside the Inventory tab for the same reason as the catalog's — see above. */
function InventoryNavigator() {
  return (
    <InventoryStack.Navigator screenOptions={{ headerShown: false }}>
      <InventoryStack.Screen name="InventoryMain" component={InventoryScreen} />
      <InventoryStack.Screen name="InventoryDetail" component={BatchDetailScreen} />
    </InventoryStack.Navigator>
  );
}

// ─── Services Stack ──────────────────────────────────────────────────────────

const ServicesStack = createNativeStackNavigator<ServicesStackParamList>();

/** Nested inside the Services tab for the same reason as the catalog's — see above. */
function ServicesNavigator() {
  return (
    <ServicesStack.Navigator screenOptions={{ headerShown: false }}>
      <ServicesStack.Screen name="ServicesMain" component={ServicesScreen} />
      <ServicesStack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
    </ServicesStack.Navigator>
  );
}

// ─── Orders / Appointments / Billing Stacks ─────────────────────────────────

/**
 * Three stacks, not one.
 *
 * The dead `OperationsStackParamList` this replaces put all three detail routes behind a single
 * `OperationsMain`, and that would have been wrong even if the screen had existed: the three live
 * in three different tabs, so a shared stack would let Back out of a bill land on an order the user
 * never opened from there. Each tab owns its own history.
 *
 * All three are NESTED INSIDE their tab for the same reason the catalog is — see `CatalogNavigator`.
 */
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();

function OrdersNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="OrdersMain" component={OrdersScreen} />
      <OrdersStack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </OrdersStack.Navigator>
  );
}

const AppointmentsStack = createNativeStackNavigator<AppointmentsStackParamList>();

function AppointmentsNavigator() {
  return (
    <AppointmentsStack.Navigator screenOptions={{ headerShown: false }}>
      <AppointmentsStack.Screen name="AppointmentsMain" component={AppointmentsScreen} />
      <AppointmentsStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
    </AppointmentsStack.Navigator>
  );
}

const BillingStack = createNativeStackNavigator<BillingStackParamList>();

function BillingNavigator() {
  return (
    <BillingStack.Navigator screenOptions={{ headerShown: false }}>
      <BillingStack.Screen name="BillingMain" component={BillingScreen} />
      <BillingStack.Screen name="BillDetail" component={BillDetailScreen} />
    </BillingStack.Navigator>
  );
}

// ─── Tab Navigator ──────────────────────────────────────────────────────────

/**
 * `tabBar` is a RENDER PROP, not a component slot — React Navigation invokes it as `tabBar(props)`
 * rather than rendering `<TabBar {...props} />`. Passing `BottomGroupNav` directly therefore calls
 * it as a plain function, outside any component instance, and the first hook inside it throws
 * "Invalid hook call". The arrow is what turns it back into a real element with its own hooks.
 *
 * Declared at module scope so it is also a stable reference: an arrow written inline in the JSX is
 * a fresh function every render, which is what `react/no-unstable-nested-components` objects to.
 * This shape satisfies both — a real element AND one identity for the lifetime of the module.
 */
const renderTabBar = (props: BottomTabBarProps) => <BottomGroupNav {...props} />;

const Tab = createBottomTabNavigator<OwnerTabParamList>();

export function OwnerTabNavigator() {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const accentOpacity = theme.mode === 'dark' ? 0.12 : 0.05;

  // Two blur scoping targets — see BlurTargetContext for rationale.
  const gradientTarget = useRef<View>(null);
  const contentTarget = useRef<View>(null);

  return (
    // Outermost so it covers both the tab bar (rendered via the `tabBar` prop)
    // and <GroupSheetOverlay />, which sits outside the navigator. Scoped to the
    // owner portal rather than App.tsx: the request is business-scoped, and
    // firing it during login would hit businessApiClient's 401 → reset-to-Login.
    <TabConfigProvider>
      <BlurTargetProvider gradientTarget={gradientTarget} contentTarget={contentTarget}>
        <View style={styles.flex}>
          {/*
            One status bar for the whole portal. It used to be set only by DashboardScreen, so bar
            style leaked from whatever screen mounted last — and since every auth screen hardcodes
            'light-content', landing anywhere but the Dashboard in a light theme left white icons
            on a light background. Set here, it covers all 20 tabs.

            No `backgroundColor`: the app is permanently edge-to-edge at targetSdk 36, so Android
            forces the status bar transparent and the prop is a deprecated no-op.
          */}
          <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

          {/* Gradient backdrop — scoped so card BlurViews capture ONLY this. */}
          <BlurTargetView ref={gradientTarget} style={StyleSheet.absoluteFill}>
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <LinearGradient id="appPageVertical" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={theme.palette.pageEdge} stopOpacity={1} />
                  <Stop offset="50%" stopColor={theme.palette.background} stopOpacity={1} />
                  <Stop offset="100%" stopColor={theme.palette.pageEdge} stopOpacity={1} />
                </LinearGradient>
                <LinearGradient id="appPageAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity={accentOpacity} />
                  <Stop offset="50%" stopColor={theme.colors.primary} stopOpacity={0} />
                  <Stop
                    offset="100%"
                    stopColor={theme.colors.secondary}
                    stopOpacity={accentOpacity}
                  />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#appPageVertical)" />
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#appPageAccent)" />
            </Svg>
          </BlurTargetView>

          {/* Tab navigator content — scoped so sheet BlurViews can blur the
              dashboard when they open. Cards inside here reference
              gradientTarget for their own blur so their siblings don't leak. */}
          <BlurTargetView ref={contentTarget} style={styles.flex}>
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: 'transparent' },
              }}
              tabBar={renderTabBar}
            >
              {/* Every screen stays mounted regardless of tab config, matching the
                  web portal: the route resolves, then useTabGateRedirect bounces
                  you. Unmounting a focused screen would make React Navigation
                  re-derive the index and flash an arbitrary neighbour. */}
              <Tab.Screen name="Dashboard" component={DashboardScreen} />
              {/*
                The five tabs with a stack behind them. `listeners` resets to the list on every tab
                press: React Navigation restores a tab's nested state, so without this, leaving the
                tab while a detail is open and coming back later lands on that detail rather than
                on the list the user expects.
              */}
              <Tab.Screen
                name="Orders"
                component={OrdersNavigator}
                listeners={({ navigation }) => ({
                  tabPress: () => navigation.navigate('Orders', { screen: 'OrdersMain' }),
                })}
              />
              <Tab.Screen
                name="Appointments"
                component={AppointmentsNavigator}
                listeners={({ navigation }) => ({
                  tabPress: () =>
                    navigation.navigate('Appointments', { screen: 'AppointmentsMain' }),
                })}
              />
              <Tab.Screen
                name="Billing"
                component={BillingNavigator}
                listeners={({ navigation }) => ({
                  tabPress: () => navigation.navigate('Billing', { screen: 'BillingMain' }),
                })}
              />
              <Tab.Screen
                name="Products"
                component={CatalogNavigator}
                listeners={({ navigation }) => ({
                  tabPress: () => navigation.navigate('Products', { screen: 'ProductsMain' }),
                })}
              />
              <Tab.Screen
                name="Services"
                component={ServicesNavigator}
                listeners={({ navigation }) => ({
                  tabPress: () => navigation.navigate('Services', { screen: 'ServicesMain' }),
                })}
              />
              <Tab.Screen name="Packages" component={PackagesScreen} />
              <Tab.Screen name="Subscriptions" component={SubscriptionsScreen} />
              <Tab.Screen name="ServicePlans" component={ServicePlansScreen} />
              <Tab.Screen
                name="Inventory"
                component={InventoryNavigator}
                listeners={({ navigation }) => ({
                  tabPress: () => navigation.navigate('Inventory', { screen: 'InventoryMain' }),
                })}
              />
              <Tab.Screen name="Consumptions" component={ConsumptionsScreen} />
              <Tab.Screen name="StockTransfers" component={StockTransfersScreen} />
              <Tab.Screen name="Wastage" component={WastageScreen} />
              {/* No Expenses screen yet — the placeholder reads its title from the
                  route name, so this renders "Expenses / Coming soon". */}
              <Tab.Screen name="Expenses" component={PlaceholderScreen} />
              <Tab.Screen name="Customers" component={CustomersScreen} />
              <Tab.Screen name="Employees" component={EmployeesScreen} />
              <Tab.Screen name="WarrantyClaims" component={WarrantyClaimsScreen} />
              <Tab.Screen name="Loyalty" component={LoyaltyScreen} />
              <Tab.Screen name="Reports" component={ReportsScreen} />
              <Tab.Screen name="Account" component={AccountNavigator} />
            </Tab.Navigator>
          </BlurTargetView>

          {/* Overlays live outside BlurTargetView so their content isn't
              captured by sheet BlurViews. */}
          <GroupSheetOverlay />
          <BusinessSheetOverlay />
          <BiometricOnboardingModal />
          {/* Mounted here rather than in RootNavigator's bootstrap: that gates
              `isReady` behind a spinner, so an awaited check would become
              cold-start latency, and its blanket catch defaults to the Auth
              stack — a network hiccup mid-check would log the user out. Also
              mounted in CustomerTabNavigator; useAppUpdate dedupes to one
              automatic check per process. */}
          <UpdatePromptModal />
        </View>
      </BlurTargetProvider>
    </TabConfigProvider>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(_theme: AppTheme) {
  return StyleSheet.create({
    flex: { flex: 1 },
  });
}
