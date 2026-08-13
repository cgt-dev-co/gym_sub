import { useState, useEffect } from 'react'
import { subscriptionService } from '../services/api'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'

const MySubscription = () => {
  const [subscription, setSubscription] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [subResponse, historyResponse] = await Promise.all([
        subscriptionService.getMy(),
        subscriptionService.getHistory()
      ])
      setSubscription(subResponse.subscription)
      setHistory(historyResponse.subscriptions)
    } catch (error) {
      toast.error('Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) {
      return
    }

    try {
      await subscriptionService.cancel(subscription.id)
      toast.success('Subscription cancelled')
      loadData()
    } catch (error) {
      toast.error(error.error || 'Failed to cancel subscription')
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusColor = (status) => {
    const colors = {
      ACTIVE: 'text-green-600 bg-green-100',
      EXPIRED: 'text-red-600 bg-red-100',
      CANCELLED: 'text-gray-600 bg-gray-100',
      PENDING: 'text-yellow-600 bg-yellow-100'
    }
    return colors[status] || 'text-gray-600 bg-gray-100'
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        My Subscription
      </h1>

      {subscription ? (
        <div className="card mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {subscription.plan.name}
              </h2>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getStatusColor(
                  subscription.status
                )}`}
              >
                {subscription.status}
              </span>
            </div>
            <p className="text-2xl font-bold text-primary-600">
              ${subscription.plan.price}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600">Start Date</p>
              <p className="font-medium">{formatDate(subscription.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">End Date</p>
              <p className="font-medium">{formatDate(subscription.endDate)}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Features</h3>
            <ul className="space-y-1">
              {subscription.plan.features.map((feature, index) => (
                <li key={index} className="flex items-start text-sm">
                  <span className="text-primary-600 mr-2">✓</span>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {subscription.status === 'ACTIVE' && (
            <button onClick={handleCancel} className="btn btn-danger">
              Cancel Subscription
            </button>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-600 mb-4">You don't have an active subscription</p>
          <a href="/plans" className="btn btn-primary">
            Browse Plans
          </a>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Subscription History
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    End Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((sub) => (
                  <tr key={sub.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {sub.plan.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          sub.status
                        )}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(sub.startDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(sub.endDate)}
                    </td>
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
