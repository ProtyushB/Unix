import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Shield, ChevronRight, ChevronLeft, Fingerprint} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {ProfileStackParamList} from '../../navigation/types';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

export function SecurityScreen() {
  const navigation = useNavigation<Nav>();

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

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
          <Text style={styles.title}>Security</Text>
        </View>

        {/* Rows */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('AuthMethods')}
          activeOpacity={0.7}>
          <View style={styles.rowIcon}>
            <Fingerprint size={20} color={colors.primary} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Authentication Methods</Text>
            <Text style={styles.rowSub}>Fingerprint, Password</Text>
          </View>
          <ChevronRight size={18} color={palette.divider} />
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {flex: 1, paddingHorizontal: 16},
    header: {flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 24, gap: 12},
    backBtn: {padding: 4},
    title: {fontSize: 28, fontWeight: '700', color: theme.palette.onBackground},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.palette.surface,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.primary + '14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: {flex: 1},
    rowLabel: {fontSize: 16, fontWeight: '600', color: theme.palette.onBackground},
    rowSub: {fontSize: 13, color: theme.palette.muted, marginTop: 2},
  });
}
