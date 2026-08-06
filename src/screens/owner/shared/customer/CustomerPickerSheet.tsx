import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Mail, Phone, Search, User, UserPlus } from 'lucide-react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import type { AppTheme } from '../../../../theme/theme.types';
import { Badge } from '../detail/parts/Badge';
import { useCustomerPicker } from './useCustomerPicker';
import {
  canSearch,
  contactLine,
  eligibilityLabel,
  eligibilityTone,
  initialsOf,
  matchLabel,
  resultsBanner,
  type CustomerMatch,
  type CustomerOption,
} from './customerPicker.model';

interface Props {
  visible: boolean;
  businessId: number | null;
  onClose: () => void;
  /**
   * The single exit. Called for a list pick, a Centrix-match pick and a fresh create alike, always
   * BEFORE `onClose` so the caller has the customer in hand before the sheet starts closing.
   */
  onSelect: (customer: CustomerOption) => void;
}

/**
 * Pick a customer: from this business's own list, from anywhere in Centrix, or by creating one.
 *
 * Shared by the order, appointment and bill detail screens. Faithful to Centrix's
 * `CustomerSelectionModal` — same three states, same 250 ms list debounce, same undebounced
 * Centrix lookup behind an explicit Search, same page size — because it is the flow the same users
 * already know from the web portal.
 *
 * ⚠️ A `Modal` renders in its own native window, OUTSIDE this screen's SafeAreaView, so it
 * receives no inset from anywhere. Every inset below is read here and applied here. Getting this
 * wrong puts the Create button under the gesture nav bar, which is how it shipped twice before.
 *
 * ⚠️ Never raise a second Modal while this one is up. On react-native-web the previous Modal's
 * portal stays mounted after `visible` flips false and silently eats taps.
 */
export function CustomerPickerSheet({ visible, businessId, onClose, onSelect }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const picker = useCustomerPicker(businessId, visible);

  const pick = (customer: CustomerOption) => {
    onSelect(customer);
    onClose();
  };

  const onCreate = async () => {
    const created = await picker.create();
    if (created) pick(created);
  };

  const isCreate = picker.view === 'create';
  const isList = picker.view === 'list';

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* ── App bar ─────────────────────────────────────────────────────── */}
        <View style={styles.appBar}>
          <Pressable
            style={styles.iconButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close customer picker"
          >
            <ChevronLeft size={20} color={theme.palette.onSurface} />
          </Pressable>
          {isCreate ? (
            <UserPlus size={16} color={theme.colors.primary} />
          ) : (
            <User size={16} color={theme.colors.primary} />
          )}
          <Text style={styles.appBarTitle}>{isCreate ? 'New customer' : 'Select customer'}</Text>
        </View>

        {/* ── Back link, on every view except the first ───────────────────── */}
        {!isList && (
          <Pressable
            style={styles.backLink}
            onPress={isCreate ? picker.cancelCreate : picker.backToList}
            accessibilityRole="button"
          >
            <ChevronLeft size={14} color={theme.colors.primary} />
            <Text style={styles.backLinkText}>
              {isCreate ? 'Back to search' : 'Back to your customers'}
            </Text>
          </Pressable>
        )}

        {picker.error ? <Text style={styles.error}>{picker.error}</Text> : null}

        {isList && (
          <ListView picker={picker} styles={styles} theme={theme} onPick={pick} insets={insets} />
        )}

        {(picker.view === 'results' || picker.view === 'empty') && (
          <ResultsView picker={picker} styles={styles} onPick={pick} insets={insets} />
        )}

        {isCreate && (
          <CreateView
            picker={picker}
            styles={styles}
            theme={theme}
            onCreate={onCreate}
            insets={insets}
          />
        )}
      </View>
    </Modal>
  );
}

type Picker = ReturnType<typeof useCustomerPicker>;
type Styles = ReturnType<typeof createStyles>;
interface Insets {
  bottom: number;
}

// ─── List ────────────────────────────────────────────────────────────────────

