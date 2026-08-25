import { useState, useEffect } from 'react'
import { classService } from '../services/api'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'

const StarRating = ({ value, interactive = false, onChange }) => {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type={interactive ? 'button' : undefined}
          onClick={interactive ? () => onChange(star) : undefined}
          onMouseEnter={interactive ? () => setHover(star) : undefined}
          onMouseLeave={interactive ? () => setHover(0) : undefined}
          className={`text-lg leading-none ${interactive ? 'cursor-pointer' : 'cursor-default'} ${
            star <= (hover || value) ? 'text-yellow-400' : 'text-gray-200'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

const RatingModal = ({ gymClass, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating) { toast.error('Select a rating'); return }
    setSaving(true)
    try {
      await onSubmit(gymClass.id, rating, review)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Rate "{gymClass.name}"</h3>
        <p className="text-sm text-gray-500 mb-4">Share your experience with this class</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Your rating</label>
            <StarRating value={rating} interactive onChange={setRating} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Review (optional)</label>
            <textarea className="input text-sm" rows={3} value={review}
              onChange={e => setReview(e.target.value)} placeholder="Tell us what you thought..." />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary text-sm">
              {saving ? 'Submitting...' : 'Submit Rating'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ClassCard = ({ gymClass, onBook, onCancel, onWaitlist, onLeaveWaitlist, onRate }) => {
  const isPast = new Date(gymClass.schedule) < new Date()
  const isFull = gymClass.spotsLeft <= 0
  const isWaitlisted = gymClass.myStatus === 'WAITLISTED'

  return (
    <div className="card flex flex-col">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-lg">{gymClass.name}</h3>
          <span className="inline-block text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full mt-1">
            {gymClass.classType}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {gymClass.isBooked && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Booked</span>
          )}
          {isWaitlisted && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Waitlisted #{gymClass.waitlistPosition}</span>
          )}
          {isFull && !gymClass.isBooked && !isWaitlisted && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Full</span>
          )}
        </div>
      </div>

      {gymClass.description && (
        <p className="text-sm text-gray-600 mb-3">{gymClass.description}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
        <div><span className="font-medium">Instructor:</span> {gymClass.instructor}</div>
        <div><span className="font-medium">Duration:</span> {gymClass.duration} min</div>
        <div><span className="font-medium">Date:</span> {new Date(gymClass.schedule).toLocaleDateString()}</div>
        <div><span className="font-medium">Time:</span> {new Date(gymClass.schedule).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div>
          <span className="font-medium">Spots:</span>{' '}
          <span className={isFull ? 'text-red-600' : 'text-green-600'}>{gymClass.spotsLeft} / {gymClass.capacity}</span>
        </div>
        {gymClass.avgRating > 0 && (
          <div className="flex items-center gap-1">
            <StarRating value={Math.round(gymClass.avgRating)} />
            <span className="text-xs text-gray-400">({gymClass.ratingCount})</span>
          </div>
        )}
      </div>

      <div className="mt-auto space-y-2">
        {!isPast && !gymClass.isBooked && !isWaitlisted && (
          isFull ? (
            <button onClick={() => onWaitlist(gymClass.id)}
              className="btn btn-secondary text-sm w-full">
              Join Waitlist
            </button>
          ) : (
            <button onClick={() => onBook(gymClass.id)}
              className="btn btn-primary text-sm w-full">
              Book Class
            </button>
          )
        )}
        {!isPast && gymClass.isBooked && (
          <button onClick={() => onCancel(gymClass.id)} className="btn btn-secondary text-sm w-full">
            Cancel Booking
          </button>
        )}
        {!isPast && isWaitlisted && (
          <button onClick={() => onLeaveWaitlist(gymClass.id)} className="btn btn-secondary text-sm w-full">
            Leave Waitlist
          </button>
        )}
        {isPast && gymClass.isBooked && (
          <button onClick={() => onRate(gymClass)} className="btn btn-secondary text-sm w-full">
            Rate This Class
          </button>
        )}
        {isPast && !gymClass.isBooked && (
          <p className="text-sm text-gray-400 text-center">This class has passed</p>
        )}
      </div>
    </div>
  )
}

const Classes = () => {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [view, setView] = useState('upcoming')
  const [filterType, setFilterType] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [ratingTarget, setRatingTarget] = useState(null)
  const [newClass, setNewClass] = useState({
    name: '', description: '', instructor: '', capacity: 20,
    classType: 'Yoga', schedule: '', duration: 60
  })
  const [saving, setSaving] = useState(false)

  const classTypes = ['Yoga', 'HIIT', 'Pilates', 'Spinning', 'Zumba', 'Boxing', 'CrossFit', 'Swimming']

  const { data: fetchedData, loading, refetch: refetchClasses } = useFetch(
    async () => {
      const params = view === 'upcoming' ? { upcoming: 'true' } : {}
      if (filterType) params.classType = filterType
      const [classRes, bookingRes] = await Promise.all([
        classService.getAll(params),
        classService.getMyBookings()
      ])
      return { classRes, bookingRes }
    },
    false
  )

  useEffect(() => {
    refetchClasses()
  }, [view, filterType]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fetchedData) {
      const bookingMap = {}
      for (const b of fetchedData.bookingRes.bookings) {
        bookingMap[b.classId] = b.status
      }
      const enriched = fetchedData.classRes.classes.map(c => ({
        ...c,
        isBooked: bookingMap[c.id] === 'CONFIRMED',
        myStatus: bookingMap[c.id] || null
      }))
      setClasses(enriched)
      setMyBookings(fetchedData.bookingRes.bookings)
    }
  }, [fetchedData])

  const handleBook = async (classId) => {
    try {
      await classService.book(classId)
      toast.success('Class booked!')
      refetchClasses()
    } catch (err) {
      toast.error(err.error || 'Failed to book class')
    }
  }

  const handleCancel = async (classId) => {
    try {
      await classService.cancelBooking(classId)
      toast.success('Booking cancelled')
      refetchClasses()
    } catch {
      toast.error('Failed to cancel booking')
    }
  }

  const handleWaitlist = async (classId) => {
    try {
      const res = await classService.joinWaitlist(classId)
      toast.success(`Added to waitlist at position #${res.position}`)
      refetchClasses()
    } catch (err) {
      toast.error(err.error || 'Failed to join waitlist')
    }
  }

  const handleLeaveWaitlist = async (classId) => {
    try {
      await classService.leaveWaitlist(classId)
      toast.success('Removed from waitlist')
      refetchClasses()
    } catch {
      toast.error('Failed to leave waitlist')
    }
  }

  const handleRate = async (classId, rating, review) => {
    try {
      await classService.rate(classId, rating, review)
      toast.success('Rating submitted!')
    } catch (err) {
      toast.error(err.error || 'Failed to submit rating')
      throw err
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
      refetchClasses()
    } catch {
      toast.error('Failed to create class')
    } finally {
      setSaving(false)
    }
  }

  const filteredClasses = searchQ
    ? classes.filter(c =>
        c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
        c.instructor.toLowerCase().includes(searchQ.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchQ.toLowerCase())
      )
    : classes

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Classes</h1>
        {user?.role === 'ADMIN' && (
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary text-sm">
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

      <div className="flex flex-wrap gap-2 mb-4">
        {['upcoming', 'all', 'my-bookings'].map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            {v === 'upcoming' ? 'Upcoming' : v === 'all' ? 'All Classes' : 'My Bookings'}
          </button>
        ))}
      </div>

      {view !== 'my-bookings' && (
        <div className="flex flex-wrap gap-3 mb-6">
          <input type="text" className="input max-w-xs text-sm" placeholder="Search by name, instructor…"
            value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          <select className="input max-w-xs text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            {classTypes.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      )}

      {view === 'my-bookings' ? (
        myBookings.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No bookings yet. Browse upcoming classes to get started!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myBookings.map(b => (
              <ClassCard
                key={b.id}
                gymClass={{ ...b.gymClass, isBooked: b.status === 'CONFIRMED', myStatus: b.status, spotsLeft: 1 }}
                onBook={handleBook}
                onCancel={handleCancel}
                onWaitlist={handleWaitlist}
                onLeaveWaitlist={handleLeaveWaitlist}
                onRate={setRatingTarget}
              />
            ))}
          </div>
        )
      ) : (
        filteredClasses.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No classes found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClasses.map(c => (
              <ClassCard key={c.id} gymClass={c} onBook={handleBook} onCancel={handleCancel}
                onWaitlist={handleWaitlist} onLeaveWaitlist={handleLeaveWaitlist} onRate={setRatingTarget} />
            ))}
          </div>
        )
      )}

      {ratingTarget && (
        <RatingModal
          gymClass={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onSubmit={handleRate}
        />
      )}
    </div>
  )
}

export default Classes
