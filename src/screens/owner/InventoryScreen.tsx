import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import {Archive, Clock, Search} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppCard} from '../../components/common/AppCard';
import {AppButton} from '../../components/common/AppButton';
import {AppInput} from '../../components/common/AppInput';
import {StatusPill} from '../../components/common/StatusPill';
import {InventoryBatchCard} from '../../components/list/InventoryBatchCard';
import {EmptyState} from '../../components/common/EmptyState';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import {ConfirmDialog} from '../../components/common/ConfirmDialog';
import {Toast} from '../../components/common/Toast';
import {FAB} from '../../components/layout/FAB';
import {ProgressBar} from '../../components/forms/ProgressBar';
import {SelectField} from '../../components/forms/SelectField';
import {DatePicker} from '../../components/forms/DatePicker';
import {formatDate, formatCurrency} from '../../utils/formatters';
import {useAppContext} from '../../context/AppContext';
import {useParlour} from '../../backend/modules/parlour/hook/useParlour';
import {usePharmacy} from '../../backend/modules/pharmacy/hook/usePharmacy';
import {useRestaurant} from '../../backend/modules/restaurant/hook/useRestaurant';
import {useToast} from '../../hooks/useToast';
import {getBusinessTypeMap} from '../../storage/session.storage';

type ViewState = 'list' | 'detail' | 'add' | 'edit';

const STATUS_OPTIONS = [
  {value: 'ALL', label: 'All Statuses'},
  {value: 'ACTIVE', label: 'Active'},
  {value: 'ON_HOLD', label: 'On Hold'},
  {value: 'QUARANTINED', label: 'Quarantined'},
  {value: 'EXPIRED', label: 'Expired'},
  {value: 'DEPLETED', label: 'Depleted'},
];

const EDITABLE_STATUSES = [
  {value: 'ACTIVE', label: 'Active'},
  {value: 'ON_HOLD', label: 'On Hold'},
  {value: 'QUARANTINED', label: 'Quarantined'},
];

