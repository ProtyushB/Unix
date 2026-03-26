import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {OperationsStackParamList} from '../../navigation/types';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppCard} from '../../components/common/AppCard';
import {AppButton} from '../../components/common/AppButton';
import {StatusPill} from '../../components/common/StatusPill';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import {Toast} from '../../components/common/Toast';
import {formatCurrency, formatDate} from '../../utils/formatters';
import {useAppContext} from '../../context/AppContext';
import {useParlour} from '../../backend/modules/parlour/hook/useParlour';
import {usePharmacy} from '../../backend/modules/pharmacy/hook/usePharmacy';
import {useRestaurant} from '../../backend/modules/restaurant/hook/useRestaurant';
import {useToast} from '../../hooks/useToast';
import Share from 'react-native-share';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

type Props = NativeStackScreenProps<OperationsStackParamList, 'BillingDetail'>;

export const BillingDetailScreen: React.FC<Props> = ({route}) => {
  const {billId} = route.params;
  const {selectedModule} = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();
  const {toasts, showToast} = useToast();

  const activeModule =
    selectedModule?.toLowerCase().includes('restaurant') ? restaurant
    : selectedModule?.toLowerCase().includes('pharmacy') ? pharmacy
    : parlour;

  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  const loadBill = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activeModule.getBillById?.(billId);
      if (res?.data) setBill(res.data);
    } catch {
      showToast('Failed to load bill', 'error');
    } finally {
      setLoading(false);
    }
  }, [billId]);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  const handleMarkPaid = async () => {
    if (!bill) return;
    try {
      await activeModule.updateBill?.(bill.id, {...bill, status: 'PAID'});
      setBill((prev: any) => ({...prev, status: 'PAID'}));
      showToast('Bill marked as paid', 'success');
    } catch {
      showToast('Failed to update bill', 'error');
    }
  };

  const handleDownload = async () => {
    try {
      await Share.open({
        title: `Bill #${bill?.id}`,
        message: `Bill for ${bill?.customerName || 'Customer'} — Total: ${formatCurrency(bill?.totalAmount || 0)}`,
      });
    } catch {
      // user cancelled
    }
  };

  if (loading) return <LoadingSpinner overlay />;

  const lineItems: any[] = [
    ...(bill?.billedOrders || []),
    ...(bill?.billedAppointments || []),
    ...(bill?.customProducts || []),
    ...(bill?.customServices || []),
  ];

  const subtotal = bill?.subtotalAmount || 0;
  const tax = bill?.taxAmount || 0;
  const discount = bill?.discountAmount || 0;
  const total = bill?.totalAmount || subtotal + tax - discount;

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppCard style={styles.card}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.cardTitle}>Bill #{bill?.id}</Text>
              <Text style={styles.dateText}>{bill?.createdAt ? formatDate(bill.createdAt) : ''}</Text>
            </View>
            <StatusPill status={bill?.status || 'UNPAID'} />
          </View>
          <Text style={styles.fieldLabel}>Customer</Text>
          <Text style={styles.fieldValue}>{bill?.customerName || `Customer #${bill?.customerId}`}</Text>
          {bill?.customerPhone && (
            <>
              <Text style={styles.fieldLabel}>Phone</Text>
              <Text style={styles.fieldValue}>{bill.customerPhone}</Text>
            </>
          )}
        </AppCard>

        {lineItems.length > 0 && (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Line Items</Text>
            {lineItems.map((item: any, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name || item.productName || item.serviceName || `Item ${idx + 1}`}</Text>
                <Text style={styles.itemQty}>×{item.quantity || 1}</Text>
                <Text style={styles.itemTotal}>{formatCurrency((item.price || 0) * (item.quantity || 1))}</Text>
              </View>
            ))}
          </AppCard>
        )}

        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
          </View>
          {tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax ({bill?.taxRate || 0}%)</Text>
              <Text style={styles.summaryValue}>{formatCurrency(tax)}</Text>
            </View>
          )}
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, {color: palette.success}]}>-{formatCurrency(discount)}</Text>
            </View>
          )}
          {bill?.tips > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tips</Text>
              <Text style={styles.summaryValue}>{formatCurrency(bill.tips)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </AppCard>

        <AppButton title="Download Bill" variant="secondary" onPress={handleDownload} style={styles.actionBtn} />
        {bill?.status !== 'PAID' && (
          <AppButton title="Mark as Paid" onPress={handleMarkPaid} style={styles.actionBtn} />
        )}
      </ScrollView>
      <Toast toasts={toasts} />
    </ScreenWrapper>
  );
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {flex: 1},
    content: {padding: 16, gap: 12, paddingBottom: 32},
    card: {gap: 8},
    headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8},
    cardTitle: {fontSize: 16, fontWeight: '700', color: theme.palette.onBackground},
    dateText: {fontSize: 13, color: theme.palette.muted, marginTop: 2},
    fieldLabel: {fontSize: 12, color: theme.palette.muted, textTransform: 'uppercase', letterSpacing: 0.5},
    fieldValue: {fontSize: 15, color: theme.palette.onBackground, marginBottom: 8},
    itemRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.palette.divider + '80', gap: 8},
    itemName: {flex: 1, fontSize: 14, color: theme.palette.onBackground},
    itemQty: {fontSize: 14, color: theme.palette.muted, width: 32, textAlign: 'center'},
    itemTotal: {fontSize: 14, color: theme.palette.onBackground, width: 80, textAlign: 'right', fontWeight: '600'},
    summaryRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6},
    summaryLabel: {fontSize: 14, color: theme.palette.muted},
    summaryValue: {fontSize: 14, color: theme.palette.onBackground},
    totalRow: {borderTopWidth: 1, borderTopColor: theme.palette.divider, marginTop: 4, paddingTop: 12},
    totalLabel: {fontSize: 16, fontWeight: '700', color: theme.palette.onBackground},
    totalValue: {fontSize: 16, fontWeight: '700', color: theme.colors.primary},
    actionBtn: {marginTop: 4},
  });
}
