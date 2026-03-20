import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Image,
  FlatList,
} from 'react-native';
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Trash2,
  Plus,
  ImageIcon,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInput } from '../../components/common/AppInput';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { useParlour } from '../../backend/modules/parlour/hook/useParlour';
import { usePharmacy } from '../../backend/modules/pharmacy/hook/usePharmacy';
import { useRestaurant } from '../../backend/modules/restaurant/hook/useRestaurant';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../hooks/useToast';
import { getBusinessTypeMap, type Business } from '../../storage/session.storage';
import { formatCurrency } from '../../utils/formatters';
import { getStatusColor } from '../../utils/statusColors';
import type { CatalogStackParamList } from '../../navigation/OwnerTabNavigator';

// ─── Types ──────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<CatalogStackParamList, 'ProductDetailScreen'>;

type ScreenMode = 'view' | 'edit' | 'add';

interface ProductForm {
  name: string;
  description: string;
  price: string;
  stock: string;
  status: string;
  brand: string;
  volume: string;
  volumeUnit: string;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  description: '',
  price: '',
  stock: '',
  status: 'ACTIVE',
  brand: '',
  volume: '',
  volumeUnit: '',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProductDetailScreen({ navigation, route }: Props) {
  const { productId, mode: initialMode } = route.params as any;
  const { selectedModule, selectedBusiness } = useAppContext();
  const { showToast } = useToast();

  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();

  const activeModule = selectedModule?.includes('Restaurant')
    ? restaurant
    : selectedModule?.includes('Pharmacy')
      ? pharmacy
      : parlour;

  const [mode, setMode] = useState<ScreenMode>(initialMode || 'view');
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  // Resolve business ID
  useEffect(() => {
    (async () => {
      const map = await getBusinessTypeMap();
      if (map && selectedModule) {
        const businesses = map[selectedModule] || [];
        const biz = businesses.find((b: Business) => b.name === selectedBusiness);
        setSelectedBusinessId(biz?.id ?? null);
      }
    })();
  }, [selectedBusiness, selectedModule]);

  // Load product data in view/edit mode
  useEffect(() => {
    if (mode === 'add' || !productId || !activeModule) return;
    setLoading(true);

    // Find product in loaded products list
    const found = (activeModule.products || []).find((p: any) => p.id === productId);
    if (found) {
      setProduct(found);
      setForm({
        name: found.name || '',
        description: found.description || '',
        price: String(found.price || ''),
        stock: String(found.stock || ''),
        status: found.status || 'ACTIVE',
        brand: found.brand || '',
        volume: String(found.volume || ''),
        volumeUnit: found.volumeUnit || '',
      });
      setImages(found.dmsFiles || []);
    }
    setLoading(false);
  }, [productId]);

  const updateField = useCallback((field: keyof ProductForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      showToast('Product name is required', 'error');
      return;
    }
    if (!activeModule || !selectedBusinessId) return;

    setSaving(true);
    try {
      const payload = {
        ...product,
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price) || 0,
        stock: parseInt(form.stock, 10) || 0,
        status: form.status,
        brand: form.brand.trim(),
        volume: parseFloat(form.volume) || 0,
        volumeUnit: form.volumeUnit.trim(),
        businessId: selectedBusinessId,
      };

      let result;
      if (mode === 'add') {
        delete payload.id;
        result = await activeModule.createProduct(payload);
      } else {
        result = await activeModule.updateProduct(payload);
      }

      if (result?.success) {
        showToast(mode === 'add' ? 'Product created' : 'Product updated', 'success');
        navigation.goBack();
      } else {
        showToast(result?.error || 'Failed to save', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred', 'error');
    } finally {
      setSaving(false);
    }
  }, [form, mode, product, activeModule, selectedBusinessId, navigation, showToast]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!activeModule || !productId) return;
            setSaving(true);
            try {
              const result = await activeModule.deleteProduct(productId);
              if (result?.success) {
                showToast('Product deleted', 'success');
                navigation.goBack();
              } else {
                showToast(result?.error || 'Failed to delete', 'error');
              }
            } catch (err: any) {
              showToast(err.message || 'An error occurred', 'error');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [activeModule, productId, navigation, showToast]);

  const handleAddImage = useCallback(() => {
    // Placeholder for react-native-image-picker integration
    showToast('Image picker coming soon', 'info');
  }, [showToast]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      </View>
    );
  }

