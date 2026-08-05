import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { useAppContext } from '../../../../context/AppContext';
import { useParlour } from '../../../../backend/modules/parlour';
import { usePharmacy } from '../../../../backend/modules/pharmacy';
import { getSelectedBusinessId } from '../../../../backend/modules/shared/hook/useModuleService';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import { useToast } from '../../../../hooks/useToast';
import type { AppTheme } from '../../../../theme/theme.types';
import { SaveProgressOverlay } from '../../shared/detail/parts/SaveProgressOverlay';
import { ServiceDetailBase } from './ServiceDetailBase';
import { parlourSlots } from './ParlourServiceDetail';
import { pharmacySlots } from './PharmacyServiceDetail';
import { type ServiceDetailItem } from './serviceDetail.model';
import { configFor } from './serviceDetail.modules';
import {
  deriveDetailView,
  detailSubtitle,
  shouldLoadProductOptions,
  type DetailMode,
} from './serviceDetail.view';
import { useServiceDetailForm } from './useServiceDetailForm';
import { useServiceImages } from './useServiceImages';
import { useServiceProducts } from './useServiceProducts';

interface ServiceDetailScreenProps {
  route?: { params?: { serviceId?: number; mode?: DetailMode } };
  navigation?: {
    goBack: () => void;
    setParams?: (p: Record<string, unknown>) => void;
  };
}

/**
 * Route component: resolves the module, fetches the record, and hosts the form engine.
 *
 * The module is picked once here. Everything below receives only what it renders, which is what
 * stops "which module am I?" leaking through the screen.
 *
 * Simpler than its product sibling in one respect: services have no feature gates. There is no
 * inventory tab to check and no combo flag, so nothing here has to be careful about hook order.
 */
export function ServiceDetailScreen({ route, navigation }: ServiceDetailScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();

  const moduleKey = (selectedModule || '').toUpperCase() === 'PHARMACY' ? 'PHARMACY' : 'PARLOUR';
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const config = configFor(moduleKey);

  const serviceId = route?.params?.serviceId;
  const [mode, setMode] = useState<DetailMode>(route?.params?.mode ?? 'view');

  const [item, setItem] = useState<ServiceDetailItem | null>(null);
  const [loading, setLoading] = useState(mode !== 'add');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<null | 'delete'>(null);

  const loadService = activeModule.loadService;

  useEffect(() => {
    let alive = true;
    getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchService = useCallback(async () => {
    if (serviceId == null) return;
    setLoading(true);
    setLoadError(null);
    const result = await loadService(serviceId);
    if (result.success && result.data) {
      setItem(result.data as ServiceDetailItem);
    } else {
      setLoadError(result.error || 'Could not load this service.');
    }
    setLoading(false);
  }, [serviceId, loadService]);

  useEffect(() => {
    if (mode === 'add') return;
    fetchService();
  }, [mode, fetchService]);

  const onSaved = useCallback(
    (saved: ServiceDetailItem) => {
      setItem(saved);
      showToast(mode === 'add' ? 'Service created' : 'Service saved', 'success');
      // Stay on the record after an edit — bouncing back to the list hides the thing the user just
      // changed. A create has nothing to stay on, so it leaves.
      if (mode === 'add') navigation?.goBack();
      else setMode('view');
    },
    [mode, navigation, showToast],
  );

  const onDeleted = useCallback(() => {
    showToast('Service deleted', 'success');
    navigation?.goBack();
  }, [navigation, showToast]);

  const engine = useServiceDetailForm({
    mode,
    item,
    config,
    moduleApi: activeModule,
    businessId,
    onSaved,
    onDeleted,
  });

  const imageUris = useServiceImages(engine.keptFiles, engine.pendingFiles);

  // Read mode fetches the product list only when there are ids to turn into names.
  const products = useServiceProducts(
    activeModule.loadProductOptions,
    shouldLoadProductOptions(mode, engine.form.requiredProductIds.length),
  );

  const view = deriveDetailView({
    mode,
    loading,
    saving: engine.saving,
    hasError: loadError != null,
    hasItem: item != null,
  });

  const onSave = useCallback(async () => {
    const result = await engine.save();
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, showToast]);

  const onConfirmDelete = useCallback(async () => {
    // Drop the dialog BEFORE the progress overlay goes up. Two Modals must never overlap — on
    // react-native-web the first keeps its portal mounted and swallows taps meant for the second.
    setDialog(null);
    const result = await engine.remove();
    if (!result.success && result.error) showToast(result.error, 'error');
  }, [engine, showToast]);

  const slots = useMemo(
    () =>
      moduleKey === 'PHARMACY'
        ? pharmacySlots({ mode, form: engine.form, onExtraChange: engine.setExtra })
        : parlourSlots({ mode, form: engine.form, onExtraChange: engine.setExtra }),
    [moduleKey, mode, engine.form, engine.setExtra],
  );

  if (view === 'LOADING') {
    return (
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (view === 'ERROR') {
    return (
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not load this service</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Pressable onPress={fetchService} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <ServiceDetailBase
        mode={mode}
        form={engine.form}
        errors={engine.errors}
        slots={slots}
        saving={engine.saving}
        subtitle={detailSubtitle(mode, config.entityLabel)}
        imageUris={imageUris}
        onAddImage={engine.pickImages}
        onRemoveImage={engine.removeImage}
        productOptions={products.options}
        productOptionsLoading={products.loading}
        productOptionsError={products.error}
        productOptionsTruncated={products.truncated}
        onRetryProductOptions={products.reload}
        onFieldChange={engine.setField}
        onExtraChange={engine.setExtra}
        onRequiredProductsChange={engine.setRequiredProducts}
        onBack={() => (mode === 'edit' ? setMode('view') : navigation?.goBack())}
        onEdit={() => setMode('edit')}
        onSave={onSave}
        onDelete={() => setDialog('delete')}
      />

      <ConfirmDialog
        visible={dialog === 'delete'}
        title="Delete service?"
        message="This cannot be undone. A service still referenced by appointments, packages or bills cannot be deleted."
        confirmLabel="Delete"
        danger
        onConfirm={onConfirmDelete}
        onCancel={() => setDialog(null)}
      />

      <SaveProgressOverlay
        visible={engine.saving && engine.savePercent > 0}
        percent={engine.savePercent}
        label={engine.saveLabel}
      />
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: theme.palette.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    errorTitle: { fontSize: 16, fontWeight: '700', color: theme.palette.onBackground },
    errorBody: { fontSize: 13, color: theme.palette.muted, textAlign: 'center' },
    retry: {
      marginTop: 6,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
    },
    retryLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.onAccent ?? '#FFFFFF' },
  });
}

export default ServiceDetailScreen;
