import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_PLATFORM_ADMIN_API || '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function login(username, password) {
  const response = await api.post('/platform-auth/login', { username, password });
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get('/platform-auth/me');
  return response.data;
}

export async function getOverview() {
  const response = await api.get('/platform/overview');
  return response.data;
}

export async function getPlatformUsers() {
  const response = await api.get('/platform/users');
  return response.data;
}

export async function createPlatformUser(payload) {
  const response = await api.post('/platform/users', payload);
  return response.data;
}

export async function getEnterprises() {
  const response = await api.get('/platform/enterprises');
  return response.data;
}

export async function getPlans() {
  const response = await api.get('/platform/plans');
  return response.data;
}

export async function getProviderCredentials() {
  const response = await api.get('/platform/provider-credentials');
  return response.data;
}

 export async function updateProviderCredentials(platformName, payload) {
  const response = await api.put(`/platform/provider-credentials/${platformName}`, payload);
  return response.data;
 }
