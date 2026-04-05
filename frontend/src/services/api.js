/**
 * API Service Layer
 * Handles all communication with backend API
 * 
 * Usage:
 * import apiClient from '@/services/api';
 * 
 * const response = await apiClient.get('/officers');
 * const response = await apiClient.post('/work-schedules', data);
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'hvktcnan_token';

/**
 * Get stored JWT token
 */
const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Store JWT token
 */
const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Remove token (logout)
 */
const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Build request headers with auth token
 */
const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Make HTTP request
 */
const request = async (method, endpoint, data = null) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: getHeaders(),
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
      // Handle error response from API
      const error = new Error(result.error || `HTTP ${response.status}`);
      error.code = result.code;
      error.status = response.status;
      throw error;
    }

    return result;
  } catch (error) {
    console.error(`API ${method} ${endpoint}:`, error);
    throw error;
  }
};

const parseFilenameFromDisposition = (disposition) => {
  if (!disposition) return null;

  // RFC 5987: filename*=UTF-8''...
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (e) {
      // Ignore and fall back to other patterns.
    }
  }

  const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] || null;
};

const buildFallbackFilename = (endpoint, contentType = '') => {
  const [path, rawQuery = ''] = endpoint.split('?');
  const params = new URLSearchParams(rawQuery);
  const type = params.get('type') || 'both';
  const scope = params.get('scope') || 'custom';
  const when = params.get('weekNo') || params.get('month') || 'all';
  const formatParam = params.get('format') || '';

  let ext = 'dat';
  if (formatParam === 'json' || contentType.includes('application/json')) ext = 'json';
  if (formatParam === 'csv' || contentType.includes('text/csv')) ext = 'csv';

  if (path.includes('/exports/download')) {
    return `lich_${type}_${scope}_${when}.${ext}`;
  }

  return `download.${ext}`;
};

const downloadRequest = async (endpoint) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      message = errBody.error || message;
    } catch (e) {
      // Ignore parse errors and keep fallback message.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || response.headers.get('content-disposition') || '';
  const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || '';
  const filename = parseFilenameFromDisposition(disposition) || buildFallbackFilename(endpoint, contentType);

  return { blob, filename };
};

/**
 * API Client Object
 */
