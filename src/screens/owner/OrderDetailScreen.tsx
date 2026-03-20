import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {OperationsStackParamList} from '../../navigation/types';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppCard} from '../../components/common/AppCard';
import {AppButton} from '../../components/common/AppButton';
import {StatusPill} from '../../components/common/StatusPill';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import {Toast} from '../../components/common/Toast';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import {formatCurrency, formatDate} from '../../utils/formatters';
import {useAppContext} from '../../context/AppContext';
import {useParlour} from '../../backend/modules/parlour/hook/useParlour';
import {usePharmacy} from '../../backend/modules/pharmacy/hook/usePharmacy';
import {useRestaurant} from '../../backend/modules/restaurant/hook/useRestaurant';
import {useToast} from '../../hooks/useToast';

type Props = NativeStackScreenProps<OperationsStackParamList, 'OrderDetail'>;

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

export const OrderDetailScreen: React.FC<Props> = ({route, navigation}) => {
  const {orderId} = route.params;
  const {selectedModule} = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();
  const {toasts, showToast} = useToast();

  const activeModule =
    selectedModule?.toLowerCase().includes('restaurant') ? restaurant
    : selectedModule?.toLowerCase().includes('pharmacy') ? pharmacy
    : parlour;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activeModule.getOrderById?.(orderId);
      if (res?.data) {
        setOrder(res.data);
        setSelectedStatus((res.data as any).status || '');
      }
    } catch {
      showToast('Failed to load order', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleUpdateStatus = async () => {
    if (!order || !selectedStatus) return;
    try {
      await activeModule.updateOrder({...order, status: selectedStatus});
      setOrder((prev: any) => ({...prev, status: selectedStatus}));
      setStatusSheetOpen(false);
      showToast('Order status updated', 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  if (loading) return <LoadingSpinner overlay />;

  const items: any[] = order?.orderedProductItems || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity || 0), 0);
  const tax = order?.taxAmount || 0;
  const total = order?.totalAmount || subtotal + tax;

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Customer Info</Text>
          <Text style={styles.fieldLabel}>Customer</Text>
          <Text style={styles.fieldValue}>{order?.customerName || `Customer #${order?.customerId}`}</Text>
          <Text style={styles.fieldLabel}>Phone</Text>
          <Text style={styles.fieldValue}>{order?.customerPhone || '—'}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.fieldLabel}>Status</Text>
            <StatusPill status={order?.status || 'PENDING'} />
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Ordered Items</Text>
          {items.map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{item.productName || item.name || `Item ${idx + 1}`}</Text>
              <Text style={styles.itemQty}>×{item.quantity}</Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.price || 0)}</Text>
              <Text style={styles.itemTotal}>{formatCurrency((item.price || 0) * (item.quantity || 1))}</Text>
            </View>
          ))}
        </AppCard>

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
          </View>
          {tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>{formatCurrency(tax)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </AppCard>

        <AppButton
          title="Update Status"
          onPress={() => setStatusSheetOpen(true)}
          style={styles.actionBtn}
        />
        <AppButton
          title="Generate Bill"
          variant="secondary"
          onPress={async () => {
            try {
              await activeModule.createBill?.({
                customerId: order.customerId,
                customerPhone: order.customerPhone,
                businessId: order.businessId,
                billedOrders: [{orderId: order.id}],
              });
              showToast('Bill created successfully', 'success');
            } catch {
              showToast('Failed to create bill', 'error');
            }
          }}
          style={styles.actionBtn}
        />
      </ScrollView>

      {statusSheetOpen && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBg} onPress={() => setStatusSheetOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Update Status</Text>
            {ORDER_STATUSES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.radioRow, selectedStatus === s && styles.radioRowActive]}
                onPress={() => setSelectedStatus(s)}>
                <View style={[styles.radioCircle, selectedStatus === s && styles.radioCircleActive]} />
                <Text style={styles.radioLabel}>{s}</Text>
              </TouchableOpacity>
            ))}
            <AppButton title="Confirm" onPress={handleUpdateStatus} style={styles.sheetBtn} />
          </View>
        </View>
      )}

      <Toast toasts={toasts} />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 16, gap: 12, paddingBottom: 32},
  card: {gap: 8},
  cardTitle: {fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 8},
  fieldLabel: {fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5},
  fieldValue: {fontSize: 15, color: '#f8fafc', marginBottom: 8},
  statusRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  itemRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)', gap: 8},
  itemName: {flex: 1, fontSize: 14, color: '#cbd5e1'},
  itemQty: {fontSize: 14, color: '#64748b', width: 32, textAlign: 'center'},
  itemPrice: {fontSize: 14, color: '#94a3b8', width: 72, textAlign: 'right'},
  itemTotal: {fontSize: 14, color: '#f8fafc', width: 80, textAlign: 'right', fontWeight: '600'},
  summaryRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6},
  summaryLabel: {fontSize: 14, color: '#94a3b8'},
  summaryValue: {fontSize: 14, color: '#f8fafc'},
  totalRow: {borderTopWidth: 1, borderTopColor: '#334155', marginTop: 4, paddingTop: 12},
  totalLabel: {fontSize: 16, fontWeight: '700', color: '#f8fafc'},
  totalValue: {fontSize: 16, fontWeight: '700', color: '#f97316'},
  actionBtn: {marginTop: 4},
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  overlayBg: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)'},
  sheet: {backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12},
  sheetTitle: {fontSize: 18, fontWeight: '700', color: '#f8fafc', marginBottom: 8},
  radioRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderRadius: 8, paddingHorizontal: 8},
  radioRowActive: {backgroundColor: 'rgba(249,115,22,0.1)'},
  radioCircle: {width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#475569'},
  radioCircleActive: {borderColor: '#f97316', backgroundColor: '#f97316'},
  radioLabel: {fontSize: 15, color: '#f8fafc'},
  sheetBtn: {marginTop: 8},
});
