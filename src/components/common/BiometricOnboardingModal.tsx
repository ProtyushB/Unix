import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import {biometricStorage} from '../../storage/biometric.storage';
import {useBiometric} from '../../hooks/useBiometric';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

export function BiometricOnboardingModal() {
  const [visible, setVisible] = useState(false);
  const {available, biometryLabel, loading, enable} = useBiometric();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    if (loading) return;
    const check = async () => {
      if (!available) return;
      const seen = await biometricStorage.isPromptSeen();
      if (!seen) setVisible(true);
    };
    check();
  }, [loading, available]);

  const handleEnable = async () => {
    setVisible(false);
    await enable();
  };

  const handleSkip = async () => {
    setVisible(false);
    await biometricStorage.setPromptSeen();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleSkip}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>🔒</Text>
          <Text style={styles.title}>Enable Quick Access</Text>
          <Text style={styles.subtitle}>
            Use {biometryLabel} to log in faster next time instead of typing your
            password.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleEnable} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Enable {biometryLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipBtnText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    card: {
      backgroundColor: theme.palette.surface,
      borderRadius: 24,
      padding: 28,
      width: '100%',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    icon: {fontSize: 48, marginBottom: 16},
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: theme.palette.onSurface,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 28,
    },
    primaryBtn: {
      width: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryBtnText: {fontSize: 16, fontWeight: '700', color: '#fff'},
    skipBtn: {paddingVertical: 8},
    skipBtnText: {fontSize: 14, color: theme.palette.muted, fontWeight: '500'},
  });
}
