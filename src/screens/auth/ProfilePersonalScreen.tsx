import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { User, Mail, Phone, UserRoundCheck } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInput } from '../../components/common/AppInput';
import AppButton from '../../components/common/AppButton';
import AuthBackground from '../../components/auth/AuthBackground';
import AuthBarMask from '../../components/auth/AuthBarMask';
import AuthHeader from '../../components/auth/AuthHeader';
import SignupStepper from '../../components/auth/SignupStepper';
import AuthSection from '../../components/auth/AuthSection';
import { useSignupDraft } from '../../context/SignupDraftContext';
import { normalizePhone } from '../../utils/validators';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthScrollInsets } from '../../hooks/useAuthScrollInsets';
import type { AppTheme } from '../../theme/theme.types';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfilePersonal'>;

// Mockups 11 / 11b / 11c — the personal half of /profilePage.

const ProfilePersonalScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email, username } = route.params;
  const { getClaim } = useSignupDraft();
  const claim = getClaim();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scrollInsets = useAuthScrollInsets();

  // Claim path (11b): the walk-in's details are already on file, so prefill
  // rather than making them retype what we matched them on.
  useEffect(() => {
    if (!claim) return;
    setFirstName(prev => prev || claim.firstName);
    setLastName(prev => prev || claim.lastName);
    setPhoneNumber(prev => prev || claim.phoneNumber);
  }, [claim]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!normalizePhone(phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit phone number';
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
      // Store the bare digits, never what was typed — see normalizePhone.
      phoneNumber: normalizePhone(phoneNumber) as string,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <AuthBackground />
      <AuthBarMask />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          removeClippedSubviews={false}
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, scrollInsets]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHeader title="Complete your profile" subtitle="Tell us more about yourself" />
          <SignupStepper active={1} />

          {claim && (
            <View style={styles.claimBanner}>
              <UserRoundCheck size={19} color={palette.success} />
              <View style={styles.claimText}>
                <Text style={styles.claimLead}>We found your existing profile.</Text>
                <Text style={styles.claimBody}>
                  Your details are prefilled — finish signup to claim your account and keep your
                  history.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.block}>
            <AuthSection icon={User} title="Personal Information" />

            <View style={styles.fields}>
              <AppInput
                label="First Name *"
                value={firstName}
                onChangeText={v => {
                  setFirstName(v);
                  setErrors(e => ({ ...e, firstName: '' }));
                }}
                placeholder="Enter your first name"
                error={errors.firstName}
                leftIcon={<User size={18} color={palette.muted} />}
              />

              <AppInput
                label="Last Name *"
                value={lastName}
                onChangeText={v => {
                  setLastName(v);
                  setErrors(e => ({ ...e, lastName: '' }));
                }}
                placeholder="Enter your last name"
                error={errors.lastName}
                leftIcon={<User size={18} color={palette.muted} />}
              />

              {/* Carried from the credential step — shown so the user can see
                  what the account is being created against, but not editable. */}
              <View>
                <AppInput
                  label="Email *"
                  value={email}
                  onChangeText={() => {}}
                  disabled
                  leftIcon={<Mail size={18} color={palette.muted} />}
                />
                <Text style={styles.carriedHint}>From your signup information</Text>
              </View>

              <View>
                <AppInput
                  label="Username *"
                  value={username}
                  onChangeText={() => {}}
                  disabled
                  leftIcon={<User size={18} color={palette.muted} />}
                />
                <Text style={styles.carriedHint}>From your signup information</Text>
              </View>

              <AppInput
                label="Phone Number *"
                value={phoneNumber}
                onChangeText={v => {
                  setPhoneNumber(v);
                  setErrors(e => ({ ...e, phoneNumber: '' }));
                }}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                error={errors.phoneNumber}
                leftIcon={<Phone size={18} color={palette.muted} />}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <AppButton
              title="Back"
              onPress={() => navigation.goBack()}
              variant="secondary"
              style={styles.backButton}
            />
            <AppButton
              title="Continue to Preview"
              onPress={handleContinue}
              variant="primary"
              style={styles.nextButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

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
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 34,
      gap: 26,
    },
    claimBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      padding: 15,
      borderRadius: 14,
      backgroundColor: theme.palette.success + '2e',
      borderWidth: 1,
      borderColor: theme.palette.success + '59',
    },
    claimText: {
      flex: 1,
      gap: 4,
    },
    claimLead: {
      fontFamily: 'Inter-Bold',
      fontSize: 13,
      lineHeight: 18,
      color: theme.palette.success,
    },
    claimBody: {
      fontFamily: 'Inter-Regular',
      fontSize: 12.5,
      lineHeight: 18,
      color: theme.palette.onSurface,
    },
    block: {
      gap: 16,
    },
    // No `gap` here: AppInput already carries its own marginBottom: 16, and a gap on top of it
    // made 34px between every field. SignupScreen zeroes AppInput's margin instead; this screen
    // just relies on it.
    fields: {},
    carriedHint: {
      fontFamily: 'Inter-Regular',
      fontSize: 11.5,
      color: theme.palette.muted,
      marginTop: 4,
    },
    actions: {
      flexDirection: 'row',
      gap: 13,
    },
    backButton: {
      width: 118,
    },
    nextButton: {
      flex: 1,
    },
  });
}

export default ProfilePersonalScreen;
