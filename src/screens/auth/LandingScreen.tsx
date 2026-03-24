import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppButton from '../../components/common/AppButton';

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

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: '📊', title: 'Billing', description: 'Generate invoices & track payments' },
  { icon: '📈', title: 'Analytics', description: 'Real-time business insights' },
  { icon: '📍', title: 'Multi-Location', description: 'Manage multiple branches' },
  { icon: '🔐', title: 'Unified Identity', description: 'One account, all services' },
];

const MODULES = [
  { icon: '✂️', title: 'Parlour & Spa', color: '#f59e0b' },
  { icon: '🍽️', title: 'Restaurant', color: '#ef4444' },
  { icon: '🏋️', title: 'Gym', color: '#10b981' },
  { icon: '👗', title: 'Fashion', color: '#8b5cf6' },
  { icon: '🛍️', title: 'Retail', color: '#0ea5e9' },
  { icon: '···', title: 'More', color: '#64748b' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Component ───────────────────────────────────────────────────────────────

const LandingScreen: React.FC<Props> = ({ navigation }) => {
  const renderModuleCard = ({ item }: { item: typeof MODULES[number] }) => {
    return (
      <View style={styles.moduleCard}>
        <View style={[styles.moduleIconContainer, { backgroundColor: `${item.color}20` }]}>
          <Text style={[styles.moduleIcon, { color: item.color }]}>{item.icon}</Text>
        </View>
        <Text style={styles.moduleTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView removeClippedSubviews={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>Module</Text>
            <Text style={styles.logoAccent}>X</Text>
          </View>
          <Text style={styles.tagline}>
            All-in-one business management platform
          </Text>
        </View>

        {/* CTA Buttons */}
        <View style={styles.ctaSection}>
          <AppButton
            title="Get Started"
            onPress={() => navigation.navigate('SignupEmail')}
            variant="primary"
          />
          <View style={styles.ctaSpacer} />
          <AppButton
            title="Sign In"
            onPress={() => navigation.navigate('Login')}
            variant="ghost"
          />
        </View>

        {/* Feature Highlights */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Why Unix?</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((feature, index) => (
                <View key={index} style={styles.featureCard}>
                  <View style={styles.featureIconContainer}>
                    <Text style={styles.featureIcon}>{feature.icon}</Text>
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              ))}
          </View>
        </View>

        {/* Module Showcase */}
        <View style={styles.modulesSection}>
          <Text style={styles.sectionTitle}>Modules</Text>
          <FlatList
            data={MODULES}
            renderItem={renderModuleCard}
            keyExtractor={(item) => item.title}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modulesListContent}
            snapToInterval={108}
            decelerationRate="fast"
            removeClippedSubviews={false}
          />
        </View>

        <View style={styles.bottomSpacer} />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 32,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 42,
    color: '#f8fafc',
    letterSpacing: -1,
  },
  logoAccent: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 42,
    color: '#f97316',
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },

  // CTA
  ctaSection: {
    marginTop: 8,
    marginBottom: 40,
  },
  ctaSpacer: {
    height: 12,
  },

  // Features
  featuresSection: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#f8fafc',
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  featureCard: {
    width: (SCREEN_WIDTH - 48 - 12) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f9731615',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#f8fafc',
    marginBottom: 4,
  },
  featureDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },

  // Modules
  modulesSection: {
    marginBottom: 24,
  },
  modulesListContent: {
    paddingRight: 24,
  },
  moduleCard: {
    width: 96,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  moduleIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  moduleTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#f8fafc',
    textAlign: 'center',
    lineHeight: 16,
  },
  moduleIcon: {
    fontSize: 26,
  },
  featureIcon: {
    fontSize: 20,
  },

  bottomSpacer: {
    height: 40,
  },
});

export default LandingScreen;
