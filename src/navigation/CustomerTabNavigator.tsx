import React from 'react';
import {StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Text} from 'react-native';
import {darkPalette, themes} from '../theme/colors';
import type {CustomerTabParamList, ProfileStackParamList} from './types';
import {ExploreScreen} from '../screens/customer/ExploreScreen';
import {BookingsScreen} from '../screens/customer/BookingsScreen';
import {CustomerOrdersScreen as OrdersScreen} from '../screens/customer/CustomerOrdersScreen';
import {BillsScreen} from '../screens/customer/BillsScreen';
import {CustomerProfileScreen} from '../screens/customer/CustomerProfileScreen';
import {SecurityScreen} from '../screens/shared/SecurityScreen';
import {AuthMethodsScreen} from '../screens/shared/AuthMethodsScreen';
import {BiometricOnboardingModal} from '../components/common/BiometricOnboardingModal';

// ─── Profile Stack ───────────────────────────────────────────────────────────

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{headerShown: false}}>
      <ProfileStack.Screen name="ProfileMain" component={CustomerProfileScreen} />
      <ProfileStack.Screen name="Security" component={SecurityScreen} />
      <ProfileStack.Screen name="AuthMethods" component={AuthMethodsScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Tab Navigator ───────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<CustomerTabParamList>();

export function CustomerTabNavigator() {
  return (
    <View style={{flex: 1}}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: themes.default.primary,
          tabBarInactiveTintColor: darkPalette.muted,
          tabBarLabelStyle: styles.tabLabel,
        }}>
        <Tab.Screen
          name="Explore"
          component={ExploreScreen}
          options={{tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>🧭</Text>}}
        />
        <Tab.Screen
          name="Bookings"
          component={BookingsScreen}
          options={{tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>📅</Text>}}
        />
        <Tab.Screen
          name="Orders"
          component={OrdersScreen}
          options={{tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>🛍</Text>}}
        />
        <Tab.Screen
          name="Bills"
          component={BillsScreen}
          options={{tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>🧾</Text>}}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileNavigator}
          options={{tabBarIcon: ({color}) => <Text style={{color, fontSize: 20}}>👤</Text>}}
        />
      </Tab.Navigator>
      <BiometricOnboardingModal />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
