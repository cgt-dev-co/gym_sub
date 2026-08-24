import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || error)
  }
)

export const authService = {
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout')
}

export const userService = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  getActivity: () => api.get('/users/activity'),
  updateAvatar: (avatarUrl) => api.put('/users/avatar', { avatarUrl }),
  deleteAccount: (password) => api.delete('/users/account', { data: { password } })
}

export const planService = {
  getAll: () => api.get('/plans'),
  getById: (id) => api.get(`/plans/${id}`),
  compare: (ids) => api.get('/plans/compare', { params: { ids: ids.join(',') } }),
  create: (data) => api.post('/plans', data),
  update: (id, data) => api.put(`/plans/${id}`, data),
  delete: (id) => api.delete(`/plans/${id}`)
}

export const subscriptionService = {
  getMy: () => api.get('/subscriptions/my-subscription'),
  getHistory: () => api.get('/subscriptions/history'),
  getHealth: () => api.get('/subscriptions/health'),
  purchase: (planId, paymentIntentId) =>
    api.post('/subscriptions/purchase', { planId, paymentIntentId }),
  renew: (subscriptionId, paymentIntentId) =>
    api.post('/subscriptions/renew', { subscriptionId, paymentIntentId }),
  cancel: (subscriptionId) =>
    api.post('/subscriptions/cancel', { subscriptionId }),
  pause: (subscriptionId, pauseDays) =>
    api.post('/subscriptions/pause', { subscriptionId, pauseDays }),
  resume: (subscriptionId) =>
    api.post('/subscriptions/resume', { subscriptionId })
}

export const paymentService = {
  createPaymentIntent: (planId) =>
    api.post('/payments/create-payment-intent', { planId }),
  getHistory: () => api.get('/payments/history'),
  getSummary: () => api.get('/payments/summary'),
  getReceipt: (id) => api.get(`/payments/receipt/${id}`)
}

export const adminService = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
  suspendUser: (id, reason) => api.put(`/admin/users/${id}/suspend`, { reason }),
  unsuspendUser: (id) => api.put(`/admin/users/${id}/unsuspend`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getAllSubscriptions: (params) => api.get('/admin/subscriptions', { params }),
  getRevenueAnalytics: (params) => api.get('/admin/analytics/revenue', { params }),
  getUserActivity: (params) => api.get('/admin/analytics/activity', { params }),
  getPlanPopularity: () => api.get('/admin/analytics/plans')
}

export const classService = {
  getAll: (params) => api.get('/classes', { params }),
  search: (params) => api.get('/classes/search', { params }),
  getMyBookings: () => api.get('/classes/my-bookings'),
  book: (classId) => api.post('/classes/book', { classId }),
  cancelBooking: (classId) => api.delete(`/classes/cancel/${classId}`),
  joinWaitlist: (classId) => api.post('/classes/waitlist', { classId }),
  leaveWaitlist: (classId) => api.delete(`/classes/waitlist/${classId}`),
  getRatings: (classId) => api.get(`/classes/${classId}/ratings`),
  rate: (classId, rating, review) => api.post(`/classes/${classId}/rate`, { rating, review }),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  deactivate: (id) => api.delete(`/classes/${id}`)
}

export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  getSummary: () => api.get('/notifications/summary'),
  getByType: (type, params) => api.get(`/notifications/type/${type}`, { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications/all'),
  broadcast: (data) => api.post('/notifications/broadcast', data)
}

export const progressService = {
  getLogs: (params) => api.get('/progress', { params }),
  getStats: () => api.get('/progress/stats'),
  getStreak: () => api.get('/progress/streak'),
  getPersonalRecords: () => api.get('/progress/personal-records'),
  createLog: (data) => api.post('/progress', data),
  updateLog: (id, data) => api.put(`/progress/${id}`, data),
  deleteLog: (id) => api.delete(`/progress/${id}`),
  getGoals: () => api.get('/progress/goals'),
  createGoal: (data) => api.post('/progress/goals', data),
  updateGoal: (id, data) => api.put(`/progress/goals/${id}`, data),
  deleteGoal: (id) => api.delete(`/progress/goals/${id}`)
}

export default api
