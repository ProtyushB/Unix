import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {AppInput} from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import SelectField from '../../components/forms/SelectField';
import StepProgress from '../../components/common/StepProgress';
import { validatePhone, validateEmail } from '../../utils/validators';
import { BUSINESS_TYPES } from '../../utils/businessTypes';

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

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileBusiness'>;

// ─── Business Form Type ─────────────────────────────────────────────────────

interface BusinessForm {
  id: string;
  businessName: string;
  businessType: string;
  businessPhone: string;
  businessEmail: string;
  gstin: string;
  cin: string;
  pan: string;
}

const createEmptyBusiness = (): BusinessForm => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  businessName: '',
  businessType: '',
  businessPhone: '',
  businessEmail: '',
  gstin: '',
  cin: '',
  pan: '',
});

// ─── Component ───────────────────────────────────────────────────────────────

const ProfileBusinessScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email, username, firstName, lastName, phoneNumber } = route.params;

  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [businesses, setBusinesses] = useState<BusinessForm[]>([createEmptyBusiness()]);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});

  const scrollViewRef = useRef<ScrollView>(null);
  const innerViewY = useRef(0);
  const businessSectionY = useRef(0);
  const cardYPositions = useRef<Map<string, number>>(new Map());
  const SCROLL_OFFSET = 20; // breathing room from top of screen

  const updateBusiness = (id: string, field: keyof BusinessForm, value: string) => {
    setBusinesses(prev =>
      prev.map(b => (b.id === id ? { ...b, [field]: value } : b)),
    );
    if (errors[id]?.[field]) {
      setErrors(prev => {
        const copy = { ...prev };
        if (copy[id]) {
          copy[id] = { ...copy[id] };
          delete copy[id][field];
        }
        return copy;
      });
    }
  };

  const addBusiness = () => {
    const newBiz = createEmptyBusiness();
    setBusinesses(prev => [...prev, newBiz]);
    setTimeout(() => {
      const cardY = cardYPositions.current.get(newBiz.id) ?? 0;
      scrollViewRef.current?.scrollTo({
        y: innerViewY.current + businessSectionY.current + cardY - SCROLL_OFFSET,
        animated: true,
      });
    }, 150);
  };

  const removeBusiness = (id: string) => {
    if (businesses.length <= 1) return;

    const deletedIndex = businesses.findIndex(b => b.id === id);
    const remaining = businesses.filter(b => b.id !== id);

    setBusinesses(remaining);
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    cardYPositions.current.delete(id);

    // Scroll to the card that takes the deleted one's place (or the last card)
    const targetId = remaining[Math.min(deletedIndex, remaining.length - 1)].id;
    setTimeout(() => {
      const cardY = cardYPositions.current.get(targetId) ?? 0;
      scrollViewRef.current?.scrollTo({
        y: innerViewY.current + businessSectionY.current + cardY - SCROLL_OFFSET,
        animated: true,
      });
    }, 150);
  };

  const handleYesPress = () => {
    setHasBusiness(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: innerViewY.current + businessSectionY.current - SCROLL_OFFSET,
        animated: true,
      });
    }, 120);
  };

  const validate = (): boolean => {
    if (!hasBusiness) return true;

    const newErrors: Record<string, Record<string, string>> = {};
    let isValid = true;

    businesses.forEach(biz => {
      const bizErrors: Record<string, string> = {};

      if (!biz.businessName.trim()) {
        bizErrors.businessName = 'Business name is required';
        isValid = false;
      }
      if (!biz.businessType) {
        bizErrors.businessType = 'Business type is required';
        isValid = false;
      }
      if (biz.businessPhone.trim() && !validatePhone(biz.businessPhone.trim())) {
        bizErrors.businessPhone = 'Enter a valid 10-digit phone number';
        isValid = false;
      }
      if (biz.businessEmail.trim() && !validateEmail(biz.businessEmail.trim())) {
        bizErrors.businessEmail = 'Enter a valid email address';
        isValid = false;
      }

      if (Object.keys(bizErrors).length > 0) {
        newErrors[biz.id] = bizErrors;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleReview = () => {
    if (!validate()) return;

    const personal = { firstName, lastName, email, username, phoneNumber };

    const businessData = hasBusiness
      ? businesses.map(biz => ({
          businessName: biz.businessName.trim(),
          businessType: biz.businessType,
          businessPhone: biz.businessPhone.trim() || undefined,
          businessEmail: biz.businessEmail.trim() || undefined,
          gstin: biz.gstin.trim() || undefined,
          cin: biz.cin.trim() || undefined,
          pan: biz.pan.trim() || undefined,
        }))
      : [];

    navigation.navigate('Review', { personal, businesses: businessData });
  };

  const businessTypeOptions = BUSINESS_TYPES.map(bt => ({
    label: bt.label,
    value: bt.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          removeClippedSubviews={false}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepProgress
            currentStep={5}
            totalSteps={5}
            onStepPress={(step) => {
              const { email: e, username: u } = route.params;
              if (step === 1) navigation.navigate('SignupEmail');
              else if (step === 2) navigation.navigate('OtpVerification', { email: e });
              else if (step === 3) navigation.navigate('SignupCredentials', { email: e });
              else if (step === 4) navigation.navigate('ProfilePersonal', { email: e, username: u });
            }}
          />

          <View onLayout={(e) => { innerViewY.current = e.nativeEvent.layout.y; }}>
            {/* Title */}
            <Text style={styles.title}>Business Information</Text>
            <Text style={styles.subtitle}>
              Do you have a business to register?
            </Text>

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleButton, hasBusiness === true && styles.toggleButtonActive]}
                onPress={handleYesPress}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, hasBusiness === true && styles.toggleTextActive]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <View style={styles.toggleSpacer} />
              <TouchableOpacity
                style={[styles.toggleButton, hasBusiness === false && styles.toggleButtonActive]}
                onPress={() => setHasBusiness(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, hasBusiness === false && styles.toggleTextActive]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>

            {/* Business Forms */}
            {hasBusiness === true && (
              <View
                style={styles.businessFormsSection}
                onLayout={(e) => { businessSectionY.current = e.nativeEvent.layout.y; }}
              >
                {businesses.map((biz, index) => (
                  <View
                    key={biz.id}
                    style={styles.businessCard}
                    onLayout={(e) => { cardYPositions.current.set(biz.id, e.nativeEvent.layout.y); }}
                  >
                    {/* Card Header */}
                    <View style={styles.businessCardHeader}>
                      <Text style={styles.businessCardTitle}>Business {index + 1}</Text>
                      {businesses.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeBusiness(biz.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={{ fontSize: 16, color: '#ef4444' }}>🗑</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Business Name */}
                    <AppInput
                      label="Business Name"
                      value={biz.businessName}
                      onChangeText={(val) => updateBusiness(biz.id, 'businessName', val.trimStart())}
                      placeholder="Enter business name"
                      error={errors[biz.id]?.businessName}
                    />

                    {/* Business Type */}
                    <SelectField
                      label="Business Type"
                      value={biz.businessType}
                      onChange={(val) => updateBusiness(biz.id, 'businessType', val)}
                      options={businessTypeOptions}
                      placeholder="Select business type"
                      error={errors[biz.id]?.businessType}
                    />

                    {/* Business Phone */}
                    <AppInput
                      label="Business Phone"
                      value={biz.businessPhone}
                      onChangeText={(val) => {
                        const digits = val.replace(/\D/g, '').slice(0, 10);
                        updateBusiness(biz.id, 'businessPhone', digits);
                      }}
                      placeholder="10-digit phone number"
                      keyboardType="number-pad"
                      maxLength={10}
                      error={errors[biz.id]?.businessPhone}
                    />

                    {/* Business Email */}
                    <AppInput
                      label="Business Email"
                      value={biz.businessEmail}
                      onChangeText={(val) => updateBusiness(biz.id, 'businessEmail', val.replace(/\s/g, ''))}
                      placeholder="business@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      error={errors[biz.id]?.businessEmail}
                    />

                    {/* GSTIN */}
                    <AppInput
                      label="GSTIN (Optional)"
                      value={biz.gstin}
                      onChangeText={(val) => updateBusiness(biz.id, 'gstin', val.replace(/\s/g, '').toUpperCase())}
                      placeholder="e.g. 22AAAAA0000A1Z5"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={15}
                    />

                    {/* CIN */}
                    <AppInput
                      label="CIN (Optional)"
                      value={biz.cin}
                      onChangeText={(val) => updateBusiness(biz.id, 'cin', val.replace(/\s/g, '').toUpperCase())}
                      placeholder="e.g. L17110MH1973PLC013222"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={21}
                    />

                    {/* PAN */}
                    <AppInput
                      label="PAN (Optional)"
                      value={biz.pan}
                      onChangeText={(val) => updateBusiness(biz.id, 'pan', val.replace(/\s/g, '').toUpperCase())}
                      placeholder="e.g. ABCDE1234F"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={10}
                    />
                  </View>
                ))}

                {/* Add Another */}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addBusiness}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 18, color: '#f97316' }}>+</Text>
                  <Text style={styles.addButtonText}>Add Another Business</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* No Business Info */}
            {hasBusiness === false && (
              <View style={styles.noBizCard}>
                <Text style={styles.noBizText}>
                  No worries! You can always add a business later from your account settings.
                </Text>
              </View>
            )}

            {/* Review Button */}
            {hasBusiness !== null && (
              <View style={styles.buttonContainer}>
                <AppButton
                  title="Review & Submit"
                  onPress={handleReview}
                  variant="primary"
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
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
    marginBottom: 24,
    lineHeight: 22,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  toggleButtonActive: {
    borderColor: '#f97316',
    backgroundColor: '#f9731615',
  },
  toggleText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: '#94a3b8',
  },
  toggleTextActive: {
    color: '#f97316',
  },
  toggleSpacer: {
    width: 12,
  },

  // Business forms
  businessFormsSection: {
    marginBottom: 8,
  },
  businessCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  businessCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  businessCardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#f8fafc',
  },

  // Add button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f9731640',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  addButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#f97316',
    marginLeft: 8,
  },

  // No business card
  noBizCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noBizText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    textAlign: 'center',
  },

  // Button
  buttonContainer: {
    marginTop: 16,
  },
});

export default ProfileBusinessScreen;
