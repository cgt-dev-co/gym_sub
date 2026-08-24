import { useState, useEffect } from 'react'
import { adminService, notificationService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'
import { Navigate } from 'react-router-dom'

const StatCard = ({ label, value, color }) => (
  <div className="card text-center">
    <p className={`text-4xl font-bold ${color}`}>{value}</p>
    <p className="text-sm text-gray-600 mt-1">{label}</p>
  </div>
)

const Admin = () => {
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [broadcastData, setBroadcastData] = useState({ title: '', message: '', type: 'INFO' })
  const [sending, setSending] = useState(false)

  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />

  useEffect(() => {
    loadData()
  }, [tab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (tab === 'overview') {
        const res = await adminService.getStats()
        setStats(res)
      } else if (tab === 'users') {
        const res = await adminService.getUsers()
        setUsers(res.users)
      } else if (tab === 'subscriptions') {
        const res = await adminService.getAllSubscriptions()
        setSubscriptions(res.subscriptions)
      }
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminService.updateUserRole(userId, newRole)
      toast.success('User role updated')
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch {
      toast.error('Failed to update role')
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) return
    try {
      await adminService.deleteUser(userId)
      toast.success('User deleted')
      setUsers(users.filter(u => u.id !== userId))
    } catch {
      toast.error('Failed to delete user')
    }
  }

  const handleBroadcast = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      await notificationService.broadcast(broadcastData)
      toast.success('Notification sent to all users')
      setBroadcastData({ title: '', message: '', type: 'INFO' })
    } catch {
      toast.error('Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const tabs = ['overview', 'users', 'subscriptions', 'notifications']

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

      <div className="flex space-x-2 mb-6 border-b">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {tab === 'overview' && stats && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Total Members" value={stats.stats.totalUsers} color="text-blue-600" />
                <StatCard label="Active Subscriptions" value={stats.stats.activeSubscriptions} color="text-green-600" />
                <StatCard label="Total Revenue" value={`$${stats.stats.totalRevenue.toFixed(2)}`} color="text-purple-600" />
                <StatCard label="Class Bookings" value={stats.stats.pendingBookings} color="text-orange-600" />
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Sign-ups</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSignups.map(u => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-2">{u.name}</td>
                        <td className="py-2 text-gray-600">{u.email}</td>
                        <td className="py-2 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Plan</th>
                    <th className="pb-2">Joined</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{u.name}</td>
                      <td className="py-2 text-gray-600">{u.email}</td>
                      <td className="py-2">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="text-xs border rounded px-1 py-0.5"
                        >
                          <option value="USER">User</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td className="py-2 text-gray-600">
                        {u.subscriptions?.[0]?.plan?.name || '—'}
                      </td>
                      <td className="py-2 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="py-2">
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'subscriptions' && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Member</th>
                    <th className="pb-2">Plan</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Start</th>
                    <th className="pb-2">End</th>
                    <th className="pb-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(s => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2">
                        <div className="font-medium">{s.user.name}</div>
                        <div className="text-gray-500 text-xs">{s.user.email}</div>
                      </td>
                      <td className="py-2">{s.plan.name}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          s.status === 'EXPIRED' ? 'bg-red-100 text-red-700' :
                          s.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500">{s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}</td>
                      <td className="py-2 text-gray-500">{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                      <td className="py-2">${s.plan.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="max-w-lg card">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Broadcast Notification</h3>
              <form onSubmit={handleBroadcast} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={broadcastData.title}
                    onChange={e => setBroadcastData({ ...broadcastData, title: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={broadcastData.message}
                    onChange={e => setBroadcastData({ ...broadcastData, message: e.target.value })}
                    className="input"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={broadcastData.type}
                    onChange={e => setBroadcastData({ ...broadcastData, type: e.target.value })}
                    className="input"
                  >
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="SUCCESS">Success</option>
                    <option value="PAYMENT">Payment</option>
                    <option value="SUBSCRIPTION">Subscription</option>
                  </select>
                </div>
                <button type="submit" disabled={sending} className="btn btn-primary">
                  {sending ? 'Sending...' : 'Send to All Members'}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Admin
