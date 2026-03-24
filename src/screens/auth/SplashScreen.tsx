import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getAccessToken } from '../../storage/auth.storage';

// ─── Param List ──────────────────────────────────────────────────────────────

type AuthStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  SignupEmail: { prefillEmail?: string } | undefined;
  OtpVerification: { email: string };
  SignupCredentials: { email: string };
  ProfilePersonal: { email: string; username: string; password: string };
  ProfileBusiness: { email: string; username: string; password: string; firstName: string; lastName: string; phoneNumber: string };
  Review: { personal: any; businesses: any[] };
  PortalSelection: undefined;
  ForgotPasswordEmail: undefined;
  ForgotPasswordOtp: { email: string };
  ForgotPasswordNew: { email: string };
};

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

// ─── Component ───────────────────────────────────────────────────────────────

const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Start fade-in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Check auth status after animation
    const checkAuth = async () => {
      try {
        const token = await getAccessToken();
        // Wait for animation to finish before navigating
        setTimeout(
          () => {
            if (token) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'PortalSelection' }],
              });
            } else {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Landing' }],
              });
            }
          },
          2000,
        );
      } catch {
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Landing' }],
          });
        }, 2000);
      }
    };

    checkAuth();
  }, [fadeAnim, scaleAnim, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.logoText}>Module</Text>
        <Text style={styles.logoAccent}>X</Text>
      </Animated.View>
      <Animated.Text style={[styles.tagline, { opacity: fadeAnim }]}>
        Business Management Platform
      </Animated.Text>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 48,
    color: '#f8fafc',
    letterSpacing: -1,
  },
  logoAccent: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 48,
    color: '#f97316',
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
    letterSpacing: 0.5,
  },
});

export default SplashScreen;
