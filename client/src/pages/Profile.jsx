import { useState, useEffect } from 'react'
import { userService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'
import { useNavigate } from 'react-router-dom'

const Profile = () => {
  const { loadUser, user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activity, setActivity] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    avatarUrl: '',
    currentPassword: '',
    newPassword: ''
  })
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('')
  const [showDeleteSection, setShowDeleteSection] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadProfile()
    loadActivity()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await userService.getProfile()
      setFormData({
        name: response.user.name || '',
        phone: response.user.phone || '',
        address: response.user.address || '',
        avatarUrl: response.user.avatarUrl || '',
        currentPassword: '',
        newPassword: ''
      })
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const loadActivity = async () => {
    try {
      const res = await userService.getActivity()
      setActivity(res.activity)
    } catch {
      // non-critical
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address
      }

      if (formData.newPassword) {
        if (!formData.currentPassword) {
          toast.error('Current password is required to change password')
          setSaving(false)
          return
        }
        updateData.currentPassword = formData.currentPassword
        updateData.newPassword = formData.newPassword
      }

      await userService.updateProfile(updateData)

      if (formData.avatarUrl !== (user?.avatarUrl || '')) {
        await userService.updateAvatar(formData.avatarUrl || null)
      }

      toast.success('Profile updated successfully')
      setFormData({ ...formData, currentPassword: '', newPassword: '' })
      await loadUser()
    } catch (error) {
      toast.error(error.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirmPassword) {
      toast.error('Enter your password to confirm deletion')
      return
    }
    if (!window.confirm('This will permanently delete your account and all data. Are you absolutely sure?')) return

    setDeleting(true)
    try {
      await userService.deleteAccount(deleteConfirmPassword)
      toast.success('Account deleted')
      navigate('/login')
    } catch (err) {
      toast.error(err.error || 'Failed to delete account')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Profile</h1>

      <div className="flex space-x-2 mb-6 border-b">
        {['profile', 'activity', 'danger'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              activeTab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'danger' ? 'Account' : t}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="max-w-2xl">
          <div className="card mb-6 flex items-center gap-4">
            {formData.avatarUrl ? (
              <img src={formData.avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-primary-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600">
                {formData.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-800">{formData.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user?.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                {user?.role}
              </span>
            </div>
          </div>

          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} className="input" rows={3} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
                <input type="url" name="avatarUrl" value={formData.avatarUrl} onChange={handleChange}
                  className="input" placeholder="https://example.com/photo.jpg" />
                <p className="text-xs text-gray-400 mt-1">Must be a public http/https URL</p>
              </div>

              <hr className="my-2" />
              <h3 className="text-lg font-semibold text-gray-800">Change Password</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input type="password" name="currentPassword" value={formData.currentPassword} onChange={handleChange} className="input" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} className="input" minLength={6} />
              </div>

              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="max-w-2xl">
          {activity ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="card text-center">
                  <p className="text-3xl font-bold text-primary-600">{activity.totalWorkouts}</p>
                  <p className="text-sm text-gray-500 mt-1">Workouts (30d)</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-green-600">{activity.workoutDays}</p>
                  <p className="text-sm text-gray-500 mt-1">Active Days</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-blue-600">{activity.classesAttended}</p>
                  <p className="text-sm text-gray-500 mt-1">Classes Booked</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-purple-600">{Math.round(activity.totalWorkoutMinutes / 60)}h</p>
                  <p className="text-sm text-gray-500 mt-1">Total Hours</p>
                </div>
                <div className="card text-center">
                  <p className="text-3xl font-bold text-orange-500">{activity.avgWorkoutMinutes}min</p>
                  <p className="text-sm text-gray-500 mt-1">Avg Duration</p>
                </div>
                <div className="card text-center">
                  <p className={`text-3xl font-bold ${activity.hasActiveSubscription ? 'text-green-600' : 'text-gray-400'}`}>
                    {activity.hasActiveSubscription ? 'Active' : 'None'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Subscription</p>
                </div>
              </div>

              {activity.weeklyBreakdown.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">Weekly Breakdown</h3>
                  <div className="space-y-2">
                    {activity.weeklyBreakdown.slice(-4).map((week, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Week of {new Date(week.week).toLocaleDateString()}</span>
                        <span className="text-gray-800 font-medium">{week.count} workouts · {week.minutes}min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-12 text-gray-400">Loading activity…</div>
          )}
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="max-w-2xl space-y-4">
          <div className="card border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Account Information</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Email:</span> {user?.email}</p>
              <p><span className="font-medium">Role:</span> {user?.role}</p>
              <p><span className="font-medium">Member since:</span> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</p>
            </div>
          </div>

          <div className="card border border-red-100 bg-red-50">
            <h3 className="text-lg font-semibold text-red-700 mb-2">Delete Account</h3>
            <p className="text-sm text-red-600 mb-4">
              Permanently delete your account and all associated data including subscriptions, workout logs, and bookings. This action cannot be undone.
            </p>
            {!showDeleteSection ? (
              <button onClick={() => setShowDeleteSection(true)} className="text-sm text-red-600 underline hover:text-red-800">
                I want to delete my account
              </button>
            ) : (
              <div className="space-y-3">
                <input type="password" className="input border-red-200" placeholder="Enter your password to confirm"
                  value={deleteConfirmPassword} onChange={e => setDeleteConfirmPassword(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={handleDeleteAccount} disabled={deleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium disabled:opacity-50">
                    {deleting ? 'Deleting…' : 'Delete My Account'}
                  </button>
                  <button onClick={() => { setShowDeleteSection(false); setDeleteConfirmPassword('') }}
                    className="btn btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Profile
