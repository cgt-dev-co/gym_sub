import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

const Layout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
        isActive(to)
          ? 'border-primary-500 text-gray-900'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center text-xl font-bold text-primary-600">
                GymFit
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-6">
                {navLink('/', 'Dashboard')}
                {navLink('/plans', 'Plans')}
                {navLink('/my-subscription', 'My Subscription')}
                {navLink('/classes', 'Classes')}
                {navLink('/progress', 'Progress')}
                {user?.role === 'ADMIN' && navLink('/admin', 'Admin')}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <span className="text-sm text-gray-700">{user?.name}</span>
              <Link to="/profile" className="text-sm text-gray-700 hover:text-primary-600">
                Profile
              </Link>
              <button onClick={logout} className="btn btn-secondary text-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
