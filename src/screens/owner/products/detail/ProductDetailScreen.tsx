import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../../../../components/common/ConfirmDialog';
import { useAppContext } from '../../../../context/AppContext';
import { useParlour } from '../../../../backend/modules/parlour';
import { usePharmacy } from '../../../../backend/modules/pharmacy';
import { getSelectedBusinessId } from '../../../../backend/modules/shared/hook/useModuleService';
import { useComboEnabled, useIsTabEnabled } from '../../../../backend/tab-config';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import { useToast } from '../../../../hooks/useToast';
import type { AppTheme } from '../../../../theme/theme.types';
import { ProductDetailBase } from './ProductDetailBase';
import { ComboPlaceholder } from './parts/ComboPlaceholder';
import { SaveProgressOverlay } from './parts/SaveProgressOverlay';
import { parlourSlots } from './ParlourProductDetail';
import { pharmacySlots } from './PharmacyProductDetail';
import { type ProductDetailItem } from './productDetail.model';
import { configFor } from './productDetail.modules';
import { deriveDetailView, detailSubtitle, type DetailMode } from './productDetail.view';
import { useProductDetailForm } from './useProductDetailForm';
import { useProductImages } from './useProductImages';

interface ProductDetailScreenProps {
  route?: { params?: { productId?: number; mode?: DetailMode } };
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
 */
export function ProductDetailScreen({ route, navigation }: ProductDetailScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const { selectedModule } = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();

  // Both gates read unconditionally, then combined. A hook behind `&&` changes hook order the
  // moment the flag flips, which crashes React rather than merely hiding a card.
  const inventoryTabEnabled = useIsTabEnabled('INVENTORY');
  const comboEnabled = useComboEnabled();

  const moduleKey = (selectedModule || '').toUpperCase() === 'PHARMACY' ? 'PHARMACY' : 'PARLOUR';
  const activeModule = moduleKey === 'PHARMACY' ? pharmacy : parlour;
  const config = configFor(moduleKey);

  const productId = route?.params?.productId;
  const [mode, setMode] = useState<DetailMode>(route?.params?.mode ?? 'view');

  const [item, setItem] = useState<ProductDetailItem | null>(null);
  const [loading, setLoading] = useState(mode !== 'add');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<null | 'delete'>(null);

  const loadProduct = activeModule.loadProduct;

  useEffect(() => {
    let alive = true;
    getSelectedBusinessId().then((id) => {
      if (alive) setBusinessId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const fetchProduct = useCallback(async () => {
    if (productId == null) return;
    setLoading(true);
    setLoadError(null);
    const result = await loadProduct(productId);
    if (result.success && result.data) {
      setItem(result.data as ProductDetailItem);
    } else {
      setLoadError(result.error || 'Could not load this product.');
    }
    setLoading(false);
  }, [productId, loadProduct]);

  useEffect(() => {
    if (mode === 'add') return;
    fetchProduct();
  }, [mode, fetchProduct]);

  const onSaved = useCallback(
    (saved: ProductDetailItem) => {
      setItem(saved);
      showToast(mode === 'add' ? 'Product created' : 'Product saved', 'success');
      // Stay on the record after an edit — the web portal does the same, and bouncing back to the
      // list hides the thing the user just changed. A create has nothing to stay on, so it leaves.
      if (mode === 'add') navigation?.goBack();
      else setMode('view');
    },
    [mode, navigation, showToast],
  );

  const onDeleted = useCallback(() => {
    showToast('Product deleted', 'success');
    navigation?.goBack();
  }, [navigation, showToast]);

  const engine = useProductDetailForm({
    mode,
    item,
    config,
    moduleApi: activeModule,
    businessId,
    onSaved,
    onDeleted,
  });

  const imageUris = useProductImages(engine.keptFiles, engine.pendingFiles);

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

  const slots = useMemo(() => {
    const moduleSlots =
      moduleKey === 'PHARMACY'
        ? pharmacySlots({
            mode,
            form: engine.form,
            errors: engine.errors,
            onExtrasChange: engine.setExtras,
          })
        : parlourSlots({ mode, form: engine.form, onExtraChange: engine.setExtra });

    if (comboEnabled && engine.form.productType === 'COMBO') {
      moduleSlots.comboSection = (
        <ComboPlaceholder
          comboType={item?.comboType as string | null}
          itemCount={Array.isArray(item?.comboItems) ? (item?.comboItems as unknown[]).length : 0}
        />
      );
    }
    return moduleSlots;
  }, [
    moduleKey,
    mode,
    engine.form,
    engine.errors,
    engine.setExtra,
    engine.setExtras,
    comboEnabled,
    item,
  ]);

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
          <Text style={styles.errorTitle}>Could not load this product</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Pressable onPress={fetchProduct} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <ProductDetailBase
        mode={mode}
        item={item ?? {}}
        form={engine.form}
        errors={engine.errors}
        slots={slots}
        inventoryTabEnabled={inventoryTabEnabled}
        saving={engine.saving}
        subtitle={detailSubtitle(mode, config.entityLabel)}
        imageUris={imageUris}
        onAddImage={engine.pickImages}
        onRemoveImage={engine.removeImage}
        comboEnabled={comboEnabled}
        onComboBlocked={() => showToast('Combo products are set up in the web portal', 'info')}
        onFieldChange={engine.setField}
        onPackChange={engine.onPackChange}
        onAddPack={engine.onAddPack}
        onRemovePack={engine.onRemovePack}
        onBack={() => (mode === 'edit' ? setMode('view') : navigation?.goBack())}
        onEdit={() => setMode('edit')}
        onSave={onSave}
        onDelete={() => setDialog('delete')}
      />

      <ConfirmDialog
        visible={dialog === 'delete'}
        title="Delete product?"
        message="This cannot be undone. A product still referenced by orders or inventory cannot be deleted."
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

export default ProductDetailScreen;
