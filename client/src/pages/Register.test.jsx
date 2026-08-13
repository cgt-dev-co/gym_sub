import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import Register from './Register'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    register: vi.fn()
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

const renderRegister = () => {
  return render(
    <BrowserRouter>
      <Register />
      <ToastContainer />
    </BrowserRouter>
  )
}

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  it('renders registration form with all required fields', () => {
    renderRegister()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
  })

  it('updates form state when user types in name field', async () => {
    const user = userEvent.setup()
    renderRegister()
    const nameInput = screen.getByLabelText(/full name/i)

    await user.type(nameInput, 'John Doe')
    expect(nameInput).toHaveValue('John Doe')
  })

  it('updates form state when user types in email field', async () => {
    const user = userEvent.setup()
    renderRegister()
    const emailInput = screen.getByLabelText(/^email$/i)

    await user.type(emailInput, 'john@example.com')
    expect(emailInput).toHaveValue('john@example.com')
  })

  it('updates form state when user types in password field', async () => {
    const user = userEvent.setup()
    renderRegister()
    const passwordInput = screen.getByLabelText(/^password$/i)

    await user.type(passwordInput, 'password123')
    expect(passwordInput).toHaveValue('password123')
  })

  it('updates form state when user types in phone field', async () => {
    const user = userEvent.setup()
    renderRegister()
    const phoneInput = screen.getByLabelText(/phone/i)

    await user.type(phoneInput, '5551234567')
    expect(phoneInput).toHaveValue('5551234567')
  })

  it('updates form state when user types in address field', async () => {
    const user = userEvent.setup()
    renderRegister()
    const addressInput = screen.getByLabelText(/address/i)

    await user.type(addressInput, '123 Main St')
    expect(addressInput).toHaveValue('123 Main St')
  })

  it('calls register with correct form data on submission', async () => {
    const user = userEvent.setup()
    const mockRegister = vi.fn().mockResolvedValue({ user: { id: '1', email: 'john@example.com' } })
    useAuth.mockReturnValue({ register: mockRegister })

    renderRegister()

    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/^email$/i), 'john@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.type(screen.getByLabelText(/phone/i), '5551234567')
    await user.type(screen.getByLabelText(/address/i), '123 Main St')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        phone: '5551234567',
        address: '123 Main St'
      })
    })
  })

  it('shows success toast and navigates on successful registration', async () => {
    const user = userEvent.setup()
    const mockRegister = vi.fn().mockResolvedValue({ user: { id: '1', email: 'john@example.com' } })
    useAuth.mockReturnValue({ register: mockRegister })

    renderRegister()

    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/^email$/i), 'john@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Registration successful!')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('shows error toast on registration failure with custom message', async () => {
    const user = userEvent.setup()
    const mockRegister = vi.fn().mockRejectedValue({ error: 'Email already exists' })
    useAuth.mockReturnValue({ register: mockRegister })

    renderRegister()

    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/^email$/i), 'existing@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Email already exists')
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it('shows generic error message when error object lacks error property', async () => {
    const user = userEvent.setup()
    const mockRegister = vi.fn().mockRejectedValue({})
    useAuth.mockReturnValue({ register: mockRegister })

    renderRegister()

    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/^email$/i), 'john@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Registration failed')
    })
  })

  it('disables submit button while loading', async () => {
    const user = userEvent.setup()
    const mockRegister = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )
    useAuth.mockReturnValue({ register: mockRegister })

    renderRegister()

    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/^email$/i), 'john@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')

    const submitButton = screen.getByRole('button', { name: /register/i })
    await user.click(submitButton)

    expect(submitButton).toBeDisabled()
  })

  it('shows "Creating Account..." text while loading', async () => {
    const user = userEvent.setup()
    const mockRegister = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )
    useAuth.mockReturnValue({ register: mockRegister })

    renderRegister()

    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/^email$/i), 'john@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument()
  })

  it('allows optional phone and address fields to be empty', async () => {
    const user = userEvent.setup()
    const mockRegister = vi.fn().mockResolvedValue({ user: { id: '1', email: 'john@example.com' } })
    useAuth.mockReturnValue({ register: mockRegister })

    renderRegister()

    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/^email$/i), 'john@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        phone: '',
        address: ''
      })
    })
  })

  it('enforces password minimum length of 6 characters', async () => {
    renderRegister()
    const passwordInput = screen.getByLabelText(/^password$/i)

    expect(passwordInput).toHaveAttribute('minlength', '6')
  })

  it('renders link to login page', () => {
    renderRegister()
    const loginLink = screen.getByRole('link', { name: /login/i })
    expect(loginLink).toHaveAttribute('href', '/login')
  })
})
