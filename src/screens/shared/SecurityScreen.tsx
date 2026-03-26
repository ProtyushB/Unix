import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Shield, ChevronRight, ChevronLeft, Fingerprint} from 'lucide-react-native';
import {ScreenWrapper} from '../../components/layout/ScreenWrapper';
import {ProfileStackParamList} from '../../navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

export function SecurityScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <ChevronLeft size={24} color="#f8fafc" />
          </TouchableOpacity>
          <Text style={styles.title}>Security</Text>
        </View>

        {/* Rows */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('AuthMethods')}
          activeOpacity={0.7}>
          <View style={styles.rowIcon}>
            <Fingerprint size={20} color="#f97316" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Authentication Methods</Text>
            <Text style={styles.rowSub}>Fingerprint, Password</Text>
          </View>
          <ChevronRight size={18} color="#334155" />
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: 16},
  header: {flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 24, gap: 12},
  backBtn: {padding: 4},
  title: {fontSize: 28, fontWeight: '700', color: '#f8fafc'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {flex: 1},
  rowLabel: {fontSize: 16, fontWeight: '600', color: '#f8fafc'},
  rowSub: {fontSize: 13, color: '#64748b', marginTop: 2},
});
