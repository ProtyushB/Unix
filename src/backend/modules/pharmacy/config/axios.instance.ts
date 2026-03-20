import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {PHARMACY_BASE_URL} from './api.config';
import {navigationRef} from '../../../../navigation/RootNavigator';
import {CommonActions} from '@react-navigation/native';

const pharmacyApiClient = axios.create({
  baseURL: PHARMACY_BASE_URL,
  timeout: 30000,
  headers: {'Content-Type': 'application/json'},
});

pharmacyApiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

pharmacyApiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await axios.post(`${PHARMACY_BASE_URL}/auth/refresh`, {refreshToken});
        const {accessToken, refreshToken: newRefresh} = res.data.data;
        await AsyncStorage.setItem('accessToken', accessToken);
        await AsyncStorage.setItem('refreshToken', newRefresh);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return pharmacyApiClient(originalRequest);
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user', 'loggedInUser']);
        navigationRef.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Auth'}]}));
      }
    }
    return Promise.reject(error);
  },
);

export default pharmacyApiClient;
