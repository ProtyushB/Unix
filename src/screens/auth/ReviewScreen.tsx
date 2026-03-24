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
import AppButton from '../../components/common/AppButton';
import AppCard from '../../components/common/AppCard';
import { FolderService } from '../../backend/dms/service/folder.service';
import { createRoleFolders, createBusinessDmsFolders, BusinessFolderResult } from '../../backend/dms/util/BusinessFolderUtils';
import { getPersonService } from '../../backend/person/provider/person.provider';
import { setDmsFolderMap, DmsFolderMap } from '../../storage/dms.storage';
import { setCompleteProfileData, setUserProfile, setBusinessTypeMap } from '../../storage/session.storage';
import { setLoggedInUser } from '../../storage/auth.storage';
import { getBusinessTypeLabel } from '../../utils/businessTypes';
import { v4 as uuidv4 } from 'uuid';

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

type Props = NativeStackScreenProps<AuthStackParamList, 'Review'>;

// ─── Component ───────────────────────────────────────────────────────────────

const ReviewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { personal, businesses } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasBusiness = businesses && businesses.length > 0;

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const folderService = new FolderService();
      const personService = getPersonService();

      // ─── Step 1: Create user root folder ─────────────────────────────
      const userFolder = await folderService.createFolder({
        folderName: `${personal.username}_${uuidv4()}`,
      });
      const userRootFolderId = userFolder.folderId!;

      // ─── Step 2: Create role folders ─────────────────────────────────
      const roleFolders = await createRoleFolders(userRootFolderId);

      // ─── Step 3: Create per-business folders ─────────────────────────
      const businessFolderResults: BusinessFolderResult[] = [];
      if (hasBusiness) {
        for (const biz of businesses) {
          const result = await createBusinessDmsFolders(null, biz.businessName, roleFolders.Business);
          businessFolderResults.push(result);
        }
      }

      // ─── Step 4: Create person via PersonService ──────────────────────
      const result = await personService.createPerson({
        firstName: personal.firstName,
        lastName: personal.lastName,
        userName: personal.username,
        email: personal.email,
        phoneNumber: personal.phoneNumber,
        personFolderId: userRootFolderId,
        businesses: hasBusiness
          ? businesses.map((biz: any, idx: number) => ({
              businessName: biz.businessName,
              businessType: biz.businessType,
              businessPhone: biz.businessPhone || null,
              businessEmail: biz.businessEmail || null,
              registrationNumber: biz.registrationNumber || null,
              folderId: businessFolderResults[idx]?.folderId ?? null,
              businessRoles: [],
              isActive: true,
            }))
          : [],
      });

      if (!result.success || !result.data) {
        setError(result.error || 'Something went wrong. Please try again.');
        return;
      }

      // ─── Step 5: Store everything ─────────────────────────────────────
      const registeredUser = result.data;

      await setLoggedInUser({
        id: registeredUser.id || 0,
        username: personal.username,
        roles: registeredUser.types || [],
        email: personal.email,
      });

      await setUserProfile(registeredUser);

      await setCompleteProfileData({
        person: registeredUser,
        businesses: registeredUser.business || businesses,
      });

      if (hasBusiness && registeredUser.business && registeredUser.business.length > 0) {
        const typeMap: Record<string, any[]> = {};
        (registeredUser.business as any[]).forEach((biz: any) => {
          const type = biz.businessType || 'CUSTOM';
          if (!typeMap[type]) typeMap[type] = [];
          typeMap[type].push(biz);
        });
        await setBusinessTypeMap(typeMap);
      }

      const dmsFolderMapData: DmsFolderMap = {
        userRootFolderId,
        roleFolders: {
          Business: roleFolders.Business,
          Customer: roleFolders.Customer,
          Employee: roleFolders.Employee,
        },
        businesses: {},
      };
      if (hasBusiness && registeredUser.business) {
        (registeredUser.business as any[]).forEach((biz: any, idx: number) => {
          const bizId = biz.id || idx;
          if (businessFolderResults[idx]) {
            dmsFolderMapData.businesses[bizId] = businessFolderResults[idx];
          }
        });
      }
      await setDmsFolderMap(dmsFolderMapData);

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

      <ScrollView removeClippedSubviews={false}
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
            <Text style={{ fontSize: 18 }}>👤</Text>
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
              <Text style={{ fontSize: 18 }}>💼</Text>
              <Text style={styles.cardTitle}>
                Business {businesses.length > 1 ? `#${index + 1}` : 'Information'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{biz.businessName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>
                {getBusinessTypeLabel(biz.businessType)}
              </Text>
            </View>
            {biz.businessPhone ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{biz.businessPhone}</Text>
              </View>
            ) : null}
            {biz.businessEmail ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{biz.businessEmail}</Text>
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
