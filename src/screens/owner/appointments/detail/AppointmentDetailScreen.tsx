import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import { useToast } from '../../../../hooks/useToast';
import type { AppTheme } from '../../../../theme/theme.types';
import { useAppContext } from '../../../../context/AppContext';
import { useParlour } from '../../../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../../../backend/modules/pharmacy/hook/usePharmacy';
import { getSelectedBusinessId } from '../../../../backend/modules/shared/hook/useModuleService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { parseYmd, toYmd } from '../../../../utils/dateRange';
import { CustomerPickerSheet } from '../../shared/customer/CustomerPickerSheet';
import { OptionSheet } from '../../shared/detail/parts/OptionSheet';
import { CatalogPickerSheet, type CatalogRow } from '../../shared/detail/parts/CatalogPickerSheet';
import { AppointmentDetailBase, type ServiceDisplay } from './AppointmentDetailBase';
import { useAppointmentDetailForm } from './useAppointmentDetailForm';
import { configFor, type AppointmentModuleKey } from './appointmentDetail.modules';
import {
  enrichedDisplay,
  formatApptTime,
  statusLabel,
  STATUS_ORDER,
  type AppointmentDetailItem,
} from './appointmentDetail.model';
import { canEdit, deriveDetailView, lockedReason, type DetailMode } from './appointmentDetail.view';
import { displayServices, passthroughItems } from './appointmentLines';

type OpenSheet = 'none' | 'customer' | 'status' | 'services' | 'time';

/** A catalog service, flattened out of the module's list response. */
interface PickableService {
  id: number;
  name: string;
  price: number;
  duration: number | null;
  available: boolean;
}

/**
 * Half-hour slots, 6am to 9:30pm.
 *
 * A list rather than a native time picker: the time is an IST wall clock the business chose, and a
 * platform picker would hand back a `Date` in the device's zone — the exact conversion this screen
 * exists to avoid. Half-hours match how appointments are actually booked.
 */
const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

interface Props {
  route?: { params?: { appointmentId?: number; mode?: DetailMode } };
  navigation?: { goBack: () => void; setParams?: (params: Record<string, unknown>) => void };
}

