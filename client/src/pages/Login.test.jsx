import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import Login from './Login'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    login: vi.fn()
  }))
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  },
  ToastContainer: () => null
}))

const { useAuth } = await import('../context/AuthContext')
const { toast } = await import('react-toastify')

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
      <ToastContainer />
    </BrowserRouter>
  )
}

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  it('renders login form with email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('updates form state when user types in email field', async () => {
    const user = userEvent.setup()
    renderLogin()
    const emailInput = screen.getByLabelText(/email address/i)

    await user.type(emailInput, 'test@example.com')
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('updates form state when user types in password field', async () => {
    const user = userEvent.setup()
    renderLogin()
    const passwordInput = screen.getByLabelText(/password/i)

    await user.type(passwordInput, 'password123')
    expect(passwordInput).toHaveValue('password123')
  })

  it('calls login with correct email and password on form submit', async () => {
    const user = userEvent.setup()
    const mockLogin = vi.fn().mockResolvedValue({ user: { id: '1', email: 'test@example.com' } })
    useAuth.mockReturnValue({ login: mockLogin })

    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('shows success toast and navigates on successful login', async () => {
    const user = userEvent.setup()
    const mockLogin = vi.fn().mockResolvedValue({ user: { id: '1', email: 'test@example.com' } })
    useAuth.mockReturnValue({ login: mockLogin })

    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Login successful!')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('shows error toast on login failure', async () => {
    const user = userEvent.setup()
    const mockLogin = vi.fn().mockRejectedValue({ error: 'Invalid credentials' })
    useAuth.mockReturnValue({ login: mockLogin })

    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials')
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it('shows generic error message when error object lacks error property', async () => {
    const user = userEvent.setup()
    const mockLogin = vi.fn().mockRejectedValue({})
    useAuth.mockReturnValue({ login: mockLogin })

    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Login failed')
    })
  })

  it('disables submit button while loading', async () => {
    const user = userEvent.setup()
    const mockLogin = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )
    useAuth.mockReturnValue({ login: mockLogin })

    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)

    expect(submitButton).toBeDisabled()
  })

  it('shows "Signing in..." text while loading', async () => {
    const user = userEvent.setup()
    const mockLogin = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )
    useAuth.mockReturnValue({ login: mockLogin })

    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
  })

  it('renders link to registration page', () => {
    renderLogin()
    const registerLink = screen.getByRole('link', { name: /sign up/i })
    expect(registerLink).toHaveAttribute('href', '/register')
  })

  it('renders Google login button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('shows info toast when Google login is clicked', async () => {
    const user = userEvent.setup()
    renderLogin()

    const googleButton = screen.getByRole('button', { name: /continue with google/i })
    await user.click(googleButton)

    expect(toast.info).toHaveBeenCalledWith('Google authentication coming soon!')
  })
})
