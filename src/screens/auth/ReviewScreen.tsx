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
import { getAuthService } from '../../backend/auth/provider/auth.provider';
import { setDmsFolderMap, DmsFolderMap } from '../../storage/dms.storage';
import { setCompleteProfileData, setUserProfile, setBusinessTypeMap } from '../../storage/session.storage';
import { setLoggedInUser } from '../../storage/auth.storage';
import { getBusinessTypeLabel } from '../../utils/businessTypes';
import { useSignupDraft } from '../../context/SignupDraftContext';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

// ─── Param List ──────────────────────────────────────────────────────────────

type AuthStackParamList = {
  Splash: undefined;
  Landing: undefined;
  Login: undefined;
  SignupEmail: { prefillEmail?: string } | undefined;
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Review'>;

// ─── Component ───────────────────────────────────────────────────────────────

const ReviewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { personal, businesses } = route.params;
  const { getDraft, clearDraft } = useSignupDraft();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const hasBusiness = businesses && businesses.length > 0;

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    const draft = getDraft();
    if (!draft) {
      setError('Session expired. Please go back and re-enter your credentials.');
      setLoading(false);
      return;
    }

    const authService = getAuthService();
    const folderService = new FolderService();
    const personService = getPersonService();

    let signupCompleted = false;
    let authUserId: number | null = null;
    let userRootFolderId: number | null = null;
    let personCreated = false;

    const rollback = async () => {
      console.log('[ReviewScreen] ROLLBACK — signupCompleted:', signupCompleted, '| authUserId:', authUserId, '| userRootFolderId:', userRootFolderId);
      if (userRootFolderId) {
        console.log('[ReviewScreen] ROLLBACK DELETE /folder/', userRootFolderId);
        await folderService.deleteFolder(userRootFolderId).catch((e) => console.warn('[ReviewScreen] ROLLBACK folder delete failed:', e?.message));
      }
      if (signupCompleted) {
        if (authUserId !== null) {
          console.log('[ReviewScreen] ROLLBACK DELETE /auth-user/', authUserId);
          await authService.deleteUser(authUserId).catch((e) => console.warn('[ReviewScreen] ROLLBACK auth delete failed:', e?.message));
        }
        await authService.logout();
        console.log('[ReviewScreen] ROLLBACK logout done');
      }
    };

    try {
      // ─── Step A: Create auth user ─────────────────────────────────
      const signupPayload = { username: personal.username, email: personal.email, password: '***', roles: ['CUSTOMER'] };
      console.log('[ReviewScreen] A1 POST /auth/signup → payload:', JSON.stringify(signupPayload));
      await authService.signup({
        username: personal.username,
        email: personal.email,
        password: draft.password,
        roles: ['CUSTOMER'],
      });
      signupCompleted = true;
      console.log('[ReviewScreen] A1 POST /auth/signup ✓ (tokens stored)');

      console.log(`[ReviewScreen] A2 GET /auth-user/username/${personal.username}`);
      const authUser = await authService.getUserByUsername(personal.username);
      authUserId = authUser.id;
      console.log('[ReviewScreen] A2 GET /auth-user/username → response:', JSON.stringify(authUser));

      // ─── Step B: Create DMS folders ───────────────────────────────
      const rootFolderName = `${personal.username}_${uuidv4()}`;
      const rootFolderPayload = { folderName: rootFolderName };
      console.log('[ReviewScreen] B1 POST /folder/create → payload:', JSON.stringify(rootFolderPayload));
      const userFolder = await folderService.createFolder(rootFolderPayload);
      userRootFolderId = userFolder.folderId!;
      console.log('[ReviewScreen] B1 POST /folder/create ✓ → response:', JSON.stringify(userFolder));

      console.log('[ReviewScreen] B2 createRoleFolders → parentFolderId:', userRootFolderId);
      const roleFolders = await createRoleFolders(userRootFolderId);
      console.log('[ReviewScreen] B2 createRoleFolders ✓ → response:', JSON.stringify(roleFolders));

      const businessFolderResults: BusinessFolderResult[] = [];
      if (hasBusiness) {
        for (const biz of businesses) {
          console.log(`[ReviewScreen] B3 createBusinessDmsFolders → bizName: ${biz.businessName}, parentFolderId:`, roleFolders.Business);
          const result = await createBusinessDmsFolders(null, biz.businessName, roleFolders.Business);
          businessFolderResults.push(result);
          console.log(`[ReviewScreen] B3 createBusinessDmsFolders ✓ → response:`, JSON.stringify(result));
        }
      }

      // ─── Step C: Create person ────────────────────────────────────
      const personPayload = {
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
              registration: { cin: biz.cin || null, gstin: biz.gstin || null, pan: biz.pan || null },
              folderId: businessFolderResults[idx]?.folderId ?? null,
              businessRoles: [],
              isActive: true,
            }))
          : [],
      };
      console.log('[ReviewScreen] C1 POST /persons → payload:', JSON.stringify(personPayload));
      const result = await personService.createPerson({
        ...personPayload,
        businesses: hasBusiness
          ? businesses.map((biz: any, idx: number) => ({
              businessName: biz.businessName,
              businessType: biz.businessType,
              businessPhone: biz.businessPhone || null,
              businessEmail: biz.businessEmail || null,
              registration: {
                cin: biz.cin || null,
                gstin: biz.gstin || null,
                pan: biz.pan || null,
              },
              folderId: businessFolderResults[idx]?.folderId ?? null,
              businessRoles: [],
              isActive: true,
            }))
          : [],
      });
      console.log('[ReviewScreen] C1 POST /persons → response:', JSON.stringify(result));

      if (!result.success || !result.data) {
        console.log('[ReviewScreen] C1 POST /persons FAILED — rolling back');
        await rollback();
        setError(result.error || 'Something went wrong. Please try again.');
        return;
      }
      personCreated = true;
      console.log('[ReviewScreen] C1 POST /persons ✓');

      // ─── Step D: Store everything ─────────────────────────────────
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

      clearDraft();
      navigation.reset({
        index: 0,
        routes: [{ name: 'PortalSelection' }],
      });
    } catch (err: any) {
      console.log('[ReviewScreen] CATCH error:', err?.message, '| personCreated:', personCreated);
      if (!personCreated) {
        await rollback();
      }
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
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Creating your account...</Text>
            <Text style={styles.loadingSubtext}>
              Registering credentials, setting up folders, and saving your profile
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
            {biz.cin ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CIN</Text>
                <Text style={styles.infoValue}>{biz.cin}</Text>
              </View>
            ) : null}
            {biz.gstin ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>GSTIN</Text>
                <Text style={styles.infoValue}>{biz.gstin}</Text>
              </View>
            ) : null}
            {biz.pan ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>PAN</Text>
                <Text style={styles.infoValue}>{biz.pan}</Text>
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.palette.background,
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
      color: theme.palette.onBackground,
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 15,
      color: theme.palette.muted,
      marginBottom: 28,
      lineHeight: 22,
    },

    // Error
    errorContainer: {
      backgroundColor: theme.palette.error + '20',
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.palette.error + '40',
    },
    errorText: {
      fontFamily: 'Inter-Medium',
      fontSize: 13,
      color: theme.palette.error + 'CC',
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
      borderBottomColor: theme.palette.divider,
    },
    cardTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 16,
      color: theme.palette.onBackground,
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
      color: theme.palette.muted,
      flex: 1,
    },
    infoValue: {
      fontFamily: 'Inter-Medium',
      fontSize: 14,
      color: theme.palette.onBackground,
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
      backgroundColor: theme.palette.background + 'EB',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
    loadingCard: {
      backgroundColor: theme.palette.surface,
      borderRadius: 20,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
      marginHorizontal: 32,
    },
    loadingText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 16,
      color: theme.palette.onBackground,
      marginTop: 20,
      textAlign: 'center',
    },
    loadingSubtext: {
      fontFamily: 'Inter-Regular',
      fontSize: 13,
      color: theme.palette.muted,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}

export default ReviewScreen;
