import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

const mockUseAuth = vi.fn()
vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockUseAuth()
}))

const unauthenticated = { user: null, loading: false }
const loading = { user: null, loading: true }
const authenticatedUser = { user: { id: '1', email: 'user@example.com', role: 'USER' }, loading: false }
const authenticatedAdmin = { user: { id: '2', email: 'admin@example.com', role: 'ADMIN' }, loading: false }

const renderProtectedRoute = (authState, initialPath = '/') => {
  mockUseAuth.mockReturnValue(authState)
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const renderAdminRoute = (authState) => {
  mockUseAuth.mockReturnValue(authState)
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/admin" element={<AdminRoute><div>Admin Content</div></AdminRoute>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated user to /login', () => {
    renderProtectedRoute(unauthenticated)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders a loading spinner while auth state resolves', () => {
    renderProtectedRoute(loading)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('renders children for authenticated user', () => {
    renderProtectedRoute(authenticatedUser)
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('renders children for authenticated admin user', () => {
    renderProtectedRoute(authenticatedAdmin)
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated user to /', () => {
    renderAdminRoute(unauthenticated)
    expect(screen.getByText('Home Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('redirects authenticated non-admin user to /', () => {
    renderAdminRoute(authenticatedUser)
    expect(screen.getByText('Home Page')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })

  it('renders a loading spinner while auth state resolves', () => {
    renderAdminRoute(loading)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument()
  })

  it('renders children for authenticated admin user', () => {
    renderAdminRoute(authenticatedAdmin)
    expect(screen.getByText('Admin Content')).toBeInTheDocument()
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument()
  })
})
