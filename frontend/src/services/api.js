import axios from 'axios';
import { getDeviceId, getDeviceInfo } from '../utils/device';

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1500;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  // 25 s gives backend cold-starts (free-tier sleep) enough time to respond.
  timeout: 25000,
});

// Attach auth token + device ID to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Device-ID'] = getDeviceId();
  return config;
});

// Handle 401 → logout; retry on 503 / network timeout (backend cold start).
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { config, response } = err;

    if (response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    // Retry transient failures: 503 Service Unavailable or network-level timeout.
    // This covers the backend waking from free-tier sleep mid-request.
    const isTransient =
      response?.status === 503 ||
      err.code === 'ECONNABORTED' || // axios timeout
      err.code === 'ERR_NETWORK';

    config._retryCount = config._retryCount ?? 0;

    if (isTransient && config._retryCount < MAX_RETRIES) {
      config._retryCount += 1;
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BASE_DELAY_MS * config._retryCount)
      );
      return api(config);
    }

    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (data) => api.post('/api/auth/login', { ...data, deviceId: getDeviceId(), deviceInfo: getDeviceInfo() }),
  verifyOtp: (data) => api.post('/api/auth/verify-otp', { ...data, deviceId: getDeviceId(), deviceInfo: getDeviceInfo() }),
  changePassword: (data) => api.post('/api/auth/change-password', data),
  getMe: () => api.get('/api/auth/me'),
};

// Events
export const eventApi = {
  list: (params) => api.get('/api/events', { params }),
  create: (data) => api.post('/api/events', data),
  get: (id) => api.get(`/api/events/${id}`),
  update: (id, data) => api.put(`/api/events/${id}`, data),
  delete: (id) => api.delete(`/api/events/${id}`),
  getQR: (id) => api.get(`/api/events/${id}/qr`),
  getAttendance: (id, params) => api.get(`/api/events/${id}/attendance`, { params }),
  manualCheckin: (id, data) => api.post(`/api/events/${id}/manual-checkin`, data),
  listMembers: (id, params) => api.get(`/api/events/${id}/members`, { params }),
  searchMembers: (id, q) => api.get(`/api/events/${id}/members/search`, { params: { q } }),
  addMembers: (id, userIds) => api.post(`/api/events/${id}/members`, { userIds }),
  removeMember: (id, userId) => api.delete(`/api/events/${id}/members/${userId}`),
};

// Checkin
export const checkinApi = {
  process: (data) => api.post('/api/checkin', { ...data, deviceId: getDeviceId() }),
  getStatus: (eventId) => api.get(`/api/checkin/status/${eventId}`),
};

// Admin
export const adminApi = {
  getStats: () => api.get('/api/admin/stats'),
  listUsers: (params) => api.get('/api/admin/users', { params }),
  createUser: (data) => api.post('/api/admin/users', data),
  updateUser: (id, data) => api.put(`/api/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`),
  resetDevice: (id) => api.post(`/api/admin/users/${id}/reset-device`),
  importStudents: (formData) => api.post('/api/admin/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// Reports
export const reportApi = {
  exportAttendance: (eventId) => api.get(`/api/reports/events/${eventId}/export`, { responseType: 'blob' }),
  getFraudLogs: (params) => api.get('/api/reports/fraud-logs', { params }),
};

export default api;
