import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Animated,
  InteractionManager,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getLoggedInUser, LoggedInUser } from '../../storage/auth.storage';
import { getUserProfile, setUserProfile, setBusinessTypeMap } from '../../storage/session.storage';

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

type Props = NativeStackScreenProps<AuthStackParamList, 'PortalSelection'>;

// ─── Component ───────────────────────────────────────────────────────────────

const PortalSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [userProfile, setLocalUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const autoNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBusinessOwner = user?.roles?.includes('BUSINESS_OWNER') ?? false;
  const isCustomer = user?.roles?.includes('CUSTOMER') ?? true;
  const hasOnlyOneRole = (isBusinessOwner ? 1 : 0) + (isCustomer ? 1 : 0) === 1;

  useEffect(() => {
    const loadUser = async () => {
      try {
        const loggedIn = await getLoggedInUser();
        const profile = await getUserProfile();
        setUser(loggedIn);
        setLocalUserProfile(profile);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Animate in after data loads
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-navigate if only one role
      if (hasOnlyOneRole && user) {
        autoNavRef.current = setTimeout(() => {
          if (isBusinessOwner) {
            navigateToOwner();
          } else {
            navigateToCustomer();
          }
        }, 1500);
      }
    }

    return () => {
      if (autoNavRef.current) {
        clearTimeout(autoNavRef.current);
      }
    };
  }, [loading, hasOnlyOneRole, user]);

  const navigateToOwner = () => {
    console.log('[PORTAL] navigateToOwner called');
    if (autoNavRef.current) {
      clearTimeout(autoNavRef.current);
    }
    const parent = navigation.getParent();
    console.log('[PORTAL] parent navigator:', parent ? 'found' : 'null - using self');
    console.log('[PORTAL] calling reset to OwnerTabs...');
    (parent ?? navigation).reset({
      index: 0,
      routes: [{ name: 'OwnerTabs' as any }],
    });
    console.log('[PORTAL] reset to OwnerTabs done');
  };

  const navigateToCustomer = () => {
    console.log('[PORTAL] navigateToCustomer called');
    if (autoNavRef.current) {
      clearTimeout(autoNavRef.current);
    }
    const parent = navigation.getParent();
    console.log('[PORTAL] parent navigator:', parent ? 'found' : 'null - using self');
    console.log('[PORTAL] calling reset to CustomerTabs...');
    (parent ?? navigation).reset({
      index: 0,
      routes: [{ name: 'CustomerTabs' as any }],
    });
    console.log('[PORTAL] reset to CustomerTabs done');
  };

  const firstName = user?.username
    ? userProfile?.firstName || user.username
    : 'User';

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView removeClippedSubviews={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Success Icon */}
          <View style={styles.successIconContainer}>
            <Text style={styles.successIconText}>✓</Text>
          </View>

          {/* Welcome */}
          <Text style={styles.welcomeTitle}>Welcome!</Text>
          <Text style={styles.welcomeName}>{firstName}</Text>

          {/* Success Card */}
          <View style={styles.successCard}>
            <Text style={styles.successText}>
              Your account is ready. Choose how you'd like to continue.
            </Text>
          </View>

          {/* Portal Cards */}
          <View style={styles.portalSection}>
            {isBusinessOwner && (
              <TouchableOpacity
                style={styles.portalCard}
                onPress={navigateToOwner}
                activeOpacity={0.7}
              >
                <View style={styles.portalIconContainer}>
                  <Text style={styles.portalIconText}>🏢</Text>
                </View>
                <View style={styles.portalCardContent}>
                  <Text style={styles.portalCardTitle}>Owner Portal</Text>
                  <Text style={styles.portalCardDescription}>
                    Manage your business, catalog, orders, and analytics
                  </Text>
                </View>
                <View style={styles.portalArrow}>
                  <Text style={styles.portalArrowText}>{'>'}</Text>
                </View>
              </TouchableOpacity>
            )}

            {isCustomer && (
              <TouchableOpacity
                style={styles.portalCard}
                onPress={navigateToCustomer}
                activeOpacity={0.7}
              >
                <View style={[styles.portalIconContainer, styles.portalIconCustomer]}>
                  <Text style={styles.portalIconText}>🛍</Text>
                </View>
                <View style={styles.portalCardContent}>
                  <Text style={styles.portalCardTitle}>Customer Portal</Text>
                  <Text style={styles.portalCardDescription}>
                    Explore businesses, book services, and track orders
                  </Text>
                </View>
                <View style={styles.portalArrow}>
                  <Text style={styles.portalArrowText}>{'>'}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Auto-navigate hint */}
          {hasOnlyOneRole && (
            <Text style={styles.autoNavHint}>
              Redirecting automatically...
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#94a3b8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
  },

  // Success icon
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconText: {
    fontSize: 56,
    color: '#22c55e',
  },
  portalIconText: {
    fontSize: 28,
  },

  // Welcome
  welcomeTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 4,
  },
  welcomeName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    color: '#f97316',
    textAlign: 'center',
    marginBottom: 24,
  },

  // Success card
  successCard: {
    backgroundColor: '#22c55e15',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#22c55e30',
  },
  successText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#86efac',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Portal section
  portalSection: {
    gap: 16,
  },
  portalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  portalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#f9731615',
    justifyContent: 'center',
    alignItems: 'center',
  },
  portalIconCustomer: {
    backgroundColor: '#0ea5e915',
  },
  portalCardContent: {
    flex: 1,
    marginLeft: 16,
  },
  portalCardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 17,
    color: '#f8fafc',
    marginBottom: 4,
  },
  portalCardDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
  },
  portalArrow: {
    marginLeft: 8,
  },
  portalArrowText: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#64748b',
  },

  // Auto-nav hint
  autoNavHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
  },
});

export default PortalSelectionScreen;
