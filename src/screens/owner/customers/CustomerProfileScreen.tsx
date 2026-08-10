import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, History, Lock, User } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../theme/theme.types';
import type { CustomerDto } from '../../../backend/person';
import { DetailCard } from '../shared/detail/parts/DetailCard';
import { DetailField } from '../shared/detail/parts/DetailField';
import {
  customerName,
  formatFullDate,
  formatMonthYear,
  formatSpend,
  formatStamp,
} from './customer.model';
import { PROFILE_TITLE, READ_ONLY_PILL, profileActivityValue } from './customer.view';
import { initialsOf } from '../../../utils/formatters';

/**
 * One customer, read-only.
 *
 * ⚠️ THIS SCREEN NEVER FETCHES. The record arrives in the route params from the list, and that is
 * forced rather than chosen: there is no customer-by-id endpoint, and `GET /persons/{personId}`
 * both drops every per-business rollup (`totalSpent`, `activityCount`, `firstSeenAt`,
 * `lastActivityAt`) and is `@PreAuthorize("hasAuthority('CUSTOMER')")`, which an owner's token does
 * not satisfy. Refetching would blank the four figures this screen exists to show, or 403.
 *
 * So: no deep link, no pull-to-refresh, and no view machine — there is no LOADING or ERROR state
 * that can occur. See `customer.view.PROFILE_REFETCHES`.
 *
 * What it does NOT show is as deliberate as what it does. Centrix's equivalent renders four
 * permanently-fake fields — Membership Type and Status hardcoded to REGULAR/ACTIVE, a Business ID
 * that is always 0, and a System Information card that is always em-dashes because `Person` has no
 * `createdAt`/`updatedAt`. None of that is backed by anything, so none of it is here.
 */

interface Props {
  route?: { params?: { customer?: CustomerDto } };
  navigation?: { goBack: () => void };
}

export function CustomerProfileScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const customer = route?.params?.customer ?? null;
  const name = customer ? customerName(customer) : '';
  const since = formatMonthYear(customer?.firstSeenAt);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => navigation?.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={20} color={theme.palette.onBackground} />
        </Pressable>
        <Text style={styles.appBarTitle}>{PROFILE_TITLE}</Text>
        {/* States the contract on the screen itself: this tab is system-managed. */}
        <View style={styles.readOnly}>
          <Lock size={12} color={theme.palette.muted} />
          <Text style={styles.readOnlyLabel}>{READ_ONLY_PILL}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {since ? <Text style={styles.since}>{`Customer since ${since}`}</Text> : null}
        </View>

        {/* Two tiles, not four. The other two on the web portal are hardcoded fakes. */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total spent</Text>
            <Text style={styles.statValue}>{formatSpend(customer?.totalSpent)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Activity</Text>
            <Text style={styles.statValue}>{Number(customer?.activityCount ?? 0)}</Text>
          </View>
        </View>

        <DetailCard title="Personal information" icon={User}>
          <DetailField label="First name" value={customer?.firstName || '—'} editable={false} />
          <DetailField label="Last name" value={customer?.lastName || '—'} editable={false} />
          <DetailField label="Email" value={customer?.email || '—'} editable={false} />
          <DetailField label="Phone" value={customer?.phoneNumber || '—'} editable={false} />
        </DetailCard>

        <DetailCard title="Activity" icon={History}>
          {/* "(finalized bills)" is on screen because that is exactly what the server counts —
              not orders, not appointments. */}
          <DetailField
            label="Activity"
            value={profileActivityValue(customer?.activityCount)}
            editable={false}
          />
          <DetailField
            label="Total spent"
            value={formatSpend(customer?.totalSpent)}
            editable={false}
          />
          <DetailField
            label="Customer since"
            value={formatFullDate(customer?.firstSeenAt) || '—'}
            editable={false}
          />
          <DetailField
            label="Last active"
            value={formatStamp(customer?.lastActivityAt) || '—'}
            editable={false}
          />
        </DetailCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, palette } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },

    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: palette.divider,
    },
    iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    appBarTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: palette.onBackground },
    readOnly: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: palette.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    readOnlyLabel: { fontSize: 11, fontWeight: '600', color: palette.muted },

    content: { padding: 16, gap: 14 },

    header: { alignItems: 'center', gap: 8, paddingVertical: 8 },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.softBg,
    },
    avatarText: { fontSize: 20, fontWeight: '700', color: colors.primary },
    name: { fontSize: 19, fontWeight: '700', color: palette.onBackground },
    since: { fontSize: 12.5, color: palette.muted },

    stats: { flexDirection: 'row', gap: 12 },
    stat: {
      flex: 1,
      gap: 4,
      padding: 14,
      borderRadius: 16,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.divider,
    },
    statLabel: { fontSize: 11.5, color: palette.muted },
    statValue: { fontSize: 19, fontWeight: '800', color: palette.onBackground },
  });
}