function ListView({
  picker,
  styles,
  theme,
  onPick,
  insets,
}: {
  picker: Picker;
  styles: Styles;
  theme: AppTheme;
  onPick: (c: CustomerOption) => void;
  insets: Insets;
}) {
  const searchable = canSearch(picker.email, picker.phone);

  return (
    <FlatList
      data={picker.rows}
      keyExtractor={(item) => String(item.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
      onEndReached={picker.loadMore}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {/* ── Centrix-wide lookup ───────────────────────────────────────── */}
          <View style={styles.lookupCard}>
            <View style={styles.lookupTitleRow}>
              <Search size={13} color={theme.colors.primary} />
              <Text style={styles.lookupTitle}>FIND ANYONE ACROSS CENTRIX</Text>
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputWrap}>
              <Mail size={15} color={theme.palette.muted} />
              <TextInput
                style={styles.inputInner}
                value={picker.email}
                onChangeText={picker.setEmail}
                placeholder="name@email.com"
                placeholderTextColor={theme.palette.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                onSubmitEditing={() => {
                  if (searchable) void picker.search();
                }}
              />
            </View>

            <Text style={styles.fieldLabel}>Phone</Text>
            <View style={styles.inputWrap}>
              <Phone size={15} color={theme.palette.muted} />
              <TextInput
                style={styles.inputInner}
                value={picker.phone}
                onChangeText={picker.setPhone}
                placeholder="phone number"
                placeholderTextColor={theme.palette.muted}
                keyboardType="phone-pad"
                onSubmitEditing={() => {
                  if (searchable) void picker.search();
                }}
              />
            </View>

            <Pressable
              style={[styles.primaryButton, !searchable && styles.buttonDisabled]}
              disabled={!searchable || picker.searching}
              onPress={() => {
                void picker.search();
              }}
              accessibilityRole="button"
              accessibilityLabel="Search Centrix by email or phone"
            >
              {picker.searching ? (
                <ActivityIndicator size="small" color={theme.colors.onAccent ?? '#FFFFFF'} />
              ) : (
                <>
                  <Search size={15} color={theme.colors.onAccent ?? '#FFFFFF'} />
                  <Text style={styles.primaryButtonText}>Search</Text>
                </>
              )}
            </Pressable>
          </View>
          <Text style={styles.caption}>System-wide exact lookup by email or phone.</Text>

          {/* ── This business's own customers ─────────────────────────────── */}
          <Text style={styles.sectionLabel}>YOUR CUSTOMERS</Text>
          <View style={styles.inputWrap}>
            <Search size={15} color={theme.palette.muted} />
            <TextInput
              style={styles.inputInner}
              value={picker.query}
              onChangeText={picker.setQuery}
              placeholder="Search name, email or phone…"
              placeholderTextColor={theme.palette.muted}
              autoCapitalize="none"
            />
          </View>
          {picker.loadingList && <ActivityIndicator style={styles.spinner} size="small" />}
        </View>
      }
      renderItem={({ item }) => <CustomerRow customer={item} styles={styles} onPick={onPick} />}
      ListEmptyComponent={
        picker.loadingList ? null : (
          <Text style={styles.empty}>
            {picker.query
              ? `No customer matches “${picker.query}”.`
              : 'No customers yet. Search Centrix above, or create one.'}
          </Text>
        )
      }
      ListFooterComponent={
        picker.loadingMore ? <ActivityIndicator style={styles.spinner} size="small" /> : null
      }
    />
  );
}

// ─── Results ─────────────────────────────────────────────────────────────────

function ResultsView({
  picker,
  styles,
  onPick,
  insets,
}: {
  picker: Picker;
  styles: Styles;
  onPick: (c: CustomerOption) => void;
  insets: Insets;
}) {
  return (
    <FlatList
      data={picker.matches}
      keyExtractor={(item) => String(item.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
      ListHeaderComponent={
        <Text style={styles.banner}>{resultsBanner(picker.matches.length)}</Text>
      }
      renderItem={({ item }) => <MatchRow match={item} styles={styles} onPick={onPick} />}
      ListFooterComponent={
        <Pressable
          style={styles.createLink}
          onPress={picker.startCreate}
          accessibilityRole="button"
        >
          <UserPlus size={15} color={styles.createLinkText.color as string} />
          <Text style={styles.createLinkText}>
            {picker.matches.length
              ? 'Neither is right — create a new customer'
              : 'Create a new customer'}
          </Text>
        </Pressable>
      }
    />
  );
}

// ─── Create ──────────────────────────────────────────────────────────────────

function CreateView({
  picker,
  styles,
  theme,
  onCreate,
  insets,
}: {
  picker: Picker;
  styles: Styles;
  theme: AppTheme;
  onCreate: () => void;
  insets: Insets;
}) {
  const fields = [
    { key: 'name' as const, label: 'Full name', icon: User, placeholder: 'Enter customer name' },
    { key: 'email' as const, label: 'Email', icon: Mail, placeholder: 'name@email.com' },
    { key: 'phone' as const, label: 'Phone', icon: Phone, placeholder: 'phone number' },
  ];

  return (
    <View style={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}>
      <View style={styles.formCard}>
        {fields.map(({ key, label, icon: Icon, placeholder }) => (
          <View key={key} style={styles.formField}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <View style={styles.inputWrap}>
              <Icon size={15} color={theme.palette.muted} />
              <TextInput
                style={styles.inputInner}
                value={picker.form[key]}
                onChangeText={(v) => picker.setField(key, v)}
                placeholder={placeholder}
                placeholderTextColor={theme.palette.muted}
                keyboardType={
                  key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'
                }
                autoCapitalize={key === 'name' ? 'words' : 'none'}
              />
            </View>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.primaryButton, picker.creating && styles.buttonDisabled]}
        disabled={picker.creating}
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="Create customer and attach"
      >
        {picker.creating ? (
          <ActivityIndicator size="small" color={theme.colors.onAccent ?? '#FFFFFF'} />
        ) : (
          <Text style={styles.primaryButtonText}>Create &amp; attach</Text>
        )}
      </Pressable>
      <Text style={styles.caption}>
        Matches an existing customer by email or phone — otherwise creates a new one.
      </Text>
    </View>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────────

function Avatar({ name, styles }: { name: string; styles: Styles }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initialsOf(name)}</Text>
    </View>
  );
}

function CustomerRow({
  customer,
  styles,
  onPick,
}: {
  customer: CustomerOption;
  styles: Styles;
  onPick: (c: CustomerOption) => void;
}) {
  return (
    <View style={styles.row}>
      <Avatar name={customer.name} styles={styles} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={styles.rowContact} numberOfLines={1}>
          {contactLine(customer)}
        </Text>
      </View>
      {/* A per-row Select button rather than a tappable row: this is single-select, and the button
          says so. Same call the web portal makes. */}
      <Pressable
        style={styles.selectButton}
        onPress={() => onPick(customer)}
        accessibilityRole="button"
        accessibilityLabel={`Select ${customer.name}`}
      >
        <Text style={styles.selectButtonText}>Select</Text>
      </Pressable>
    </View>
  );
}

function MatchRow({
  match,
  styles,
  onPick,
}: {
  match: CustomerMatch;
  styles: Styles;
  onPick: (c: CustomerOption) => void;
}) {
  const provenance = matchLabel(match);
  return (
    <View style={styles.matchRow}>
      <Avatar name={match.name} styles={styles} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {match.name}
        </Text>
        <Text style={styles.rowContact} numberOfLines={1}>
          {contactLine(match)}
        </Text>
        {/* Two badges, two different questions: can I use this person, and why did they come back.
            They wrap rather than sitting on one line — the mockup clipped them at 208 wide. */}
        <View style={styles.badgeRow}>
          <Badge label={eligibilityLabel(match)} tone={eligibilityTone(match)} />
          {provenance ? <Text style={styles.provenance}>{provenance}</Text> : null}
        </View>
      </View>
      <Pressable
        style={styles.selectButton}
        onPress={() => onPick(match)}
        accessibilityRole="button"
        accessibilityLabel={`Select ${match.name}`}
      >
        <Text style={styles.selectButtonText}>Select</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.background },

    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.palette.divider,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.palette.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    appBarTitle: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },

    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    backLinkText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

    error: {
      marginHorizontal: 16,
      marginTop: 12,
      fontSize: 12.5,
      color: theme.palette.error,
    },

    listContent: { padding: 16, gap: 10 },
    listHeader: { gap: 10 },

    lookupCard: {
      gap: 8,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    lookupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    lookupTitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: theme.colors.primary,
    },

    sectionLabel: {
      marginTop: 6,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: theme.palette.muted,
    },

    fieldLabel: { fontSize: 12.5, fontWeight: '600', color: theme.palette.muted },
    labelRow: { flexDirection: 'row', gap: 3 },
    required: { fontSize: 12.5, fontWeight: '700', color: theme.palette.error },

    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.palette.divider,
      backgroundColor: theme.palette.surfaceElevated,
    },
    inputInner: { flex: 1, color: theme.palette.onSurface, fontSize: 14 },

    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
    },
    primaryButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.onAccent ?? '#FFFFFF',
    },
    buttonDisabled: { opacity: 0.5 },

    caption: { fontSize: 11.5, color: theme.palette.muted },
    banner: {
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.palette.onSurface,
      marginBottom: 2,
    },
    spinner: { marginVertical: 12 },
    empty: { fontSize: 13, color: theme.palette.muted, textAlign: 'center', marginTop: 24 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    rowBody: { flex: 1, gap: 2 },
    rowName: { fontSize: 14, fontWeight: '600', color: theme.palette.onSurface },
    rowContact: { fontSize: 12, color: theme.palette.muted },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
    },
    provenance: { fontSize: 11, color: theme.palette.muted },

    avatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.softBg,
    },
    avatarText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },

    selectButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    selectButtonText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.onAccent ?? '#FFFFFF',
    },

    createLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
      paddingVertical: 12,
    },
    createLinkText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

    formCard: {
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.palette.surface,
      borderWidth: 1,
      borderColor: theme.palette.divider,
    },
    formField: { gap: 6 },
  });
}
