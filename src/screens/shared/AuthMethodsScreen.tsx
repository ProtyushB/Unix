import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ChevronLeft, KeyRound, Fingerprint} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {useBiometric} from '../../hooks/useBiometric';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

export function AuthMethodsScreen() {
  const navigation = useNavigation();
  const {available, biometryLabel, enabled, loading, enable, disable} = useBiometric();

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleToggle = async (val: boolean) => {
    if (val) {
      await enable();
    } else {
      await disable();
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <ChevronLeft size={24} color={palette.onBackground} />
          </TouchableOpacity>
          <Text style={styles.title}>Authentication Methods</Text>
        </View>

        {/* Password — always active */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionText}>ACTIVE</Text>
        </View>
        <View style={styles.methodRow}>
          <View style={styles.methodIcon}>
            <KeyRound size={20} color="#22c55e" />
          </View>
          <View style={styles.methodContent}>
            <Text style={styles.methodLabel}>Password</Text>
            <Text style={styles.methodSub}>Used for login and account recovery</Text>
          </View>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        </View>

        {/* Biometric */}
        <View style={[styles.sectionLabel, {marginTop: 24}]}>
          <Text style={styles.sectionText}>BIOMETRIC</Text>
        </View>
        <View style={styles.methodRow}>
          <View style={[styles.methodIcon, !available && styles.methodIconMuted]}>
            <Fingerprint size={20} color={available ? colors.primary : palette.muted} />
          </View>
          <View style={styles.methodContent}>
            <Text style={styles.methodLabel}>{biometryLabel} Login</Text>
            <Text style={styles.methodSub}>
              {!available
                ? 'Not available on this device'
                : enabled
                ? 'Tap the fingerprint sensor to log in'
                : 'Enable for faster login'}
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={palette.muted} />
          ) : available ? (
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{false: palette.divider, true: colors.border}}
              thumbColor={enabled ? colors.primary : palette.muted}
            />
          ) : (
            <Text style={styles.unavailableText}>—</Text>
          )}
        </View>

        {available && (
          <Text style={styles.hint}>
            {enabled
              ? `${biometryLabel} will be required when you open the app.`
              : `Enable ${biometryLabel} to skip the password screen on next launch.`}
          </Text>
        )}
      </View>
    </ScreenWrapper>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {flex: 1, paddingHorizontal: 16},
    header: {flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 24, gap: 12},
    backBtn: {padding: 4},
    title: {fontSize: 24, fontWeight: '700', color: theme.palette.onBackground, flex: 1},
    sectionLabel: {marginBottom: 8, paddingHorizontal: 4},
    sectionText: {fontSize: 11, fontWeight: '700', color: theme.palette.muted, letterSpacing: 1},
    methodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.palette.surface,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    methodIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.primary + '14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    methodIconMuted: {backgroundColor: theme.palette.divider + '80'},
    methodContent: {flex: 1},
    methodLabel: {fontSize: 16, fontWeight: '600', color: theme.palette.onBackground},
    methodSub: {fontSize: 13, color: theme.palette.muted, marginTop: 2},
    activeBadge: {
      backgroundColor: 'rgba(34,197,94,0.15)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: 'rgba(34,197,94,0.3)',
    },
    activeBadgeText: {fontSize: 12, fontWeight: '600', color: '#22c55e'},
    unavailableText: {fontSize: 16, color: theme.palette.muted},
    hint: {
      fontSize: 13,
      color: theme.palette.muted,
      marginTop: 12,
      paddingHorizontal: 4,
      lineHeight: 19,
    },
  });
}
