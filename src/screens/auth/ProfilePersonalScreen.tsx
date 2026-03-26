import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {AppInput} from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import StepProgress from '../../components/common/StepProgress';
import { validatePhone } from '../../utils/validators';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfilePersonal'>;

// ─── Component ───────────────────────────────────────────────────────────────

const ProfilePersonalScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email, username } = route.params;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const isFormReady =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phoneNumber.length === 10;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!validatePhone(phoneNumber.trim())) {
      newErrors.phoneNumber = 'Enter a valid 10-digit phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;

    navigation.navigate('ProfileBusiness', {
      email,
      username,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phoneNumber.trim(),
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView removeClippedSubviews={false}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          <StepProgress
            currentStep={4}
            totalSteps={5}
            onStepPress={(step) => {
              const { email, username } = route.params;
              if (step === 1) navigation.navigate('SignupEmail');
              else if (step === 2) navigation.navigate('OtpVerification', { email });
              else if (step === 3) navigation.navigate('SignupCredentials', { email });
              else if (step === 5) navigation.navigate('ProfileBusiness', { email, username, firstName: 'Dev', lastName: 'User', phoneNumber: '9999999999' });
            }}
          />

          <View>
            {/* Title */}
            <Text style={styles.title}>Personal Information</Text>
            <Text style={styles.subtitle}>
              Tell us a bit about yourself
            </Text>

            {/* First Name */}
            <AppInput
              label="First Name"
              value={firstName}
              onChangeText={(val) => {
                setFirstName(val.replace(/\s/g, ''));
                if (errors.firstName) {
                  setErrors(prev => ({ ...prev, firstName: '' }));
                }
              }}
              placeholder="Enter your first name"
              autoCapitalize="words"
              error={errors.firstName}
            />

            {/* Last Name */}
            <AppInput
              label="Last Name"
              value={lastName}
              onChangeText={(val) => {
                setLastName(val.replace(/\s/g, ''));
                if (errors.lastName) {
                  setErrors(prev => ({ ...prev, lastName: '' }));
                }
              }}
              placeholder="Enter your last name"
              autoCapitalize="words"
              error={errors.lastName}
            />

            {/* Phone Number */}
            <AppInput
              label="Phone Number"
              value={phoneNumber}
              onChangeText={(val) => {
                // Only allow digits, max 10
                const digits = val.replace(/\D/g, '').slice(0, 10);
                setPhoneNumber(digits);
                if (errors.phoneNumber) {
                  setErrors(prev => ({ ...prev, phoneNumber: '' }));
                }
              }}
              placeholder="10-digit mobile number"
              keyboardType="number-pad"
              maxLength={10}
              error={errors.phoneNumber}
            />

            {/* Continue Button */}
            <View style={styles.buttonContainer}>
              <AppButton
                title="Continue"
                onPress={handleContinue}
                variant="primary"
                disabled={!isFormReady}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

    // Button
    buttonContainer: {
      marginTop: 24,
    },
  });
}

export default ProfilePersonalScreen;
