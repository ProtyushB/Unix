import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/auth/SplashScreen';
import LandingScreen from '../screens/auth/LandingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupEmailScreen from '../screens/auth/SignupEmailScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import SignupCredentialsScreen from '../screens/auth/SignupCredentialsScreen';
import ProfilePersonalScreen from '../screens/auth/ProfilePersonalScreen';
import ProfileBusinessScreen from '../screens/auth/ProfileBusinessScreen';
import ReviewScreen from '../screens/auth/ReviewScreen';
import PortalSelectionScreen from '../screens/auth/PortalSelectionScreen';
import ForgotPasswordEmailScreen from '../screens/auth/ForgotPasswordEmailScreen';
import ForgotPasswordOtpScreen from '../screens/auth/ForgotPasswordOtpScreen';
import ForgotPasswordNewScreen from '../screens/auth/ForgotPasswordNewScreen';
import { SignupDraftProvider } from '../context/SignupDraftContext';

// ─── Param List ─────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  SignupEmail: undefined;
  OtpVerification: { email: string };
  SignupCredentials: { email: string };
  ProfilePersonal: { email: string; username: string };
  ProfileBusiness: { email: string; username: string; firstName: string; lastName: string; phoneNumber: string };
  Review: { personal: any; businesses: any[] };
  PortalSelection: undefined;
  ForgotPasswordEmail: undefined;
  ForgotPasswordOtp: { email: string };
  ForgotPasswordNew: { email: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// ─── Navigator ──────────────────────────────────────────────────────────────

export function AuthNavigator() {
  return (
    <SignupDraftProvider>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignupEmail" component={SignupEmailScreen} />
        <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
        <Stack.Screen name="SignupCredentials" component={SignupCredentialsScreen} />
        <Stack.Screen name="ProfilePersonal" component={ProfilePersonalScreen} />
        <Stack.Screen name="ProfileBusiness" component={ProfileBusinessScreen} />
        <Stack.Screen name="Review" component={ReviewScreen} />
        <Stack.Screen name="PortalSelection" component={PortalSelectionScreen} />
        <Stack.Screen name="ForgotPasswordEmail" component={ForgotPasswordEmailScreen} />
        <Stack.Screen name="ForgotPasswordOtp" component={ForgotPasswordOtpScreen} />
        <Stack.Screen name="ForgotPasswordNew" component={ForgotPasswordNewScreen} />
      </Stack.Navigator>
    </SignupDraftProvider>
  );
}
