import { createContext, useState, useEffect, useContext } from 'react'
import { authService } from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const response = await authService.getMe()
      setUser(response.user)
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await authService.login(email, password)
    setUser(response.user)
    return response
  }

  const register = async (userData) => {
    const response = await authService.register(userData)
    setUser(response.user)
    return response
  }

  const logout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      // proceed with local logout even if the server call fails
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
