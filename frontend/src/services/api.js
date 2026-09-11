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
  requestLoginOtp: (data) => api.post('/api/auth/login-otp/request', { ...data, deviceId: getDeviceId() }),
  loginWithOtp: (data) => api.post('/api/auth/login-otp/verify', { ...data, deviceId: getDeviceId(), deviceInfo: getDeviceInfo() }),
  forgotPassword: (data) => api.post('/api/auth/forgot-password', { ...data, deviceId: getDeviceId() }),
  resetPassword: (data) => api.post('/api/auth/reset-password', data),
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
  listClasses: (id) => api.get(`/api/events/${id}/classes`),
  addMembersByClass: (id, classes) => api.post(`/api/events/${id}/members/by-class`, { classes }),
  removeMember: (id, userId) => api.delete(`/api/events/${id}/members/${userId}`),
  // Người dùng đã đăng nhập tự ghi tên vào danh sách tham gia.
  register: (id) => api.post(`/api/events/${id}/register`),
};

// Quản lý lớp học (ADMIN/BTC)
export const classApi = {
  list: (params) => api.get('/api/classes', { params }),
  create: (data) => api.post('/api/classes', data),
  get: (id) => api.get(`/api/classes/${id}`),
  update: (id, data) => api.put(`/api/classes/${id}`, data),
  remove: (id) => api.delete(`/api/classes/${id}`),
  listMembers: (id, params) => api.get(`/api/classes/${id}/members`, { params }),
  searchAssignable: (id, params) => api.get(`/api/classes/${id}/members/search`, { params }),
  addMembers: (id, userIds) => api.post(`/api/classes/${id}/members`, { userIds }),
  removeMembers: (id, userIds) => api.post(`/api/classes/${id}/members/remove`, { userIds }),
  listSessions: (id) => api.get(`/api/classes/${id}/sessions`),
  createSession: (id, data) => api.post(`/api/classes/${id}/sessions`, data),
};

// Đăng ký tham gia sự kiện — không cần đăng nhập.
export const publicApi = {
  listEvents: (params) => api.get('/api/public/events', { params }),
  getEvent: (id) => api.get(`/api/public/events/${id}`),
  register: (id, data) => api.post(`/api/public/events/${id}/register`, data),
};

// Checkin
export const checkinApi = {
  // Đổi token QR lấy vé quét NGAY khi vừa quét (chưa cần đăng nhập) — xem
  // lib/scanTicket.js ở backend.
  issueTicket: (data) => api.post('/api/public/scan-ticket', { ...data, deviceId: getDeviceId() }),
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
  resetPassword: (id, data) => api.post(`/api/admin/users/${id}/reset-password`, data),
  resetDevice: (id) => api.post(`/api/admin/users/${id}/reset-device`),
  importStudents: (formData) => api.post('/api/admin/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Thao tác hàng loạt — payload luôn có userIds; response luôn { updated, skipped[] }.
  bulkUpdate: (userIds, patch) => api.post('/api/admin/users/bulk/update', { userIds, ...patch }),
  bulkResetPassword: (userIds) => api.post('/api/admin/users/bulk/reset-password', { userIds }),
  bulkResetDevice: (userIds) => api.post('/api/admin/users/bulk/reset-device', { userIds }),
  bulkDelete: (userIds) => api.post('/api/admin/users/bulk/delete', { userIds }),
};

// Reports
export const reportApi = {
  exportAttendance: (eventId) => api.get(`/api/reports/events/${eventId}/export`, { responseType: 'blob' }),
  exportAttendanceHtml: (eventId) => api.get(`/api/reports/events/${eventId}/export-html`, { responseType: 'blob' }),
  getFraudLogs: (params) => api.get('/api/reports/fraud-logs', { params }),
};

export default api;