export const InventoryScreen: React.FC = () => {
  const {selectedModule, selectedBusiness} = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();
  const {toasts, showToast} = useToast();

  const activeModule =
    selectedModule?.toLowerCase().includes('restaurant') ? restaurant
    : selectedModule?.toLowerCase().includes('pharmacy') ? pharmacy
    : parlour;

  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Form state for add/edit
  const [form, setForm] = useState<{
    productId: string; batchNumber: string; supplierName: string;
    purchasedQuantity: string; remainingQuantity: string;
    costPrice: string; sellingPrice: string; status: string;
    manufactureDate: Date | null; expiryDate: Date | null; receivedDate: Date | null;
  }>({
    productId: '', batchNumber: '', supplierName: '', purchasedQuantity: '', remainingQuantity: '',
    costPrice: '', sellingPrice: '', status: 'ACTIVE',
    manufactureDate: null, expiryDate: null, receivedDate: null,
  });

  // Resolve businessId from storage — stable primitive dep
  useEffect(() => {
    const resolve = async () => {
      const bizMap = await getBusinessTypeMap();
      if (!bizMap || !selectedModule || !selectedBusiness) return;
      const moduleType = selectedModule;
      const businessList = bizMap[moduleType] || [];
      const biz = businessList.find((b: any) => b.businessName === selectedBusiness);
      setSelectedBusinessId(biz?.id || biz?.businessId || null);
    };
    resolve();
  }, [selectedBusiness, selectedModule]);

  // Load inventory — depends ONLY on selectedBusinessId (stable)
  useEffect(() => {
    if (!activeModule || !selectedBusinessId) return;
    if (expiringOnly) {
      activeModule.getExpiringBatches?.(selectedBusinessId, 30);
    } else {
      activeModule.loadInventoryByBusiness(selectedBusinessId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessId, expiringOnly]);

  // Read directly from hook state — no local copy
  const batches: any[] = activeModule?.inventory || [];
  const loading = activeModule?.loading;

  const filteredBatches = batches.filter(b => {
    const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchSearch = !searchText ||
      b.productName?.toLowerCase().includes(searchText.toLowerCase()) ||
      b.batchNumber?.toLowerCase().includes(searchText.toLowerCase());
    return matchStatus && matchSearch;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedBusinessId) {
      activeModule.loadInventoryByBusiness(selectedBusinessId);
    }
    setRefreshing(false);
  }, [selectedBusinessId]);

  const handleSave = async () => {
    if (!form.productId || !form.purchasedQuantity) {
      showToast('Product and purchased quantity are required', 'error');
      return;
    }
    const payload: Record<string, unknown> = {
      productId: Number(form.productId),
      businessId: selectedBusinessId,
      batchNumber: form.batchNumber,
      supplierName: form.supplierName,
      purchasedQuantity: Number(form.purchasedQuantity),
      remainingQuantity: Number(form.remainingQuantity || form.purchasedQuantity),
      costPrice: form.costPrice ? Number(form.costPrice) : null,
      sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : null,
      status: form.status,
      manufactureDate: form.manufactureDate?.toISOString() || null,
      expiryDate: form.expiryDate?.toISOString() || null,
      receivedDate: form.receivedDate?.toISOString() || new Date().toISOString(),
    };
    try {
      if (viewState === 'edit' && selectedBatch) {
        await activeModule.updateInventoryBatch?.({...payload, id: selectedBatch.id});
        showToast('Batch updated', 'success');
      } else {
        await activeModule.addInventoryBatch?.(payload);
        showToast('Batch added', 'success');
      }
      setViewState('list');
      if (selectedBusinessId) activeModule.loadInventoryByBusiness(selectedBusinessId);
    } catch (e: any) {
      showToast(e?.message || 'Failed to save batch', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteConfirm(null);
    try {
      await activeModule.deleteInventoryBatch?.(id);
      showToast('Batch deleted', 'success');
      if (selectedBusinessId) activeModule.loadInventoryByBusiness(selectedBusinessId);
    } catch {
      showToast('Failed to delete batch', 'error');
    }
  };

  const openEdit = (batch: any) => {
    setSelectedBatch(batch);
    setForm({
      productId: String(batch.productId || ''),
      batchNumber: batch.batchNumber || '',
      supplierName: batch.supplierName || '',
      purchasedQuantity: String(batch.purchasedQuantity || ''),
      remainingQuantity: String(batch.remainingQuantity || ''),
      costPrice: String(batch.costPrice || ''),
      sellingPrice: String(batch.sellingPrice || ''),
      status: batch.status || 'ACTIVE',
      manufactureDate: batch.manufactureDate ? new Date(batch.manufactureDate) : null,
      expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : null,
      receivedDate: batch.receivedDate ? new Date(batch.receivedDate) : null,
    });
    setViewState('edit');
  };

  const openAdd = () => {
    setSelectedBatch(null);
    setForm({productId: '', batchNumber: '', supplierName: '', purchasedQuantity: '', remainingQuantity: '', costPrice: '', sellingPrice: '', status: 'ACTIVE', manufactureDate: null, expiryDate: null, receivedDate: null});
    setViewState('add');
  };

  const expiryWarning = form.expiryDate
    ? Math.ceil((form.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  if (viewState === 'detail' && selectedBatch) {
    const used = (selectedBatch.purchasedQuantity - selectedBatch.remainingQuantity) / selectedBatch.purchasedQuantity;
    return (
      <ScreenWrapper>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setViewState('list')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <AppButton title="Edit" variant="secondary" onPress={() => openEdit(selectedBatch)} />
          </View>
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Batch Info</Text>
            <LabelValue label="Product ID" value={String(selectedBatch.productId)} />
            <LabelValue label="Batch #" value={selectedBatch.batchNumber || '—'} />
            <LabelValue label="Supplier" value={selectedBatch.supplierName || '—'} />
            <LabelValue label="Manufacture Date" value={selectedBatch.manufactureDate ? formatDate(selectedBatch.manufactureDate) : '—'} />
            <LabelValue label="Expiry Date" value={selectedBatch.expiryDate ? formatDate(selectedBatch.expiryDate) : '—'} />
            <LabelValue label="Received Date" value={selectedBatch.receivedDate ? formatDate(selectedBatch.receivedDate) : '—'} />
            <View style={styles.statusRow}>
              <Text style={styles.fieldLabel}>Status</Text>
              <StatusPill status={selectedBatch.status} />
            </View>
          </AppCard>
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Stock</Text>
            <LabelValue label="Purchased Qty" value={String(selectedBatch.purchasedQuantity)} />
            <LabelValue label="Remaining Qty" value={String(selectedBatch.remainingQuantity)} />
            <Text style={styles.fieldLabel}>Usage</Text>
            <ProgressBar progress={used} color={used > 0.8 ? '#ef4444' : used > 0.5 ? '#f59e0b' : '#10b981'} />
            {selectedBatch.costPrice && <LabelValue label="Cost Price" value={formatCurrency(selectedBatch.costPrice)} />}
            {selectedBatch.sellingPrice && <LabelValue label="Selling Price" value={formatCurrency(selectedBatch.sellingPrice)} />}
          </AppCard>
        </ScrollView>
        <Toast toasts={toasts} />
      </ScreenWrapper>
    );
  }

  if (viewState === 'add' || viewState === 'edit') {
    return (
      <ScreenWrapper>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setViewState('list')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>{viewState === 'add' ? 'Add Batch' : 'Edit Batch'}</Text>
          </View>
          <AppInput label="Product ID *" value={form.productId} onChangeText={v => setForm(f => ({...f, productId: v}))} keyboardType="numeric" />
          <AppInput label="Batch Number" value={form.batchNumber} onChangeText={v => setForm(f => ({...f, batchNumber: v}))} />
          <AppInput label="Supplier Name" value={form.supplierName} onChangeText={v => setForm(f => ({...f, supplierName: v}))} />
          <AppInput label="Purchased Quantity *" value={form.purchasedQuantity} onChangeText={v => setForm(f => ({...f, purchasedQuantity: v}))} keyboardType="numeric" />
          <AppInput label="Remaining Quantity" value={form.remainingQuantity} onChangeText={v => setForm(f => ({...f, remainingQuantity: v}))} keyboardType="numeric" />
          <AppInput label="Cost Price (₹)" value={form.costPrice} onChangeText={v => setForm(f => ({...f, costPrice: v}))} keyboardType="decimal-pad" />
          <AppInput label="Selling Price (₹)" value={form.sellingPrice} onChangeText={v => setForm(f => ({...f, sellingPrice: v}))} keyboardType="decimal-pad" />
          <SelectField
            label="Status"
            value={form.status}
            options={EDITABLE_STATUSES}
            onChange={v => setForm(f => ({...f, status: v}))}
          />
          <DatePicker label="Manufacture Date" value={form.manufactureDate} onChange={d => setForm(f => ({...f, manufactureDate: d}))} />
          <DatePicker label="Expiry Date" value={form.expiryDate} onChange={d => setForm(f => ({...f, expiryDate: d}))} />
          <DatePicker label="Received Date" value={form.receivedDate} onChange={d => setForm(f => ({...f, receivedDate: d}))} />
          {expiryWarning !== null && expiryWarning <= 90 && expiryWarning > 0 && (
            <Text style={styles.expiryWarning}>⚠ Expires in {expiryWarning} days</Text>
          )}
          <AppButton title={viewState === 'add' ? 'Add Batch' : 'Save Changes'} onPress={handleSave} style={styles.saveBtn} />
        </ScrollView>
        <Toast toasts={toasts} />
      </ScreenWrapper>
    );
  }

  // List view
  return (
    <ScreenWrapper scrollable={false}>
      <View style={styles.listContainer}>
        <Text style={styles.title}>Inventory</Text>

        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by product or batch #..."
          placeholderTextColor="#64748b"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
          {STATUS_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, statusFilter === opt.value && styles.filterChipActive]}
              onPress={() => setStatusFilter(opt.value)}>
              <Text style={[styles.filterText, statusFilter === opt.value && styles.filterTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.filterChip, expiringOnly && styles.filterChipExpiring]}
            onPress={() => setExpiringOnly(v => !v)}>
            <Clock size={14} color={expiringOnly ? '#f59e0b' : '#64748b'} />
            <Text style={[styles.filterText, expiringOnly && {color: '#f59e0b'}]}>Expiring 30d</Text>
          </TouchableOpacity>
        </ScrollView>

        {loading && !refreshing ? (
          <LoadingSpinner />
        ) : filteredBatches.length === 0 ? (
          <EmptyState
            icon={<Archive size={48} color="#64748b" />}
            title="No inventory batches"
            message="Add your first batch using the + button"
          />
        ) : (
          <FlatList
            data={filteredBatches}
            keyExtractor={item => String(item.id)}
            renderItem={({item}) => (
              <InventoryBatchCard
                batch={item}
                onPress={() => { setSelectedBatch(item); setViewState('detail'); }}
                onEdit={() => openEdit(item)}
                onDelete={() => setDeleteConfirm(item.id)}
              />
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <FAB onPress={openAdd} />

      <ConfirmDialog
        visible={deleteConfirm !== null}
        title="Delete Batch"
        message="Are you sure you want to delete this inventory batch?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />

      <Toast toasts={toasts} />
    </ScreenWrapper>
  );
};

const LabelValue = ({label, value}: {label: string; value: string}) => (
  <View style={styles.lvRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  listContainer: {flex: 1, paddingHorizontal: 16},
  content: {padding: 16, gap: 12, paddingBottom: 32},
  title: {fontSize: 28, fontWeight: '700', color: '#f8fafc', marginTop: 16, marginBottom: 12},
  searchInput: {backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12, color: '#f8fafc', fontSize: 14, marginBottom: 12},
  filterRow: {maxHeight: 44, marginBottom: 8},
  filterContent: {gap: 8, paddingRight: 16},
  filterChip: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: '#334155', gap: 4},
  filterChipActive: {backgroundColor: 'rgba(249,115,22,0.15)', borderColor: '#f97316'},
  filterChipExpiring: {backgroundColor: 'rgba(245,158,11,0.15)', borderColor: '#f59e0b'},
  filterText: {fontSize: 13, color: '#64748b', fontWeight: '500'},
  filterTextActive: {color: '#f97316'},
  listContent: {paddingBottom: 80, gap: 8},
  card: {gap: 6},
  cardTitle: {fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 8},
  detailHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  backBtn: {padding: 4},
  backBtnText: {fontSize: 16, color: '#f97316', fontWeight: '600'},
  formTitle: {fontSize: 18, fontWeight: '700', color: '#f8fafc'},
  statusRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  lvRow: {marginBottom: 8},
  fieldLabel: {fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5},
  fieldValue: {fontSize: 14, color: '#f8fafc', marginTop: 2},
  expiryWarning: {color: '#f59e0b', fontSize: 14, fontWeight: '600', textAlign: 'center', padding: 8},
  saveBtn: {marginTop: 8},
});