  const isEditing = mode === 'edit' || mode === 'add';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <ArrowLeft size={22} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'add' ? 'New Product' : mode === 'edit' ? 'Edit Product' : 'Product'}
        </Text>
        <View style={styles.headerRight}>
          {mode === 'view' && (
            <TouchableOpacity onPress={() => setMode('edit')} style={styles.headerBtn}>
              <Edit3 size={20} color="#f97316" />
            </TouchableOpacity>
          )}
          {isEditing && (
            <>
              <TouchableOpacity
                onPress={() => {
                  if (mode === 'add') { navigation.goBack(); return; }
                  setMode('view');
                  if (product) {
                    setForm({
                      name: product.name || '',
                      description: product.description || '',
                      price: String(product.price || ''),
                      stock: String(product.stock || ''),
                      status: product.status || 'ACTIVE',
                      brand: product.brand || '',
                      volume: String(product.volume || ''),
                      volumeUnit: product.volumeUnit || '',
                    });
                  }
                }}
                style={styles.headerBtn}
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerBtn}>
                {saving ? (
                  <ActivityIndicator size="small" color="#f97316" />
                ) : (
                  <Save size={20} color="#f97316" />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Gallery */}
        <View style={styles.gallery}>
          {images.length > 0 ? (
            <FlatList
              horizontal
              data={images}
              keyExtractor={(item: any, idx: number) => String(item.id || idx)}
              renderItem={({ item }: { item: any }) => (
                <Image source={{ uri: item.url || item.fileUrl }} style={styles.galleryImage} />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryContent}
            />
          ) : (
            <View style={styles.galleryPlaceholder}>
              <ImageIcon size={40} color="#475569" />
              <Text style={styles.galleryPlaceholderText}>No images</Text>
            </View>
          )}
          {isEditing && (
            <TouchableOpacity style={styles.addImageBtn} onPress={handleAddImage} activeOpacity={0.7}>
              <Plus size={20} color="#f97316" />
            </TouchableOpacity>
          )}
        </View>

        {/* Fields */}
        <AppCard style={styles.formCard}>
          {isEditing ? (
            <>
              <AppInput
                label="Name *"
                value={form.name}
                onChangeText={(v) => updateField('name', v)}
                placeholder="Product name"
              />
              <AppInput
                label="Description"
                value={form.description}
                onChangeText={(v) => updateField('description', v)}
                placeholder="Product description"
                multiline
              />
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <AppInput
                    label="Price"
                    value={form.price}
                    onChangeText={(v) => updateField('price', v)}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfField}>
                  <AppInput
                    label="Stock"
                    value={form.stock}
                    onChangeText={(v) => updateField('stock', v)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <AppInput
                label="Brand"
                value={form.brand}
                onChangeText={(v) => updateField('brand', v)}
                placeholder="Brand name"
              />
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <AppInput
                    label="Volume"
                    value={form.volume}
                    onChangeText={(v) => updateField('volume', v)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfField}>
                  <AppInput
                    label="Volume Unit"
                    value={form.volumeUnit}
                    onChangeText={(v) => updateField('volumeUnit', v)}
                    placeholder="ml, L, g, kg"
                  />
                </View>
              </View>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusRow}>
                {['ACTIVE', 'INACTIVE'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, form.status === s && styles.statusChipActive]}
                    onPress={() => updateField('status', s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.statusChipText, form.status === s && styles.statusChipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <FieldRow label="Name" value={product?.name} />
              <FieldRow label="Description" value={product?.description} />
              <FieldRow label="Price" value={formatCurrency(product?.price || 0)} />
              <FieldRow label="Stock" value={String(product?.stock ?? '-')} />
              <FieldRow label="Status" value={product?.status} isStatus />
              <FieldRow label="Brand" value={product?.brand} />
              <FieldRow label="Volume" value={product?.volume ? `${product.volume} ${product.volumeUnit || ''}` : '-'} />
            </>
          )}
        </AppCard>

        {/* Delete Button */}
        {mode === 'view' && productId && (
          <AppButton
            title="Delete Product"
            variant="danger"
            onPress={handleDelete}
            loading={saving}
            style={styles.deleteBtn}
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Field Row Helper ───────────────────────────────────────────────────────

function FieldRow({ label, value, isStatus }: { label: string; value?: string; isStatus?: boolean }) {
  if (!value) return null;
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      {isStatus ? (
        <View style={[fieldStyles.statusBadge, { backgroundColor: (getStatusColor(value) || '#64748b') + '20' }]}>
          <Text style={[fieldStyles.statusText, { color: getStatusColor(value) || '#64748b' }]}>{value}</Text>
        </View>
      ) : (
        <Text style={fieldStyles.value}>{value || '-'}</Text>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#33415540',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f8fafc',
    maxWidth: '60%',
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
    textAlign: 'center',
  },
  headerBtn: {
    padding: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  gallery: {
    height: 200,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  galleryImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  galleryPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  galleryPlaceholderText: {
    fontSize: 13,
    color: '#475569',
  },
  addImageBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9731620',
    borderWidth: 1,
    borderColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f8fafc',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusChipActive: {
    backgroundColor: '#f9731620',
    borderColor: '#f97316',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  statusChipTextActive: {
    color: '#f97316',
  },
  deleteBtn: {
    marginBottom: 16,
  },
  bottomSpacer: {
    height: 32,
  },
});
