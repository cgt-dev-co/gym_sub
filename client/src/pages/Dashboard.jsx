import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscriptionService, classService, progressService, notificationService } from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { useMultiFetch } from '../hooks/useFetch'

const TIPS = [
  'Consistency beats perfection. Showing up every day matters more than any single workout.',
  'Rest is part of training. Muscles grow during recovery, not just during exercise.',
  'Hydration improves performance by up to 10%. Drink water before, during, and after.',
  'Progressive overload is key — add a little more weight or reps each week.',
  'Warm up properly to reduce injury risk and improve performance.',
  'Sleep 7–9 hours. Growth hormone peaks during deep sleep.',
  'Track your workouts — what gets measured, gets improved.',
  'Protein within 30 minutes of training accelerates muscle repair.'
]

const StreakBadge = ({ streak }) => {
  if (!streak) return null
  const color = streak >= 30 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : streak >= 14 ? 'text-orange-600 bg-orange-50 border-orange-200'
    : streak >= 7 ? 'text-green-600 bg-green-50 border-green-200'
    : 'text-blue-600 bg-blue-50 border-blue-200'
  const fire = streak >= 30 ? '🔥' : streak >= 14 ? '⚡' : streak >= 7 ? '✨' : '💪'
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-semibold ${color}`}>
      {fire} {streak}-day streak
    </span>
  )
}

const GoalProgressBar = ({ goal }) => {
  const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
  const isComplete = goal.status === 'COMPLETED' || pct >= 100
  const barColor = isComplete ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-primary-500'
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span className="font-medium truncate mr-2">{goal.title}</span>
        <span className="flex-shrink-0">{goal.currentValue}/{goal.targetValue} {goal.unit}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const Dashboard = () => {
  const { user } = useAuth()
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  const { results, loading } = useMultiFetch([
    { name: 'subscription', fn: () => subscriptionService.getMy() },
    { name: 'subscriptionHealth', fn: () => subscriptionService.getHealth() },
    { name: 'classes', fn: () => classService.getAll({ upcoming: 'true' }) },
    { name: 'stats', fn: () => progressService.getStats() },
    { name: 'streak', fn: () => progressService.getStreak() },
    { name: 'goals', fn: () => progressService.getGoals() },
    { name: 'notifications', fn: () => notificationService.getUnreadCount() }
  ])

  const subscription = results.subscription?.data?.subscription || null
  const subscriptionHealth = results.subscriptionHealth?.data?.health || null
  const upcomingClasses = results.classes?.data?.classes?.slice(0, 3) || []
  const progressStats = results.stats?.data?.stats || null
  const streak = results.streak?.data || null
  const goals = results.goals?.data?.goals?.filter(g => g.status === 'ACTIVE').slice(0, 3) || []
  const unreadCount = results.notifications?.data?.unreadCount || 0

  const getDaysRemaining = (endDate) => {
    const diff = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  if (loading) return <LoadingSpinner />

  const daysRemaining = subscription ? getDaysRemaining(subscription.endDate) : null
  const warningLevel = subscriptionHealth?.warningLevel

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Welcome back, {user?.name}!
        </h1>
        {streak?.currentStreak > 0 && <StreakBadge streak={streak.currentStreak} />}
      </div>

      {subscriptionHealth?.isPaused && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <span className="font-semibold">Subscription paused</span> — resumes on {new Date(subscriptionHealth.resumeDate).toLocaleDateString()}.{' '}
          <Link to="/my-subscription" className="underline">Manage →</Link>
        </div>
      )}

      {warningLevel === 'critical' && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <span className="font-semibold">Subscription expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}!</span>{' '}
          <Link to="/my-subscription" className="underline">Renew now →</Link>
        </div>
      )}
      {warningLevel === 'warning' && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
          <span className="font-semibold">Subscription expires in {daysRemaining} days.</span>{' '}
          <Link to="/my-subscription" className="underline">Renew to keep access →</Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card text-center">
          <p className={`text-3xl font-bold ${warningLevel === 'critical' ? 'text-red-600' : warningLevel === 'warning' ? 'text-orange-500' : 'text-primary-600'}`}>
            {daysRemaining !== null ? daysRemaining : '—'}
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
              <p className={`text-sm font-medium mt-1 ${subscriptionHealth?.isPaused ? 'text-yellow-600' : 'text-green-600'}`}>
                {subscriptionHealth?.isPaused ? 'Paused' : 'Active'}
              </p>
              {subscriptionHealth && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Usage</span>
                    <span>{subscriptionHealth.percentUsed}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${subscriptionHealth.percentUsed > 80 ? 'bg-orange-500' : 'bg-primary-500'}`}
                      style={{ width: `${subscriptionHealth.percentUsed}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-2">{daysRemaining} days remaining</p>
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
                    <p className="text-gray-500 text-xs">{c.instructor} · {c.duration}min</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-gray-500 text-xs">{new Date(c.schedule).toLocaleDateString()}</p>
                    <p className="text-xs text-green-600">{c.spotsLeft} spots</p>
                  </div>
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
              {streak?.longestStreak > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Longest streak</span>
                  <span className="font-semibold">{streak.longestStreak} days</span>
                </div>
              )}
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

        {goals.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-700">Active Goals</h3>
              <Link to="/progress" className="text-xs text-primary-600 hover:underline">Manage →</Link>
            </div>
            {goals.map(goal => (
              <GoalProgressBar key={goal.id} goal={goal} />
            ))}
          </div>
        )}

        <div className="card bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-100">
          <h3 className="text-sm font-semibold text-primary-700 mb-2 uppercase tracking-wide">Daily Tip</h3>
          <p className="text-sm text-gray-700 leading-relaxed italic">"{tip}"</p>
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

        {subscriptionHealth && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">This Month</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Workouts logged</span>
                <span className="font-semibold">{subscriptionHealth.workoutsThisMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Classes booked</span>
                <span className="font-semibold">{subscriptionHealth.classesThisMonth}</span>
              </div>
            </div>
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