const apiClient = {
  // Generic methods
  get: (endpoint, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request('GET', url);
  },

  post: (endpoint, data) => request('POST', endpoint, data),
  put: (endpoint, data) => request('PUT', endpoint, data),
  delete: (endpoint) => request('DELETE', endpoint),
  patch: (endpoint, data) => request('PATCH', endpoint, data),

  // ========== Authentication ==========
  auth: {
    login: (username, password) =>
      apiClient.post('/auth/login', { username, password }),

    logout: () => {
      removeToken();
      return apiClient.post('/auth/logout', {});
    },

    getProfile: () => apiClient.get('/auth/profile'),

    createUser: (data) => apiClient.post('/auth/users', data),
  },

  // ========== Officers / Cán bộ ==========
  officers: {
    list: (page = 1, limit = 10, filters = {}) =>
      apiClient.get('/officers', { page, limit, ...filters }),

    get: (id) => apiClient.get(`/officers/${id}`),

    create: (data) => apiClient.post('/officers', data),

    update: (id, data) => apiClient.put(`/officers/${id}`, data),

    delete: (id) => apiClient.delete(`/officers/${id}`),
  },

  // ========== Work Schedules / Lịch công tác ==========
  workSchedules: {
    list: (page = 1, limit = 20, filters = {}) =>
      apiClient.get('/work-schedules', { page, limit, ...filters }),

    get: (id) => apiClient.get(`/work-schedules/${id}`),

    create: (data) => apiClient.post('/work-schedules', data),

    approve: (id, status = 'approved') => apiClient.put(`/work-schedules/${id}/approve`, { status }),

    update: (id, data) => apiClient.put(`/work-schedules/${id}`, data),

    delete: (id) => apiClient.delete(`/work-schedules/${id}`),

    // Filters
    byWeek: (weekNo) =>
      apiClient.get('/work-schedules', { weekNo }),

    byDateRange: (startDate, endDate) =>
      apiClient.get('/work-schedules', { startDate, endDate }),

    byType: (type) =>
      apiClient.get('/work-schedules', { type }),
  },

  // ========== Duty Schedules / Lịch trực ban ==========
  dutySchedules: {
    list: (page = 1, limit = 20, filters = {}) =>
      apiClient.get('/duty-schedules', { page, limit, ...filters }),

    get: (id) => apiClient.get(`/duty-schedules/${id}`),

    create: (data) => apiClient.post('/duty-schedules', data),

    update: (id, data) => apiClient.put(`/duty-schedules/${id}`, data),

    delete: (id) => apiClient.delete(`/duty-schedules/${id}`),

    // Filters
    byOfficer: (officerId) =>
      apiClient.get('/duty-schedules', { officerId }),

    byWeek: (weekNo) =>
      apiClient.get('/duty-schedules', { weekNo }),

    byType: (dutyType) =>
      apiClient.get('/duty-schedules', { dutyType }),
  },

  // ========== Leave Requests / Xin nghỉ ==========
  leaveRequests: {
    list: (page = 1, limit = 20, filters = {}) =>
      apiClient.get('/leave-requests', { page, limit, ...filters }),

    get: (id) => apiClient.get(`/leave-requests/${id}`),

    submit: (data) => apiClient.post('/leave-requests', data),

    approve: (id, feedback = '') =>
      apiClient.put(`/leave-requests/${id}`, { status: 'approved', adminFeedback: feedback }),

    reject: (id, feedback = '') =>
      apiClient.put(`/leave-requests/${id}`, { status: 'rejected', adminFeedback: feedback }),

    delete: (id) => apiClient.delete(`/leave-requests/${id}`),

    byStatus: (status) =>
      apiClient.get('/leave-requests', { status }),
  },

  // Backward compatibility alias
  opinions: {
    list: (page = 1, limit = 20, filters = {}) =>
      apiClient.get('/leave-requests', { page, limit, ...filters }),
    get: (id) => apiClient.get(`/leave-requests/${id}`),
    submit: (data) => apiClient.post('/leave-requests', data),
    approve: (id, feedback = '') =>
      apiClient.put(`/leave-requests/${id}`, { status: 'approved', adminFeedback: feedback }),
    reject: (id, feedback = '') =>
      apiClient.put(`/leave-requests/${id}`, { status: 'rejected', adminFeedback: feedback }),
    delete: (id) => apiClient.delete(`/leave-requests/${id}`),
    byStatus: (status) =>
      apiClient.get('/leave-requests', { status }),
  },

  notifications: {
    list: (limit = 20, onlyUnread = false) =>
      apiClient.get('/notifications', { limit, onlyUnread }),

    markRead: (id) => apiClient.patch(`/notifications/${id}/read`, {}),

    markAllRead: () => apiClient.post('/notifications/mark-all-read', {}),
  },

  dashboard: {
    getOverview: () => apiClient.get('/dashboard/overview'),
  },

  holidays: {
    list: (filters = {}) => apiClient.get('/holidays', filters),
    create: (data) => apiClient.post('/holidays', data),
    update: (id, data) => apiClient.put(`/holidays/${id}`, data),
    delete: (id) => apiClient.delete(`/holidays/${id}`),
  },

  departments: {
    list: (filters = {}) => apiClient.get('/departments', filters),
    create: (data) => apiClient.post('/departments', data),
    update: (id, data) => apiClient.put(`/departments/${id}`, data),
    delete: (id) => apiClient.delete(`/departments/${id}`),
  },

  exports: {
    preview: (params = {}) => apiClient.get('/exports/preview', params),
    history: (limit = 20) => apiClient.get('/exports/history', { limit }),
    download: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      const endpoint = query ? `/exports/download?${query}` : '/exports/download';
      return downloadRequest(endpoint);
    },
  },

  // ========== Utilities ==========
  setAuthToken: setToken,
  getAuthToken: getToken,
  clearAuthToken: removeToken,
  setBaseURL: (url) => {
    API_BASE_URL = url;
  },
};

export default apiClient;