export function AppointmentDetailScreen({ route, navigation }: Props = {}) {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const { selectedModule } = useAppContext();

  const parlour = useParlour();
  const pharmacy = usePharmacy();

  const moduleKey: AppointmentModuleKey =
    selectedModule?.toUpperCase() === 'PHARMACY' ? 'PHARMACY' : 'PARLOUR';
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const config = configFor(moduleKey);

  /**
   * ⚠️ Individual callbacks, never `activeModule` itself — it is a fresh object literal every
   * render, so an effect depending on it re-runs forever. See the note on the order screen, which
   * hit exactly that and issued 56 requests before it was caught.
   */
  const {
    loadAppointment,
    loadServices,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    services: serviceList,
  } = activeModule;

  const moduleApi = useMemo(
    () => ({ createAppointment, updateAppointment, deleteAppointment }),
    [createAppointment, updateAppointment, deleteAppointment],
  );

  const appointmentId = route?.params?.appointmentId;
  const [mode, setMode] = useState<DetailMode>(route?.params?.mode ?? 'view');
  const [item, setItem] = useState<AppointmentDetailItem | null>(null);
  const [loading, setLoading] = useState(mode !== 'add');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<OpenSheet>('none');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [completing, setCompleting] = useState<number | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  /**
   * The platform date picker, kept out of `OpenSheet` because it is not a Modal of ours — it is
   * the OS dialog, and the two never overlap.
   */
  const [pickingDate, setPickingDate] = useState(false);

  useEffect(() => {
    let alive = true;
    void getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchAppointment = useCallback(async () => {
    if (appointmentId == null) {
      setLoadError('No appointment was specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const result = await loadAppointment(appointmentId);
    if (result.success) setItem(result.data as AppointmentDetailItem);
    else setLoadError(result.error ?? 'Could not load this appointment.');
    setLoading(false);
  }, [appointmentId, loadAppointment]);

  useEffect(() => {
    if (mode === 'add') return;
    void fetchAppointment();
  }, [mode, fetchAppointment]);

  // The catalog is only for the picker, so it waits until the screen is editable. View mode renders
  // from the response's own enriched rows.
  const editable = mode !== 'view';
  useEffect(() => {
    if (!editable || catalogLoaded) return;
    setCatalogLoaded(true);
    void loadServices(1, 200);
  }, [editable, catalogLoaded, loadServices]);

  const engine = useAppointmentDetailForm({
    mode,
    item,
    moduleApi,
    businessId,
    onSaved: useCallback(
      (saved: AppointmentDetailItem) => {
        showToast(mode === 'add' ? 'Appointment created' : 'Appointment updated', 'success');
        if (mode === 'add') {
          navigation?.goBack();
          return;
        }
        setItem(saved);
        setMode('view');
        navigation?.setParams?.({ mode: 'view' });
      },
      [mode, navigation, showToast],
    ),
    onDeleted: useCallback(() => {
      showToast('Appointment deleted', 'success');
      navigation?.goBack();
    }, [navigation, showToast]),
  });

  const catalog = useMemo<PickableService[]>(() => {
    const rows = Array.isArray(serviceList) ? (serviceList as Record<string, unknown>[]) : [];
    return rows.map((s) => ({
      id: Number(s.id),
      name: String(s.name ?? ''),
      price: Number(s.price ?? 0),
      duration: s.duration == null ? null : Number(s.duration),
      // NOT NULL DEFAULT true server-side, so anything other than an explicit false is available.
      available: s.availability !== false,
    }));
  }, [serviceList]);

  const catalogRows = useMemo<CatalogRow[]>(
    () =>
      catalog.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        subtitle: s.duration ? `${s.duration} min` : '',
        badge: s.available
          ? { label: 'Available', tone: 'success' as const }
          : { label: 'Unavailable', tone: 'muted' as const },
        raw: s,
      })),
    [catalog],
  );

  /** Names and durations: the response's enriched rows first, the catalog only as a top-up. */
  const display = useMemo(() => {
    const map: Record<number, ServiceDisplay> = {};
    for (const [id, row] of Object.entries(enrichedDisplay(item))) {
      map[Number(id)] = { name: row.name, duration: row.duration };
    }
    for (const service of catalog) {
      map[service.id] = {
        name: map[service.id]?.name || service.name,
        duration: map[service.id]?.duration ?? service.duration,
      };
    }
    return map;
  }, [item, catalog]);

  const view = deriveDetailView({
    mode,
    loading,
    saving: engine.saving,
    hasError: !!loadError,
    hasItem: !!item,
  });

  /**
   * Mark one service completed.
   *
   * Its own endpoint, not a full PUT — the server owns the roll-up that may also complete the
   * appointment. The response sometimes comes back without its items (the web portal hit the same
   * thing), so a bare list triggers a refetch rather than blanking the screen.
   */
  const onCompleteItem = useCallback(
    async (index: number) => {
      const line = engine.form.lines[index];
      if (!line?.id || item?.id == null) return;
      setCompleting(index);
      const result = await activeModule.completeAppointmentItem?.(item.id, line.id);
      setCompleting(null);

      if (!result?.success) {
        showToast(result?.error ?? 'Could not mark that service completed.', 'error');
        return;
      }
      const dto = result.data as AppointmentDetailItem | null;
      if (dto && Array.isArray(dto.appointmentItems) && dto.appointmentItems.length) {
        setItem(dto);
        engine.applyItems(displayServices(dto), passthroughItems(dto));
      } else {
        await fetchAppointment();
      }
      showToast('Service marked completed', 'success');
    },
    [engine, item, activeModule, showToast, fetchAppointment],
  );

  const onEdit = useCallback(() => {
    if (!canEdit(item?.isBilled === true)) {
      showToast(lockedReason(item?.billNumber as string | null), 'error');
      return;
    }
    setMode('edit');
    navigation?.setParams?.({ mode: 'edit' });
  }, [item, navigation, showToast]);

  const onBack = useCallback(() => {
    if (mode === 'edit' && appointmentId != null) {
      setMode('view');
      navigation?.setParams?.({ mode: 'view' });
      return;
    }
    navigation?.goBack();
  }, [mode, appointmentId, navigation]);

  const onSave = useCallback(async () => {
    const result = await engine.save();
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, showToast]);

  const onConfirmDelete = useCallback(async () => {
    setConfirmDelete(false);
    const result = await engine.remove();
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, showToast]);

  if (view === 'LOADING') {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (view === 'ERROR') {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <Text style={styles.errorTitle}>Could not load this appointment</Text>
        <Text style={styles.errorBody}>{loadError}</Text>
        <Pressable
          onPress={() => {
            void fetchAppointment();
          }}
          accessibilityRole="button"
          style={styles.retry}
        >
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <>
      <AppointmentDetailBase
        mode={mode}
        item={item}
        form={engine.form}
        errors={engine.errors}
        passthrough={engine.passthrough}
        display={display}
        completing={completing}
        slots={{ moduleLabel: config.moduleLabel }}
        saving={engine.saving}
        onFieldChange={engine.setField}
        onPickCustomer={() => setSheet('customer')}
        onPickStatus={() => setSheet('status')}
        onPickTime={() => setSheet('time')}
        onPickDate={() => setPickingDate(true)}
        onAddService={() => setSheet('services')}
        onRemoveLine={engine.removeLine}
        onQuantity={engine.setLineQuantity}
        onCompleteItem={(index) => {
          void onCompleteItem(index);
        }}
        onBack={onBack}
        onEdit={onEdit}
        onSave={() => {
          void onSave();
        }}
        onDelete={() => setConfirmDelete(true)}
      />

      {/*
        The OS date dialog. `toYmd` builds the string from the Date's parts rather than slicing an
        ISO string — slicing gives the UTC day, which is the previous one before 05:30 IST.
      */}
      {pickingDate ? (
        <DateTimePicker
          value={engine.form.date ? parseYmd(engine.form.date) : new Date()}
          mode="date"
          onChange={(_event: unknown, picked?: Date) => {
            setPickingDate(false);
            if (picked) engine.setField('date', toYmd(picked));
          }}
        />
      ) : null}

      <CustomerPickerSheet
        visible={sheet === 'customer'}
        businessId={businessId}
        onClose={() => setSheet('none')}
        onSelect={engine.setCustomer}
      />

      <OptionSheet
        visible={sheet === 'status'}
        title="Appointment status"
        options={STATUS_ORDER.map((s) => ({ value: s, label: statusLabel(s) }))}
        selected={engine.form.appointmentStatus}
        onSelect={(value) => engine.setField('appointmentStatus', value)}
        onClose={() => setSheet('none')}
      />

      <OptionSheet
        visible={sheet === 'time'}
        title="Appointment time"
        options={TIME_SLOTS.map((t) => ({ value: t, label: formatApptTime(t) }))}
        selected={engine.form.time}
        onSelect={(value) => engine.setField('time', value)}
        onClose={() => setSheet('none')}
      />

      <CatalogPickerSheet
        visible={sheet === 'services'}
        title="Add services"
        subtitle={config.pickerSubtitle}
        helper="Tap to select — set quantity on the line after adding (duration comes from the service)"
        searchPlaceholder="Search services…"
        noun="service"
        rows={catalogRows}
        loading={false}
        error={null}
        alreadyAdded={engine.form.lines.map((l) => l.serviceId)}
        onAdd={(rows) => engine.addServices(rows.map((r) => r.raw as PickableService))}
        onClose={() => setSheet('none')}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this appointment?"
        message="This cannot be undone. Any package slots it booked are released."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          void onConfirmDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

export default AppointmentDetailScreen;

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 24,
      backgroundColor: theme.palette.background,
    },
    errorTitle: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    errorBody: { fontSize: 13, color: theme.palette.muted, textAlign: 'center' },
    retry: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    retryLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },
  });
}
