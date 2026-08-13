import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscriptionService } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'

const Dashboard = () => {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    try {
      const response = await subscriptionService.getMy()
      setSubscription(response.subscription)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysRemaining = (endDate) => {
    const end = new Date(endDate)
    const now = new Date()
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Welcome back, {user?.name}!
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Membership Status
          </h3>
          {subscription ? (
            <div>
              <p className="text-3xl font-bold text-primary-600">
                {subscription.plan.name}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Status: <span className="font-medium text-green-600">Active</span>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Days remaining: {getDaysRemaining(subscription.endDate)}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-3">No active subscription</p>
              <Link to="/plans" className="btn btn-primary text-sm">
                Browse Plans
              </Link>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Link
              to="/my-subscription"
              className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
            >
              View Subscription Details
            </Link>
            <Link
              to="/plans"
              className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
            >
              Explore Plans
            </Link>
            <Link
              to="/profile"
              className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
            >
              Update Profile
            </Link>
          </div>
        </div>

        {subscription && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Plan Features
            </h3>
            <ul className="space-y-1 text-sm">
              {subscription.plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-primary-600 mr-2">✓</span>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
