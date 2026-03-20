import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {OperationsStackParamList} from '../../navigation/types';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {AppCard} from '../../components/common/AppCard';
import {AppButton} from '../../components/common/AppButton';
import {StatusPill} from '../../components/common/StatusPill';
import {ConfirmDialog} from '../../components/common/ConfirmDialog';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import {Toast} from '../../components/common/Toast';
import {formatDate, formatDateTime} from '../../utils/formatters';
import {useAppContext} from '../../context/AppContext';
import {useParlour} from '../../backend/modules/parlour/hook/useParlour';
import {usePharmacy} from '../../backend/modules/pharmacy/hook/usePharmacy';
import {useRestaurant} from '../../backend/modules/restaurant/hook/useRestaurant';
import {useToast} from '../../hooks/useToast';

type Props = NativeStackScreenProps<OperationsStackParamList, 'AppointmentDetail'>;

const APPT_STATUSES = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

export const AppointmentDetailScreen: React.FC<Props> = ({route, navigation}) => {
  const {appointmentId} = route.params;
  const {selectedModule} = useAppContext();
  const parlour = useParlour();
  const pharmacy = usePharmacy();
  const restaurant = useRestaurant();
  const {toasts, showToast} = useToast();

  const activeModule =
    selectedModule?.toLowerCase().includes('restaurant') ? restaurant
    : selectedModule?.toLowerCase().includes('pharmacy') ? pharmacy
    : parlour;

  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const loadAppointment = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activeModule.getAppointmentById?.(appointmentId);
      if (res?.data) {
        setAppointment(res.data);
        setSelectedStatus((res.data as any).status || '');
      }
    } catch {
      showToast('Failed to load appointment', 'error');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  const handleUpdateStatus = async () => {
    if (!appointment || !selectedStatus) return;
    try {
      await activeModule.updateAppointment({...appointment, status: selectedStatus});
      setAppointment((prev: any) => ({...prev, status: selectedStatus}));
      setStatusSheetOpen(false);
      showToast('Appointment status updated', 'success');
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleCancel = async () => {
    setCancelConfirm(false);
    try {
      await activeModule.updateAppointment({...appointment, status: 'CANCELLED'});
      setAppointment((prev: any) => ({...prev, status: 'CANCELLED'}));
      showToast('Appointment cancelled', 'success');
      navigation.goBack();
    } catch {
      showToast('Failed to cancel appointment', 'error');
    }
  };

  if (loading) return <LoadingSpinner overlay />;

  const services: any[] = appointment?.appointedServiceItems || [];

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Appointment Info</Text>
          <Text style={styles.fieldLabel}>Customer</Text>
          <Text style={styles.fieldValue}>{appointment?.customerName || `Customer #${appointment?.customerId}`}</Text>
          <Text style={styles.fieldLabel}>Date & Time</Text>
          <Text style={styles.fieldValue}>{appointment?.appointmentDateTime ? formatDateTime(appointment.appointmentDateTime) : '—'}</Text>
          {appointment?.notes && (
            <>
              <Text style={styles.fieldLabel}>Notes</Text>
              <Text style={styles.fieldValue}>{appointment.notes}</Text>
            </>
          )}
          <View style={styles.statusRow}>
            <Text style={styles.fieldLabel}>Status</Text>
            <StatusPill status={appointment?.status || 'SCHEDULED'} />
          </View>
        </AppCard>

        {services.length > 0 && (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Services</Text>
            {services.map((svc: any, idx: number) => (
              <View key={idx} style={styles.serviceRow}>
                <Text style={styles.serviceName}>{svc.serviceName || svc.name || `Service ${idx + 1}`}</Text>
                <Text style={styles.servicePrice}>{svc.price ? `₹${svc.price}` : ''}</Text>
              </View>
            ))}
          </AppCard>
        )}

        <AppButton
          title="Update Status"
          onPress={() => setStatusSheetOpen(true)}
          style={styles.actionBtn}
        />
        {appointment?.status !== 'CANCELLED' && (
          <AppButton
            title="Cancel Appointment"
            variant="danger"
            onPress={() => setCancelConfirm(true)}
            style={styles.actionBtn}
          />
        )}
      </ScrollView>

      {statusSheetOpen && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayBg} onPress={() => setStatusSheetOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Update Status</Text>
            {APPT_STATUSES.map(s => (
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

      <ConfirmDialog
        visible={cancelConfirm}
        title="Cancel Appointment"
        message="Are you sure you want to cancel this appointment?"
        confirmLabel="Cancel Appointment"
        cancelLabel="Keep"
        danger
        onConfirm={handleCancel}
        onCancel={() => setCancelConfirm(false)}
      />

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
  serviceRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)'},
  serviceName: {fontSize: 14, color: '#cbd5e1', flex: 1},
  servicePrice: {fontSize: 14, color: '#f97316', fontWeight: '600'},
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
