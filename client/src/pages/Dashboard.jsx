import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscriptionService, classService, progressService, notificationService } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'

const Dashboard = () => {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [upcomingClasses, setUpcomingClasses] = useState([])
  const [progressStats, setProgressStats] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const results = await Promise.allSettled([
        subscriptionService.getMy(),
        classService.getAll({ upcoming: 'true' }),
        progressService.getStats(),
        notificationService.getUnreadCount()
      ])

      if (results[0].status === 'fulfilled') setSubscription(results[0].value.subscription)
      if (results[1].status === 'fulfilled') setUpcomingClasses(results[1].value.classes.slice(0, 3))
      if (results[2].status === 'fulfilled') setProgressStats(results[2].value.stats)
      if (results[3].status === 'fulfilled') setUnreadCount(results[3].value.unreadCount)
    } catch {
      // errors handled per-item above
    } finally {
      setLoading(false)
    }
  }

  const getDaysRemaining = (endDate) => {
    const diff = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Welcome back, {user?.name}!
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600">
            {subscription ? getDaysRemaining(subscription.endDate) : '—'}
          </p>
          <p className="text-sm text-gray-600 mt-1">Days Left</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{upcomingClasses.length}</p>
          <p className="text-sm text-gray-600 mt-1">Upcoming Classes</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{progressStats?.recentLogs ?? 0}</p>
          <p className="text-sm text-gray-600 mt-1">Workouts (30d)</p>
        </div>
        <Link to="/notifications" className="card text-center hover:shadow-md transition-shadow">
          <p className="text-3xl font-bold text-orange-500">{unreadCount}</p>
          <p className="text-sm text-gray-600 mt-1">Unread Notifications</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Membership</h3>
          {subscription ? (
            <div>
              <p className="text-2xl font-bold text-primary-600">{subscription.plan.name}</p>
              <p className="text-sm text-green-600 font-medium mt-1">Active</p>
              <p className="text-sm text-gray-600 mt-1">
                {getDaysRemaining(subscription.endDate)} days remaining
              </p>
              <Link to="/my-subscription" className="block mt-3 text-sm text-primary-600 hover:underline">
                View details →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-3 text-sm">No active subscription</p>
              <Link to="/plans" className="btn btn-primary text-sm">Browse Plans</Link>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Upcoming Classes</h3>
          {upcomingClasses.length > 0 ? (
            <div className="space-y-2">
              {upcomingClasses.map(c => (
                <div key={c.id} className="flex justify-between items-start text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{c.name}</p>
                    <p className="text-gray-500 text-xs">{c.instructor}</p>
                  </div>
                  <p className="text-gray-500 text-xs ml-2 flex-shrink-0">
                    {new Date(c.schedule).toLocaleDateString()}
                  </p>
                </div>
              ))}
              <Link to="/classes" className="block mt-2 text-sm text-primary-600 hover:underline">
                View all classes →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-2">No upcoming classes scheduled</p>
              <Link to="/classes" className="text-sm text-primary-600 hover:underline">Browse classes →</Link>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Progress</h3>
          {progressStats && progressStats.totalLogs > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total workouts</span>
                <span className="font-semibold">{progressStats.totalLogs}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last 30 days</span>
                <span className="font-semibold">{progressStats.recentLogs}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg duration</span>
                <span className="font-semibold">{progressStats.avgDuration} min</span>
              </div>
              <Link to="/progress" className="block mt-2 text-sm text-primary-600 hover:underline">
                View full progress →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-2">No workouts logged yet</p>
              <Link to="/progress" className="text-sm text-primary-600 hover:underline">Start tracking →</Link>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <Link to="/my-subscription" className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
              View Subscription Details
            </Link>
            <Link to="/classes" className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
              Book a Class
            </Link>
            <Link to="/progress" className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
              Log a Workout
            </Link>
            <Link to="/plans" className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
              Explore Plans
            </Link>
            <Link to="/profile" className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
              Update Profile
            </Link>
          </div>
        </div>

        {subscription && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Plan Features</h3>
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

        {user?.role === 'ADMIN' && (
          <div className="card border-2 border-primary-200 bg-primary-50">
            <h3 className="text-lg font-semibold text-primary-700 mb-3">Admin</h3>
            <p className="text-sm text-primary-600 mb-3">You have admin access</p>
            <Link to="/admin" className="btn btn-primary text-sm">Open Admin Dashboard</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
