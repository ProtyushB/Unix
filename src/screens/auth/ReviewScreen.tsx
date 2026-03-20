import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle, Briefcase, User } from 'lucide-react-native';
import AppButton from '../../components/common/AppButton';
import AppCard from '../../components/common/AppCard';
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { setDmsFolderMap, DmsFolderMap } from '../../storage/dms.storage';
import { setCompleteProfileData, setUserProfile, setBusinessTypeMap } from '../../storage/session.storage';
import { setLoggedInUser, getAccessToken } from '../../storage/auth.storage';
import { getBusinessTypeLabel } from '../../utils/businessTypes';
import authApiClient from '../../backend/auth/config/axios.instance';

// ─── Param List ──────────────────────────────────────────────────────────────

type AuthStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  SignupEmail: undefined;
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Review'>;

// ─── DMS Folder Categories ──────────────────────────────────────────────────

const DMS_CATEGORIES = ['Products', 'Services', 'Orders', 'Appointments', 'Bills'];
const ROLE_FOLDERS = ['Business', 'Customer', 'Employee'];

// ─── Component ───────────────────────────────────────────────────────────────

const ReviewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { personal, businesses } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasBusiness = businesses && businesses.length > 0;
  const roles = ['CUSTOMER', ...(hasBusiness ? ['BUSINESS_OWNER'] : [])];

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // ─── Step 1: DMS Folder Creation ─────────────────────────────────
      // Create user root folder
      const userRootRes = await authApiClient.post(
        '/folder/create',
        {
          name: personal.username,
          parentFolderId: null,
          description: `Root folder for ${personal.username}`,
        },
        { headers },
      );
      const userRootFolderId = userRootRes.data?.data?.id;

      // Create role folders under root
      const roleFolderPayloads = ROLE_FOLDERS.map(role => ({
        name: role,
        parentFolderId: userRootFolderId,
        description: `${role} folder`,
      }));
      const roleFoldersRes = await authApiClient.post(
        '/folder/create-multiple',
        roleFolderPayloads,
        { headers },
      );
      const roleFoldersData = roleFoldersRes.data?.data || [];
      const roleFolders: Record<string, number> = {};
      roleFoldersData.forEach((folder: any) => {
        roleFolders[folder.name] = folder.id;
      });

      // Create per-business branch and category folders
      const businessFolders: Record<number, any> = {};
      const businessFolderParentId = roleFolders['Business'];

      if (hasBusiness && businessFolderParentId) {
        for (let i = 0; i < businesses.length; i++) {
          const biz = businesses[i];

          // Create business branch folder
          const bizFolderRes = await authApiClient.post(
            '/folder/create',
            {
              name: biz.name,
              parentFolderId: businessFolderParentId,
              description: `${biz.name} (${biz.businessType})`,
            },
            { headers },
          );
          const bizFolderId = bizFolderRes.data?.data?.id;

          // Create category folders under business
          const categoryPayloads = DMS_CATEGORIES.map(cat => ({
            name: cat,
            parentFolderId: bizFolderId,
            description: `${cat} for ${biz.name}`,
          }));
          const catFoldersRes = await authApiClient.post(
            '/folder/create-multiple',
            categoryPayloads,
            { headers },
          );
          const catFoldersData = catFoldersRes.data?.data || [];

          const catMap: Record<string, number> = {};
          catFoldersData.forEach((folder: any) => {
            catMap[folder.name] = folder.id;
          });

          businessFolders[i] = {
            folderId: bizFolderId,
            productsFolderId: catMap['Products'] || 0,
            servicesFolderId: catMap['Services'] || 0,
            ordersFolderId: catMap['Orders'] || 0,
            appointmentsFolderId: catMap['Appointments'] || 0,
            billsFolderId: catMap['Bills'] || 0,
          };
        }
      }

      // Store DMS folder map
      const dmsFolderMapData: DmsFolderMap = {
        userRootFolderId,
        roleFolders: {
          Business: roleFolders['Business'] || 0,
          Customer: roleFolders['Customer'] || 0,
          Employee: roleFolders['Employee'] || 0,
        },
        businesses: businessFolders,
      };
      await setDmsFolderMap(dmsFolderMapData);

      // ─── Step 2: Create Person with Business ─────────────────────────
      const personPayload = {
        firstName: personal.firstName,
        lastName: personal.lastName,
        email: personal.email,
        username: personal.username,
        phoneNumber: personal.phoneNumber,
        roles,
        businesses: hasBusiness
          ? businesses.map((biz: any, idx: number) => ({
              name: biz.name,
              businessType: biz.businessType,
              phone: biz.phone || null,
              email: biz.email || null,
              registrationNumber: biz.registrationNumber || null,
              dmsFolderId: businessFolders[idx]?.folderId || null,
            }))
          : [],
      };

      const personRes = await authApiClient.post(
        `/persons?hasBusiness=${hasBusiness}`,
        personPayload,
        { headers },
      );
      const registeredUser = personRes.data?.data;

      // ─── Step 3: Store Everything ────────────────────────────────────
      if (registeredUser) {
        // Store logged-in user
        await setLoggedInUser({
          id: registeredUser.id || registeredUser.userId,
          username: personal.username,
          roles,
          email: personal.email,
        });

        // Store user profile
        await setUserProfile(registeredUser);

        // Store complete profile data
        await setCompleteProfileData({
          person: registeredUser,
          businesses: registeredUser.businesses || businesses,
        });

        // Build and store business type map
        if (hasBusiness && registeredUser.businesses) {
          const typeMap: Record<string, any[]> = {};
          registeredUser.businesses.forEach((biz: any) => {
            const type = biz.businessType || 'CUSTOM';
            if (!typeMap[type]) {
              typeMap[type] = [];
            }
            typeMap[type].push(biz);
          });
          await setBusinessTypeMap(typeMap);
        }
      }

      // Navigate to portal selection
      navigation.reset({
        index: 0,
        routes: [{ name: 'PortalSelection' }],
      });
    } catch (err: any) {
      const message = err?.response?.data?.error
        || err?.response?.data?.message
        || err?.message
        || 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Setting up your account...</Text>
            <Text style={styles.loadingSubtext}>
              Creating folders and registering your profile
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.title}>Review Your Information</Text>
        <Text style={styles.subtitle}>
          Make sure everything looks correct before submitting
        </Text>

        {/* Error Banner */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Personal Info Card */}
        <AppCard style={styles.card}>
          <View style={styles.cardHeader}>
            <User size={20} color="#f97316" strokeWidth={1.8} />
            <Text style={styles.cardTitle}>Personal Information</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>First Name</Text>
            <Text style={styles.infoValue}>{personal.firstName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Name</Text>
            <Text style={styles.infoValue}>{personal.lastName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username</Text>
            <Text style={styles.infoValue}>{personal.username}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{personal.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{personal.phoneNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Password</Text>
            <Text style={styles.infoValue}>{'*'.repeat(8)}</Text>
          </View>
        </AppCard>

        {/* Business Info Card(s) */}
        {hasBusiness && businesses.map((biz: any, index: number) => (
          <AppCard key={index} style={styles.card}>
            <View style={styles.cardHeader}>
              <Briefcase size={20} color="#f97316" strokeWidth={1.8} />
              <Text style={styles.cardTitle}>
                Business {businesses.length > 1 ? `#${index + 1}` : 'Information'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{biz.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>
                {getBusinessTypeLabel(biz.businessType)}
              </Text>
            </View>
            {biz.phone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{biz.phone}</Text>
              </View>
            ) : null}
            {biz.email ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{biz.email}</Text>
              </View>
            ) : null}
            {biz.registrationNumber ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reg. Number</Text>
                <Text style={styles.infoValue}>{biz.registrationNumber}</Text>
              </View>
            ) : null}
          </AppCard>
        ))}

        {/* Roles Preview */}
        <AppCard style={styles.card}>
          <View style={styles.cardHeader}>
            <CheckCircle size={20} color="#f97316" strokeWidth={1.8} />
            <Text style={styles.cardTitle}>Assigned Roles</Text>
          </View>
          <View style={styles.rolesRow}>
            {roles.map(role => (
              <View key={role} style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{role}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <AppButton
            title="Save & Continue"
            onPress={handleSubmit}
            variant="primary"
            loading={loading}
            disabled={loading}
          />
          <View style={styles.buttonSpacer} />
          <AppButton
            title="Go Back"
            onPress={() => navigation.goBack()}
            variant="ghost"
            disabled={loading}
          />
        </View>
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
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Title
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 28,
    lineHeight: 22,
  },

  // Error
  errorContainer: {
    backgroundColor: '#ef444420',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  errorText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#fca5a5',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Card
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#f8fafc',
    marginLeft: 10,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#94a3b8',
    flex: 1,
  },
  infoValue: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#f8fafc',
    flex: 2,
    textAlign: 'right',
  },

  // Roles
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f9731620',
    borderWidth: 1,
    borderColor: '#f9731640',
  },
  roleBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#f97316',
    letterSpacing: 0.5,
  },

  // Buttons
  buttonContainer: {
    marginTop: 24,
  },
  buttonSpacer: {
    height: 12,
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginHorizontal: 32,
  },
  loadingText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#f8fafc',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ReviewScreen;
