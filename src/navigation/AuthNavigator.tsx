import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/auth/SplashScreen';
import LandingScreen from '../screens/auth/LandingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ProfilePersonalScreen from '../screens/auth/ProfilePersonalScreen';
import ProfileBusinessScreen from '../screens/auth/ProfileBusinessScreen';
import ReviewScreen from '../screens/auth/ReviewScreen';
import PaymentScreen from '../screens/auth/PaymentScreen';
import PortalSelectionScreen from '../screens/auth/PortalSelectionScreen';
import ForgotPasswordEmailScreen from '../screens/auth/ForgotPasswordEmailScreen';
import ForgotPasswordOtpScreen from '../screens/auth/ForgotPasswordOtpScreen';
import ForgotPasswordNewScreen from '../screens/auth/ForgotPasswordNewScreen';
import ForgotUsernameEmailScreen from '../screens/auth/ForgotUsernameEmailScreen';
import ForgotUsernameSentScreen from '../screens/auth/ForgotUsernameSentScreen';
import { SignupDraftProvider } from '../context/SignupDraftContext';

// ─── Param List ─────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  /**
   * Mockups 02–04 — the whole credential step on one screen, with the OTP as a
   * sheet rather than a route. `claim` enters it in claim mode (mockup 10).
   */
  Signup: { prefillEmail?: string; claim?: boolean } | undefined;
  ProfilePersonal: { email: string; username: string };
  ProfileBusiness: { email: string; username: string; firstName: string; lastName: string; phoneNumber: string };
  Review: { personal: any; businesses: any[] };
  /** Business signups only — the account is created here, not on Review. */
  Payment: { personal: any; businesses: any[] };
  PortalSelection: undefined;
  ForgotPasswordEmail: undefined;
  ForgotPasswordOtp: { email: string };
  ForgotPasswordNew: { email: string };
  ForgotUsernameEmail: undefined;
  ForgotUsernameSent: { email: string };
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
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ProfilePersonal" component={ProfilePersonalScreen} />
        <Stack.Screen name="ProfileBusiness" component={ProfileBusinessScreen} />
        <Stack.Screen name="Review" component={ReviewScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="PortalSelection" component={PortalSelectionScreen} />
        <Stack.Screen name="ForgotPasswordEmail" component={ForgotPasswordEmailScreen} />
        <Stack.Screen name="ForgotPasswordOtp" component={ForgotPasswordOtpScreen} />
        <Stack.Screen name="ForgotPasswordNew" component={ForgotPasswordNewScreen} />
        <Stack.Screen name="ForgotUsernameEmail" component={ForgotUsernameEmailScreen} />
        <Stack.Screen name="ForgotUsernameSent" component={ForgotUsernameSentScreen} />
      </Stack.Navigator>
    </SignupDraftProvider>
  );
}
