import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {PARLOUR_BASE_URL} from './api.config';
import {navigationRef} from '../../../../navigation/RootNavigator';
import {CommonActions} from '@react-navigation/native';

const parlourApiClient = axios.create({
  baseURL: PARLOUR_BASE_URL,
  timeout: 30000,
  headers: {'Content-Type': 'application/json'},
});

parlourApiClient.interceptors.request.use(async config => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

parlourApiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await axios.post(`${PARLOUR_BASE_URL}/auth/refresh`, {refreshToken});
        const {accessToken, refreshToken: newRefresh} = res.data.data;
        await AsyncStorage.setItem('accessToken', accessToken);
        await AsyncStorage.setItem('refreshToken', newRefresh);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return parlourApiClient(originalRequest);
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user', 'loggedInUser']);
        navigationRef.dispatch(CommonActions.reset({index: 0, routes: [{name: 'Auth'}]}));
      }
    }
    return Promise.reject(error);
  },
);

export default parlourApiClient;
