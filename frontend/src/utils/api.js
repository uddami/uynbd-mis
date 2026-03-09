/**
 * UYNBD MIS - API Service Layer (Updated)
 *
 * REPLACES: frontend/src/utils/api.js
 *
 * CHANGES FROM ORIGINAL:
 * - Added 5 new methods to eventsAPI:
 *     uploadReport, addNews, getNews, updateSpending, unlock
 * - All original code unchanged
 */

import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ─── Request Interceptor: Inject JWT ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('uynbd_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response Interceptor: Handle Errors ──────────────────────────────────────
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed';

    if (error.response?.status === 401) {
      localStorage.removeItem('uynbd_token');
      localStorage.removeItem('uynbd_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.response?.status !== 404) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

// ─── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ─── Members API ───────────────────────────────────────────────────────────────
export const membersAPI = {
  getAll: (params) => api.get('/members', { params }),
  getStats: () => api.get('/members/stats'),
  getOne: (id) => api.get(`/members/${id}`),
  create: (data) => api.post('/members', data),
  update: (id, data) => api.put(`/members/${id}`, data),
  promote: (id) => api.post(`/members/${id}/promote`),
  transfer: (id, data) => api.post(`/members/${id}/transfer`, data),
  assignRole: (id, data) => api.post(`/members/${id}/roles`, data),
  delete: (id, hard = false) => api.delete(`/members/${id}?hard_delete=${hard}`, {
    headers: { 'X-Destructive-Confirm': 'CONFIRMED' },
  }),
  runProbationCheck: () => api.get('/members/probation-check'),
};

// ─── Branches API ──────────────────────────────────────────────────────────────
export const branchesAPI = {
  getAll: (params) => api.get('/branches', { params }),
  getStats: () => api.get('/branches/stats'),
  getOne: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
};

// ─── Events API ────────────────────────────────────────────────────────────────
export const eventsAPI = {
  // ── Original methods (unchanged) ──────────────────────────────────────────
  getAll: (params) => api.get('/events', { params }),
  getStats: () => api.get('/events/stats'),
  getOne: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  advanceStatus: (id, data) => api.post(`/events/${id}/advance-status`, data),
  recordAttendance: (id, data) => api.post(`/events/${id}/attendance`, data),
  // ── New methods ───────────────────────────────────────────────────────────
  uploadReport: (id, data) => api.post(`/events/${id}/report`, data),
  addNews: (id, data) => api.post(`/events/${id}/news`, data),
  getNews: (id) => api.get(`/events/${id}/news`),
  updateSpending: (id, data) => api.post(`/events/${id}/spending`, data),
  unlock: (id, data) => api.post(`/events/${id}/unlock`, data),
};

// ─── Projects API ──────────────────────────────────────────────────────────────
export const projectsAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getOne: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  advanceStatus: (id, data) => api.post(`/projects/${id}/advance-status`, data),
};

// ─── Finance API ───────────────────────────────────────────────────────────────
export const financeAPI = {
  getAll: (params) => api.get('/finance', { params }),
  getDashboard: (params) => api.get('/finance/dashboard', { params }),
  getMemberStatus: (id) => api.get(`/finance/members/${id}/status`),
  recordPayment: (data) => api.post('/finance', data),
  runStatusUpdate: () => api.post('/finance/run-status-update'),
};

// ─── Documents API ─────────────────────────────────────────────────────────────
export const documentsAPI = {
  getAll: (params) => api.get('/documents', { params }),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`, {
    headers: { 'X-Destructive-Confirm': 'CONFIRMED' },
  }),
};

// ─── Sponsors API ──────────────────────────────────────────────────────────────
export const sponsorsAPI = {
  getAll: (params) => api.get('/sponsors', { params }),
  create: (data) => api.post('/sponsors', data),
};

// ─── Assets API ────────────────────────────────────────────────────────────────
export const assetsAPI = {
  getAll: (params) => api.get('/assets', { params }),
  create: (data) => api.post('/assets', data),
};

// ─── Analytics API ─────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getBranchAnalytics: (id) => api.get(`/analytics/branches/${id}`),
};

// ─── Audit API ─────────────────────────────────────────────────────────────────
export const auditAPI = {
  getLogs: (params) => api.get('/audit-logs', { params }),
};

// ─── Users API (Super Admin) ───────────────────────────────────────────────────
export const usersAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`, {
    headers: { 'X-Destructive-Confirm': 'CONFIRMED' },
  }),
};

export default api;
