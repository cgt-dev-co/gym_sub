import { useState, useEffect } from 'react'
import { progressService } from '../services/api'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'

const defaultExercise = () => ({ name: '', sets: '', reps: '', weight: '' })

const Progress = () => {
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('log')
  const [showForm, setShowForm] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [form, setForm] = useState({
    title: '',
    exercises: [defaultExercise()],
    notes: '',
    duration: '',
    logDate: new Date().toISOString().slice(0, 10)
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [logRes, statsRes] = await Promise.all([
        progressService.getLogs(),
        progressService.getStats()
      ])
      setLogs(logRes.logs)
      setStats(statsRes.stats)
    } catch {
      toast.error('Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ title: '', exercises: [defaultExercise()], notes: '', duration: '', logDate: new Date().toISOString().slice(0, 10) })
    setEditingLog(null)
    setShowForm(false)
  }

  const handleEdit = (log) => {
    setEditingLog(log.id)
    setForm({
      title: log.title,
      exercises: log.exercises.length ? log.exercises : [defaultExercise()],
      notes: log.notes || '',
      duration: log.duration,
      logDate: new Date(log.logDate).toISOString().slice(0, 10)
    })
    setShowForm(true)
    setTab('log')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, exercises: form.exercises.filter(ex => ex.name.trim()) }
      if (editingLog) {
        await progressService.updateLog(editingLog, payload)
        toast.success('Workout updated')
      } else {
        await progressService.createLog(payload)
        toast.success('Workout logged!')
      }
      resetForm()
      loadData()
    } catch {
      toast.error('Failed to save workout')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workout log?')) return
    try {
      await progressService.deleteLog(id)
      toast.success('Log deleted')
      setLogs(logs.filter(l => l.id !== id))
    } catch {
      toast.error('Failed to delete log')
    }
  }

  const addExercise = () => setForm({ ...form, exercises: [...form.exercises, defaultExercise()] })

  const updateExercise = (idx, field, val) => {
    const updated = form.exercises.map((ex, i) => i === idx ? { ...ex, [field]: val } : ex)
    setForm({ ...form, exercises: updated })
  }

  const removeExercise = (idx) => {
    if (form.exercises.length === 1) return
    setForm({ ...form, exercises: form.exercises.filter((_, i) => i !== idx) })
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Progress Tracker</h1>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="btn btn-primary text-sm"
        >
          {showForm && !editingLog ? 'Cancel' : '+ Log Workout'}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            {editingLog ? 'Edit Workout' : 'Log New Workout'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workout Title</label>
                <input type="text" className="input" value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Chest Day" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" className="input" value={form.logDate}
                  onChange={e => setForm({ ...form, logDate: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                <input type="number" className="input" value={form.duration}
                  onChange={e => setForm({ ...form, duration: e.target.value })}
                  placeholder="60" min="1" required />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Exercises</label>
                <button type="button" onClick={addExercise} className="text-sm text-primary-600 hover:text-primary-800">
                  + Add Exercise
                </button>
              </div>
              <div className="space-y-2">
                {form.exercises.map((ex, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                    <input type="text" placeholder="Exercise name" className="input col-span-2"
                      value={ex.name} onChange={e => updateExercise(idx, 'name', e.target.value)} />
                    <input type="text" placeholder="Sets" className="input"
                      value={ex.sets} onChange={e => updateExercise(idx, 'sets', e.target.value)} />
                    <input type="text" placeholder="Reps" className="input"
                      value={ex.reps} onChange={e => updateExercise(idx, 'reps', e.target.value)} />
                    <button type="button" onClick={() => removeExercise(idx)}
                      className="text-red-400 hover:text-red-600 text-sm">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea className="input" rows={2} value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="How did it go? Any PRs?" />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : editingLog ? 'Update' : 'Log Workout'}
              </button>
              <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex space-x-2 mb-6">
        {['log', 'stats'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t === 'log' ? 'Workout Log' : 'Stats'}
          </button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-3xl font-bold text-primary-600">{stats.totalLogs}</p>
            <p className="text-sm text-gray-600 mt-1">Total Workouts</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-green-600">{stats.recentLogs}</p>
            <p className="text-sm text-gray-600 mt-1">Last 30 Days</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-blue-600">{Math.round(stats.totalDuration / 60)}h</p>
            <p className="text-sm text-gray-600 mt-1">Total Hours (30d)</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-purple-600">{stats.avgDuration}min</p>
            <p className="text-sm text-gray-600 mt-1">Avg Duration</p>
          </div>
        </div>
      )}

      {tab === 'log' && (
        logs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">💪</p>
            <p className="text-gray-500">No workouts logged yet. Start tracking your progress!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg">{log.title}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(log.logDate).toLocaleDateString()} · {log.duration} min
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(log)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                    <button onClick={() => handleDelete(log.id)} className="text-sm text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>

                {log.exercises && log.exercises.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Exercises</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {log.exercises.map((ex, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                          <p className="font-medium text-gray-700">{ex.name}</p>
                          {(ex.sets || ex.reps) && (
                            <p className="text-gray-500 text-xs">{ex.sets && `${ex.sets} sets`}{ex.sets && ex.reps && ' × '}{ex.reps && `${ex.reps} reps`}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {log.notes && (
                  <p className="mt-3 text-sm text-gray-600 italic">"{log.notes}"</p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

export default Progress
