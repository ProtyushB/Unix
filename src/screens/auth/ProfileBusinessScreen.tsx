import React, { useState } from 'react';
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
import { Plus, Trash2 } from 'lucide-react-native';
import AppInput from '../../components/forms/AppInput';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileBusiness'>;

// ─── Business Form Type ─────────────────────────────────────────────────────

interface BusinessForm {
  id: string;
  name: string;
  businessType: string;
  phone: string;
  email: string;
  registrationNumber: string;
}

const createEmptyBusiness = (): BusinessForm => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  name: '',
  businessType: '',
  phone: '',
  email: '',
  registrationNumber: '',
});

// ─── Component ───────────────────────────────────────────────────────────────

const ProfileBusinessScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email, username, password, firstName, lastName, phoneNumber } = route.params;

  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);
  const [businesses, setBusinesses] = useState<BusinessForm[]>([createEmptyBusiness()]);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});

  const updateBusiness = (id: string, field: keyof BusinessForm, value: string) => {
    setBusinesses(prev =>
      prev.map(b => (b.id === id ? { ...b, [field]: value } : b)),
    );
    // Clear field error
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
    setBusinesses(prev => [...prev, createEmptyBusiness()]);
  };

  const removeBusiness = (id: string) => {
    if (businesses.length <= 1) return;
    setBusinesses(prev => prev.filter(b => b.id !== id));
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const validate = (): boolean => {
    if (!hasBusiness) return true;

    const newErrors: Record<string, Record<string, string>> = {};
    let isValid = true;

    businesses.forEach(biz => {
      const bizErrors: Record<string, string> = {};

      if (!biz.name.trim()) {
        bizErrors.name = 'Business name is required';
        isValid = false;
      }
      if (!biz.businessType) {
        bizErrors.businessType = 'Business type is required';
        isValid = false;
      }
      if (biz.phone.trim() && !validatePhone(biz.phone.trim())) {
        bizErrors.phone = 'Enter a valid 10-digit phone number';
        isValid = false;
      }
      if (biz.email.trim() && !validateEmail(biz.email.trim())) {
        bizErrors.email = 'Enter a valid email address';
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

    const personal = {
      firstName,
      lastName,
      email,
      username,
      password,
      phoneNumber,
    };

    const businessData = hasBusiness
      ? businesses.map(biz => ({
          name: biz.name.trim(),
          businessType: biz.businessType,
          phone: biz.phone.trim() || undefined,
          email: biz.email.trim() || undefined,
          registrationNumber: biz.registrationNumber.trim() || undefined,
        }))
      : [];

    navigation.navigate('Review', {
      personal,
      businesses: businessData,
    });
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
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step Progress */}
          <StepProgress currentStep={5} totalSteps={5} />

          {/* Title */}
          <Text style={styles.title}>Business Information</Text>
          <Text style={styles.subtitle}>
            Do you have a business to register?
          </Text>

          {/* Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                hasBusiness === true && styles.toggleButtonActive,
              ]}
              onPress={() => setHasBusiness(true)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  hasBusiness === true && styles.toggleTextActive,
                ]}
              >
                Yes
              </Text>
            </TouchableOpacity>
            <View style={styles.toggleSpacer} />
            <TouchableOpacity
              style={[
                styles.toggleButton,
                hasBusiness === false && styles.toggleButtonActive,
              ]}
              onPress={() => setHasBusiness(false)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  hasBusiness === false && styles.toggleTextActive,
                ]}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>

          {/* Business Forms */}
          {hasBusiness === true && (
            <View style={styles.businessFormsSection}>
              {businesses.map((biz, index) => (
                <View key={biz.id} style={styles.businessCard}>
                  {/* Card Header */}
                  <View style={styles.businessCardHeader}>
                    <Text style={styles.businessCardTitle}>
                      Business {index + 1}
                    </Text>
                    {businesses.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeBusiness(biz.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={18} color="#ef4444" strokeWidth={1.8} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Business Name */}
                  <AppInput
                    label="Business Name"
                    value={biz.name}
                    onChangeText={(val) => updateBusiness(biz.id, 'name', val)}
                    placeholder="Enter business name"
                    error={errors[biz.id]?.name}
                  />

                  {/* Business Type */}
                  <SelectField
                    label="Business Type"
                    value={biz.businessType}
                    onSelect={(val) => updateBusiness(biz.id, 'businessType', val)}
                    options={businessTypeOptions}
                    placeholder="Select business type"
                    error={errors[biz.id]?.businessType}
                  />

                  {/* Business Phone */}
                  <AppInput
                    label="Business Phone"
                    value={biz.phone}
                    onChangeText={(val) => {
                      const digits = val.replace(/\D/g, '').slice(0, 10);
                      updateBusiness(biz.id, 'phone', digits);
                    }}
                    placeholder="10-digit phone number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    error={errors[biz.id]?.phone}
                  />

                  {/* Business Email */}
                  <AppInput
                    label="Business Email"
                    value={biz.email}
                    onChangeText={(val) => updateBusiness(biz.id, 'email', val)}
                    placeholder="business@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors[biz.id]?.email}
                  />

                  {/* Registration Number */}
                  <AppInput
                    label="Registration Number (Optional)"
                    value={biz.registrationNumber}
                    onChangeText={(val) => updateBusiness(biz.id, 'registrationNumber', val)}
                    placeholder="e.g. GST, CIN"
                    autoCapitalize="characters"
                  />
                </View>
              ))}

              {/* Add Another */}
              <TouchableOpacity
                style={styles.addButton}
                onPress={addBusiness}
                activeOpacity={0.7}
              >
                <Plus size={18} color="#f97316" strokeWidth={2} />
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
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Title
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#f8fafc',
    marginTop: 32,
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
