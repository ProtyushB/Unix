import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, FlatList, RefreshControl, StyleSheet} from 'react-native';
import {Calendar} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {TopTabBar} from '../../components/layout/TopTabBar';
import {AppointmentCard} from '../../components/list/AppointmentCard';
import {EmptyState} from '../../components/common/EmptyState';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

const TABS = [
  {key: 'upcoming', label: 'Upcoming'},
  {key: 'past', label: 'Past'},
];

export const BookingsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [personId, setPersonId] = useState<number | null>(null);

  const { colors, palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    const loadPersonId = async () => {
      const userStr = await AsyncStorage.getItem('loggedInUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        setPersonId(user.id);
      }
    };
    loadPersonId();
  }, []);

  const loadAppointments = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      // TODO: call activeModule.loadAppointmentsByCustomer(personId, { status })
      // For upcoming: SCHEDULED,CONFIRMED
      // For past: COMPLETED,CANCELLED
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [personId, activeTab]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  }, [loadAppointments]);

  const filteredAppointments = appointments.filter(a => {
    if (activeTab === 'upcoming') {
      return ['SCHEDULED', 'CONFIRMED'].includes(a.status);
    }
    return ['COMPLETED', 'CANCELLED'].includes(a.status);
  });

  const handleAppointmentPress = (appointment: any) => {
    // TODO: navigate to appointment detail (read-only for customer)
  };

  return (
    <ScreenWrapper scrollable={false}>
      <View style={styles.container}>
        <Text style={styles.title}>My Bookings</Text>

        <TopTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {loading && !refreshing ? (
          <LoadingSpinner />
        ) : filteredAppointments.length === 0 ? (
          <EmptyState
            icon={<Calendar size={48} color={palette.muted} />}
            title={
              activeTab === 'upcoming'
                ? 'No upcoming bookings'
                : 'No past bookings'
            }
            message={
              activeTab === 'upcoming'
                ? 'Your upcoming appointments will appear here'
                : 'Your completed appointments will appear here'
            }
          />
        ) : (
          <FlatList
            data={filteredAppointments}
            keyExtractor={item => String(item.id)}
            renderItem={({item}) => (
              <AppointmentCard
                appointment={item}
                onPress={() => handleAppointmentPress(item)}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.palette.onBackground,
      marginTop: 16,
      marginBottom: 16,
    },
    listContent: {
      paddingBottom: 24,
      gap: 12,
      paddingTop: 12,
    },
  });
}
