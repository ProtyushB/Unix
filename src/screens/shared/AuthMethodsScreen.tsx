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

export function AuthMethodsScreen() {
  const navigation = useNavigation();
  const {available, biometryLabel, enabled, loading, enable, disable} = useBiometric();

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
            <ChevronLeft size={24} color="#f8fafc" />
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
            <Fingerprint size={20} color={available ? '#f97316' : '#475569'} />
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
            <ActivityIndicator size="small" color="#64748b" />
          ) : available ? (
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{false: '#334155', true: 'rgba(249,115,22,0.4)'}}
              thumbColor={enabled ? '#f97316' : '#64748b'}
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

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: 16},
  header: {flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 24, gap: 12},
  backBtn: {padding: 4},
  title: {fontSize: 24, fontWeight: '700', color: '#f8fafc', flex: 1},
  sectionLabel: {marginBottom: 8, paddingHorizontal: 4},
  sectionText: {fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 1},
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconMuted: {backgroundColor: 'rgba(51,65,85,0.5)'},
  methodContent: {flex: 1},
  methodLabel: {fontSize: 16, fontWeight: '600', color: '#f8fafc'},
  methodSub: {fontSize: 13, color: '#64748b', marginTop: 2},
  activeBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  activeBadgeText: {fontSize: 12, fontWeight: '600', color: '#22c55e'},
  unavailableText: {fontSize: 16, color: '#475569'},
  hint: {
    fontSize: 13,
    color: '#475569',
    marginTop: 12,
    paddingHorizontal: 4,
    lineHeight: 19,
  },
});
