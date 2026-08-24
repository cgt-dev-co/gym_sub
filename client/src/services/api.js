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
  updateProfile: (data) => api.put('/users/profile', data)
}

export const planService = {
  getAll: () => api.get('/plans'),
  getById: (id) => api.get(`/plans/${id}`),
  create: (data) => api.post('/plans', data),
  update: (id, data) => api.put(`/plans/${id}`, data),
  delete: (id) => api.delete(`/plans/${id}`)
}

export const subscriptionService = {
  getMy: () => api.get('/subscriptions/my-subscription'),
  getHistory: () => api.get('/subscriptions/history'),
  purchase: (planId, paymentIntentId) =>
    api.post('/subscriptions/purchase', { planId, paymentIntentId }),
  renew: (subscriptionId, paymentIntentId) =>
    api.post('/subscriptions/renew', { subscriptionId, paymentIntentId }),
  cancel: (subscriptionId) =>
    api.post('/subscriptions/cancel', { subscriptionId })
}

export const paymentService = {
  createPaymentIntent: (planId) =>
    api.post('/payments/create-payment-intent', { planId }),
  getHistory: () => api.get('/payments/history')
}

export const adminService = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getAllSubscriptions: (params) => api.get('/admin/subscriptions', { params })
}

export const classService = {
  getAll: (params) => api.get('/classes', { params }),
  getMyBookings: () => api.get('/classes/my-bookings'),
  book: (classId) => api.post('/classes/book', { classId }),
  cancelBooking: (classId) => api.delete(`/classes/cancel/${classId}`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  deactivate: (id) => api.delete(`/classes/${id}`)
}

export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  broadcast: (data) => api.post('/notifications/broadcast', data)
}

export const progressService = {
  getLogs: (params) => api.get('/progress', { params }),
  getStats: () => api.get('/progress/stats'),
  createLog: (data) => api.post('/progress', data),
  updateLog: (id, data) => api.put(`/progress/${id}`, data),
  deleteLog: (id) => api.delete(`/progress/${id}`)
}

export default api
