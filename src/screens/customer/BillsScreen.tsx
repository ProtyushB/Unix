import React, {useState, useEffect, useCallback} from 'react';
import {View, Text, FlatList, RefreshControl, StyleSheet} from 'react-native';
import {Receipt} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {BillCard} from '../../components/list/BillCard';
import {EmptyState} from '../../components/common/EmptyState';
import {LoadingSpinner} from '../../components/common/LoadingSpinner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../hooks/useTheme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { AppTheme } from '../../theme/theme.types';

export const BillsScreen: React.FC = () => {
  const [bills, setBills] = useState<any[]>([]);
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

  const loadBills = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      // TODO: call activeModule.loadBills() filtered by personId
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBills();
    setRefreshing(false);
  }, [loadBills]);

  const handleBillPress = (bill: any) => {
    // TODO: navigate to bill detail (read-only for customer)
  };

  const handleDownload = async (bill: any) => {
    // TODO: download bill via react-native-share
  };

  return (
    <ScreenWrapper scrollable={false}>
      <View style={styles.container}>
        <Text style={styles.title}>My Bills</Text>

        {loading && !refreshing ? (
          <LoadingSpinner />
        ) : bills.length === 0 ? (
          <EmptyState
            icon={<Receipt size={48} color={palette.muted} />}
            title="No bills yet"
            message="Your bills and invoices will appear here"
          />
        ) : (
          <FlatList
            data={bills}
            keyExtractor={item => String(item.id)}
            renderItem={({item}) => (
              <BillCard
                bill={item}
                onPress={() => handleBillPress(item)}
                onDownload={() => handleDownload(item)}
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
    },
  });
}
