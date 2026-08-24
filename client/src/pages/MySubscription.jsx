import { useState, useEffect } from 'react'
import { subscriptionService } from '../services/api'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'
import { Link } from 'react-router-dom'

const MySubscription = () => {
  const [subscription, setSubscription] = useState(null)
  const [health, setHealth] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPauseForm, setShowPauseForm] = useState(false)
  const [pauseDays, setPauseDays] = useState(7)
  const [pausing, setPausing] = useState(false)
  const [resuming, setResuming] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [subRes, historyRes, healthRes] = await Promise.all([
        subscriptionService.getMy(),
        subscriptionService.getHistory(),
        subscriptionService.getHealth()
      ])
      setSubscription(subRes.subscription)
      setHistory(historyRes.subscriptions)
      setHealth(healthRes.health)
    } catch {
      toast.error('Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You will keep access until the end date.')) return
    try {
      await subscriptionService.cancel(subscription.id)
      toast.success('Subscription cancelled')
      loadData()
    } catch (error) {
      toast.error(error.error || 'Failed to cancel subscription')
    }
  }

  const handlePause = async () => {
    setPausing(true)
    try {
      await subscriptionService.pause(subscription.id, pauseDays)
      toast.success(`Subscription paused for ${pauseDays} days`)
      setShowPauseForm(false)
      loadData()
    } catch (err) {
      toast.error(err.error || 'Failed to pause subscription')
    } finally {
      setPausing(false)
    }
  }

  const handleResume = async () => {
    setResuming(true)
    try {
      await subscriptionService.resume(subscription.id)
      toast.success('Subscription resumed!')
      loadData()
    } catch (err) {
      toast.error(err.error || 'Failed to resume subscription')
    } finally {
      setResuming(false)
    }
  }

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const getStatusColor = (status) => {
    const colors = {
      ACTIVE: 'text-green-600 bg-green-100',
      PAUSED: 'text-yellow-600 bg-yellow-100',
      EXPIRED: 'text-red-600 bg-red-100',
      CANCELLED: 'text-gray-600 bg-gray-100',
      PENDING: 'text-blue-600 bg-blue-100'
    }
    return colors[status] || 'text-gray-600 bg-gray-100'
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">My Subscription</h1>

      {subscription ? (
        <div className="space-y-6">
          <div className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{subscription.plan.name}</h2>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getStatusColor(subscription.status)}`}>
                  {subscription.status}
                </span>
              </div>
              <p className="text-2xl font-bold text-primary-600">${subscription.plan.price}</p>
            </div>

            {health && (
              <div className="mb-5">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Time used</span>
                  <span className="font-medium">{health.daysRemaining} days remaining ({100 - health.percentUsed}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      health.daysRemaining <= 7 ? 'bg-red-500' : health.daysRemaining <= 14 ? 'bg-orange-400' : 'bg-primary-500'
                    }`}
                    style={{ width: `${health.percentUsed}%` }}
                  />
                </div>
                {health.warningLevel === 'critical' && (
                  <p className="text-xs text-red-600 mt-1 font-medium">Expiring soon! Renew to avoid interruption.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-sm text-gray-500">Start Date</p>
                <p className="font-medium">{formatDate(subscription.startDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">End Date</p>
                <p className="font-medium">{formatDate(subscription.endDate)}</p>
              </div>
              {health?.isPaused && (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Paused On</p>
                    <p className="font-medium">{formatDate(health.pausedAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Resumes On</p>
                    <p className="font-medium text-yellow-700">{formatDate(health.resumeDate)}</p>
                  </div>
                </>
              )}
            </div>

            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-700 mb-2">Included Features</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {subscription.plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <span className="text-primary-600 mr-2">✓</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-3">
              {subscription.status === 'ACTIVE' && !health?.isPaused && (
                <button onClick={() => setShowPauseForm(!showPauseForm)} className="btn btn-secondary text-sm">
                  Pause Subscription
                </button>
              )}
              {health?.isPaused && (
                <button onClick={handleResume} disabled={resuming} className="btn btn-primary text-sm">
                  {resuming ? 'Resuming…' : 'Resume Early'}
                </button>
              )}
              {(subscription.status === 'ACTIVE' || subscription.status === 'PAUSED') && (
                <button onClick={handleCancel} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  Cancel Subscription
                </button>
              )}
              <Link to="/plans" className="btn btn-secondary text-sm">View Plans</Link>
            </div>

            {showPauseForm && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">Pause Subscription</h4>
                <p className="text-sm text-yellow-700 mb-3">
                  Your end date will be extended by the pause duration. You can pause up to 30 days.
                </p>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 font-medium">Pause for:</label>
                  <input type="number" className="input w-24 text-sm" min={1} max={30} value={pauseDays}
                    onChange={e => setPauseDays(parseInt(e.target.value))} />
                  <span className="text-sm text-gray-600">days</span>
                  <button onClick={handlePause} disabled={pausing} className="btn btn-primary text-sm">
                    {pausing ? 'Pausing…' : 'Confirm Pause'}
                  </button>
                  <button onClick={() => setShowPauseForm(false)} className="btn btn-secondary text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {health && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Activity This Month</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-600">{health.workoutsThisMonth}</p>
                  <p className="text-sm text-gray-500">Workouts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{health.classesThisMonth}</p>
                  <p className="text-sm text-gray-500">Classes</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">You don't have an active subscription</p>
          <Link to="/plans" className="btn btn-primary">Browse Plans</Link>
        </div>
      )}

      {history.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Subscription History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Plan', 'Status', 'Start Date', 'End Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map(sub => (
                  <tr key={sub.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{sub.plan.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(sub.startDate)}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDate(sub.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default MySubscription
