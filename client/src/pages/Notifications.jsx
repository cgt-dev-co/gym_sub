import { useState, useEffect } from 'react'
import { notificationService } from '../services/api'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'
import { useFetch } from '../hooks/useFetch'

const typeStyles = {
  INFO: 'bg-blue-50 border-blue-200',
  WARNING: 'bg-yellow-50 border-yellow-200',
  SUCCESS: 'bg-green-50 border-green-200',
  PAYMENT: 'bg-purple-50 border-purple-200',
  SUBSCRIPTION: 'bg-orange-50 border-orange-200'
}

const typeIcons = {
  INFO: '💬',
  WARNING: '⚠️',
  SUCCESS: '✅',
  PAYMENT: '💳',
  SUBSCRIPTION: '🏋️'
}

const Notifications = () => {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const { data: fetchedNotifications, loading } = useFetch(
    () => notificationService.getAll(),
    true
  )

  useEffect(() => {
    if (fetchedNotifications) {
      setNotifications(fetchedNotifications.notifications)
      setUnreadCount(fetchedNotifications.unreadCount)
    }
  }, [fetchedNotifications])

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markRead(id)
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(c => Math.max(0, c - 1))
    } catch {
      toast.error('Failed to mark as read')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead()
      setNotifications(notifications.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to mark all as read')
    }
  }

  const handleDelete = async (id) => {
    try {
      await notificationService.delete(id)
      const n = notifications.find(n => n.id === id)
      setNotifications(notifications.filter(n => n.id !== id))
      if (n && !n.isRead) setUnreadCount(c => Math.max(0, c - 1))
    } catch {
      toast.error('Failed to delete notification')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn btn-secondary text-sm">
            Mark All Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🔔</p>
          <p className="text-gray-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`border rounded-xl p-4 flex items-start gap-4 transition-opacity ${typeStyles[n.type] || 'bg-gray-50 border-gray-200'} ${n.isRead ? 'opacity-70' : ''}`}
            >
              <span className="text-2xl flex-shrink-0">{typeIcons[n.type] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-semibold text-gray-800 ${!n.isRead ? 'font-bold' : ''}`}>
                    {n.title}
                    {!n.isRead && (
                      <span className="inline-block w-2 h-2 rounded-full bg-primary-500 ml-2 mb-0.5 align-middle" />
                    )}
                  </p>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{n.message}</p>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {!n.isRead && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Mark Read
                  </button>
                )}
                <button
                  onClick={() => handleDelete(n.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Notifications
