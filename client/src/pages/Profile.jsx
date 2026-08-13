import { useState, useEffect } from 'react'
import { userService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'

const Profile = () => {
  const { loadUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    currentPassword: '',
    newPassword: ''
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await userService.getProfile()
      setFormData({
        name: response.user.name || '',
        phone: response.user.phone || '',
        address: response.user.address || '',
        currentPassword: '',
        newPassword: ''
      })
    } catch (error) {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
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
      toast.success('Profile updated successfully')

      setFormData({ ...formData, currentPassword: '', newPassword: '' })
      await loadUser()
    } catch (error) {
      toast.error(error.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Profile</h1>

      <div className="max-w-2xl card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="input"
              rows={3}
            />
          </div>

          <hr className="my-6" />

          <h3 className="text-lg font-semibold text-gray-800">Change Password</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              className="input"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Profile
