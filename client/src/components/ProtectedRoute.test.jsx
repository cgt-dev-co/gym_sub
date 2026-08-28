import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

const mockUseAuth = vi.fn()
vi.mock('../context/AuthContext', () => ({
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
