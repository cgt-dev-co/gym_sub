import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || error)
  }
)

export const authService = {
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me')
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
  renew: (subscriptionId) =>
    api.post('/subscriptions/renew', { subscriptionId }),
  cancel: (subscriptionId) =>
    api.post('/subscriptions/cancel', { subscriptionId })
}

export const paymentService = {
  createPaymentIntent: (planId) =>
    api.post('/payments/create-payment-intent', { planId }),
  getHistory: () => api.get('/payments/history')
}

export default api
