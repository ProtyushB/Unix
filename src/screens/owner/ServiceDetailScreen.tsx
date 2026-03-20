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

type Props = NativeStackScreenProps<CatalogStackParamList, 'ServiceDetailScreen'>;

type ScreenMode = 'view' | 'edit' | 'add';

interface ServiceForm {
  name: string;
  description: string;
  price: string;
  duration: string;
  status: string;
}

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  price: '',
  duration: '',
  status: 'ACTIVE',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ServiceDetailScreen({ navigation, route }: Props) {
  const { serviceId, mode: initialMode } = route.params as any;
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
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [service, setService] = useState<any>(null);
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

  // Load service data
  useEffect(() => {
    if (mode === 'add' || !serviceId || !activeModule) return;
    setLoading(true);
    const found = (activeModule.services || []).find((s: any) => s.id === serviceId);
    if (found) {
      setService(found);
      setForm({
        name: found.name || '',
        description: found.description || '',
        price: String(found.price || ''),
        duration: String(found.duration || ''),
        status: found.status || 'ACTIVE',
      });
      setImages(found.dmsFiles || []);
    }
    setLoading(false);
  }, [serviceId]);

  const updateField = useCallback((field: keyof ServiceForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      showToast('Service name is required', 'error');
      return;
    }
    if (!activeModule || !selectedBusinessId) return;

    setSaving(true);
    try {
      const payload = {
        ...service,
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price) || 0,
        duration: parseInt(form.duration, 10) || 0,
        status: form.status,
        businessId: selectedBusinessId,
      };

      let result;
      if (mode === 'add') {
        delete payload.id;
        result = await activeModule.createService(payload);
      } else {
        result = await activeModule.updateService(payload);
      }

      if (result?.success) {
        showToast(mode === 'add' ? 'Service created' : 'Service updated', 'success');
        navigation.goBack();
      } else {
        showToast(result?.error || 'Failed to save', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred', 'error');
    } finally {
      setSaving(false);
    }
  }, [form, mode, service, activeModule, selectedBusinessId, navigation, showToast]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Service',
      'Are you sure you want to delete this service? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!activeModule || !serviceId) return;
            setSaving(true);
            try {
              const result = await activeModule.deleteService(serviceId);
              if (result?.success) {
                showToast('Service deleted', 'success');
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
  }, [activeModule, serviceId, navigation, showToast]);

  const handleAddImage = useCallback(() => {
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
          {mode === 'add' ? 'New Service' : mode === 'edit' ? 'Edit Service' : 'Service'}
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
                  if (service) {
                    setForm({
                      name: service.name || '',
                      description: service.description || '',
                      price: String(service.price || ''),
                      duration: String(service.duration || ''),
                      status: service.status || 'ACTIVE',
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
                placeholder="Service name"
              />
              <AppInput
                label="Description"
                value={form.description}
                onChangeText={(v) => updateField('description', v)}
                placeholder="Service description"
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
                    label="Duration (min)"
                    value={form.duration}
                    onChangeText={(v) => updateField('duration', v)}
                    placeholder="30"
                    keyboardType="numeric"
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
              <FieldRow label="Name" value={service?.name} />
              <FieldRow label="Description" value={service?.description} />
              <FieldRow label="Price" value={formatCurrency(service?.price || 0)} />
              <FieldRow label="Duration" value={service?.duration ? `${service.duration} min` : '-'} />
              <FieldRow label="Status" value={service?.status} isStatus />
            </>
          )}
        </AppCard>

        {/* Delete Button */}
        {mode === 'view' && serviceId && (
          <AppButton
            title="Delete Service"
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
        <View style={[fieldStyles.statusBadge, { backgroundColor: getStatusColor(value) + '20' }]}>
          <Text style={[fieldStyles.statusText, { color: getStatusColor(value) }]}>{value}</Text>
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
