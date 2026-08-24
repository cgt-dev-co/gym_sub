import { useState, useEffect } from 'react'
import { classService } from '../services/api'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'

const ClassCard = ({ gymClass, onBook, onCancel, booking }) => {
  const isPast = new Date(gymClass.schedule) < new Date()
  const isFull = gymClass.spotsLeft <= 0

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-lg">{gymClass.name}</h3>
          <span className="inline-block text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full mt-1">
            {gymClass.classType}
          </span>
        </div>
        {gymClass.isBooked && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
            Booked
          </span>
        )}
        {isFull && !gymClass.isBooked && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
            Full
          </span>
        )}
      </div>

      {gymClass.description && (
        <p className="text-sm text-gray-600 mb-3">{gymClass.description}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-4">
        <div>
          <span className="font-medium">Instructor:</span> {gymClass.instructor}
        </div>
        <div>
          <span className="font-medium">Duration:</span> {gymClass.duration} min
        </div>
        <div>
          <span className="font-medium">Date:</span>{' '}
          {new Date(gymClass.schedule).toLocaleDateString()}
        </div>
        <div>
          <span className="font-medium">Time:</span>{' '}
          {new Date(gymClass.schedule).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div>
          <span className="font-medium">Spots left:</span>{' '}
          <span className={isFull ? 'text-red-600' : 'text-green-600'}>
            {gymClass.spotsLeft} / {gymClass.capacity}
          </span>
        </div>
      </div>

      {!isPast && (
        gymClass.isBooked ? (
          <button
            onClick={() => onCancel(gymClass.id)}
            className="btn btn-secondary text-sm w-full"
          >
            Cancel Booking
          </button>
        ) : (
          <button
            onClick={() => onBook(gymClass.id)}
            disabled={isFull}
            className="btn btn-primary text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFull ? 'Class Full' : 'Book Class'}
          </button>
        )
      )}

      {isPast && (
        <p className="text-sm text-gray-400 text-center">This class has passed</p>
      )}
    </div>
  )
}

const Classes = () => {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('upcoming')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newClass, setNewClass] = useState({
    name: '', description: '', instructor: '', capacity: 20,
    classType: 'Yoga', schedule: '', duration: 60
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadClasses()
  }, [view])

  const loadClasses = async () => {
    setLoading(true)
    try {
      const params = view === 'upcoming' ? { upcoming: 'true' } : {}
      const [classRes, bookingRes] = await Promise.all([
        classService.getAll(params),
        classService.getMyBookings()
      ])
      setClasses(classRes.classes)
      setMyBookings(bookingRes.bookings)
    } catch {
      toast.error('Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  const handleBook = async (classId) => {
    try {
      await classService.book(classId)
      toast.success('Class booked successfully!')
      loadClasses()
    } catch (err) {
      toast.error(err.error || 'Failed to book class')
    }
  }

  const handleCancel = async (classId) => {
    try {
      await classService.cancelBooking(classId)
      toast.success('Booking cancelled')
      loadClasses()
    } catch {
      toast.error('Failed to cancel booking')
    }
  }

  const handleAddClass = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await classService.create(newClass)
      toast.success('Class created')
      setShowAddForm(false)
      setNewClass({ name: '', description: '', instructor: '', capacity: 20, classType: 'Yoga', schedule: '', duration: 60 })
      loadClasses()
    } catch {
      toast.error('Failed to create class')
    } finally {
      setSaving(false)
    }
  }

  const classTypes = ['Yoga', 'HIIT', 'Pilates', 'Spinning', 'Zumba', 'Boxing', 'CrossFit', 'Swimming']

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Classes</h1>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary text-sm"
          >
            {showAddForm ? 'Cancel' : '+ Add Class'}
          </button>
        )}
      </div>

      {showAddForm && user?.role === 'ADMIN' && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">New Class</h3>
          <form onSubmit={handleAddClass} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" className="input" value={newClass.name}
                onChange={e => setNewClass({ ...newClass, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
              <input type="text" className="input" value={newClass.instructor}
                onChange={e => setNewClass({ ...newClass, instructor: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select className="input" value={newClass.classType}
                onChange={e => setNewClass({ ...newClass, classType: e.target.value })}>
                {classTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
              <input type="datetime-local" className="input" value={newClass.schedule}
                onChange={e => setNewClass({ ...newClass, schedule: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input type="number" className="input" value={newClass.capacity} min="1"
                onChange={e => setNewClass({ ...newClass, capacity: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
              <input type="number" className="input" value={newClass.duration} min="15"
                onChange={e => setNewClass({ ...newClass, duration: parseInt(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea className="input" rows={2} value={newClass.description}
                onChange={e => setNewClass({ ...newClass, description: e.target.value })} />
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Creating...' : 'Create Class'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex space-x-2 mb-6">
        {['upcoming', 'all', 'my-bookings'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {v === 'upcoming' ? 'Upcoming' : v === 'all' ? 'All Classes' : 'My Bookings'}
          </button>
        ))}
      </div>

      {view === 'my-bookings' ? (
        myBookings.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No bookings yet. Browse upcoming classes to get started!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myBookings.map(b => (
              <ClassCard
                key={b.id}
                gymClass={{ ...b.gymClass, isBooked: b.status === 'CONFIRMED', spotsLeft: 1 }}
                onBook={handleBook}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )
      ) : (
        classes.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No classes available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map(c => (
              <ClassCard key={c.id} gymClass={c} onBook={handleBook} onCancel={handleCancel} />
            ))}
          </div>
        )
      )}
    </div>
  )
}

export default Classes
