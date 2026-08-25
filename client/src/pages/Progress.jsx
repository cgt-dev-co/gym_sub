import { useState, useEffect } from 'react'
import { progressService } from '../services/api'
import { toast } from 'react-toastify'
import LoadingSpinner from '../components/LoadingSpinner'
import { useMultiFetch } from '../hooks/useFetch'

const defaultExercise = () => ({ name: '', sets: '', reps: '', weight: '', weightUnit: 'kg' })

const GoalForm = ({ onSave, onCancel, initial }) => {
  const [form, setForm] = useState(initial || { title: '', targetValue: '', unit: 'workouts', deadline: '' })
  const units = ['workouts', 'kg', 'lbs', 'km', 'miles', 'minutes', 'hours', 'reps']

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 mt-3">
      <div className="col-span-2">
        <input type="text" className="input" placeholder="Goal title (e.g. Bench press 100kg)"
          value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
      </div>
      <div>
        <input type="number" className="input" placeholder="Target value" step="0.1" min="0"
          value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} required />
      </div>
      <div>
        <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
          {units.map(u => <option key={u}>{u}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-gray-500 mb-1">Deadline (optional)</label>
        <input type="date" className="input" value={form.deadline}
          onChange={e => setForm({ ...form, deadline: e.target.value })} />
      </div>
      <div className="col-span-2 flex gap-2">
        <button type="submit" className="btn btn-primary text-sm">Save Goal</button>
        <button type="button" onClick={onCancel} className="btn btn-secondary text-sm">Cancel</button>
      </div>
    </form>
  )
}

const Progress = () => {
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [streak, setStreak] = useState(null)
  const [goals, setGoals] = useState([])
  const [personalRecords, setPersonalRecords] = useState({})
  const [tab, setTab] = useState('log')
  const [showForm, setShowForm] = useState(false)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [editingGoal, setEditingGoal] = useState(null)
  const [form, setForm] = useState({
    title: '',
    exercises: [defaultExercise()],
    notes: '',
    duration: '',
    logDate: new Date().toISOString().slice(0, 10)
  })
  const [saving, setSaving] = useState(false)
  const [updateGoalId, setUpdateGoalId] = useState(null)
  const [newProgressValue, setNewProgressValue] = useState('')

  const { results, loading, refetch: refetchProgress } = useMultiFetch([
    { name: 'logs', fn: () => progressService.getLogs() },
    { name: 'stats', fn: () => progressService.getStats() },
    { name: 'streak', fn: () => progressService.getStreak() },
    { name: 'goals', fn: () => progressService.getGoals() },
    { name: 'personalRecords', fn: () => progressService.getPersonalRecords() }
  ])

  useEffect(() => {
    if (results.logs?.data) setLogs(results.logs.data.logs)
    if (results.stats?.data) setStats(results.stats.data.stats)
    if (results.streak?.data) setStreak(results.streak.data)
    if (results.goals?.data) setGoals(results.goals.data.goals)
    if (results.personalRecords?.data) setPersonalRecords(results.personalRecords.data.personalRecords)
  }, [results])

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
      refetchProgress()
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

  const handleCreateGoal = async (data) => {
    try {
      await progressService.createGoal(data)
      toast.success('Goal created!')
      setShowGoalForm(false)
      refetchProgress()
    } catch {
      toast.error('Failed to create goal')
    }
  }

  const handleUpdateGoalProgress = async (goalId) => {
    const val = parseFloat(newProgressValue)
    if (isNaN(val)) { toast.error('Enter a valid number'); return }
    try {
      await progressService.updateGoal(goalId, { currentValue: val })
      toast.success('Progress updated!')
      setUpdateGoalId(null)
      setNewProgressValue('')
      refetchProgress()
    } catch {
      toast.error('Failed to update goal')
    }
  }

  const handleDeleteGoal = async (id) => {
    if (!window.confirm('Delete this goal?')) return
    try {
      await progressService.deleteGoal(id)
      toast.success('Goal deleted')
      setGoals(goals.filter(g => g.id !== id))
    } catch {
      toast.error('Failed to delete goal')
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

  const goalPct = (goal) => Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))

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

      {streak && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-orange-500">{streak.currentStreak}</p>
            <p className="text-xs text-gray-500 mt-1">Current Streak</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-yellow-600">{streak.longestStreak}</p>
            <p className="text-xs text-gray-500 mt-1">Longest Streak</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-primary-600">{stats?.totalLogs ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total Workouts</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-green-600">{stats?.avgDuration ?? 0}min</p>
            <p className="text-xs text-gray-500 mt-1">Avg Duration</p>
          </div>
        </div>
      )}

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
                  <div key={idx} className="grid grid-cols-7 gap-2 items-center">
                    <input type="text" placeholder="Exercise name" className="input col-span-2"
                      value={ex.name} onChange={e => updateExercise(idx, 'name', e.target.value)} />
                    <input type="text" placeholder="Sets" className="input"
                      value={ex.sets} onChange={e => updateExercise(idx, 'sets', e.target.value)} />
                    <input type="text" placeholder="Reps" className="input"
                      value={ex.reps} onChange={e => updateExercise(idx, 'reps', e.target.value)} />
                    <input type="number" placeholder="Weight" className="input" step="0.5"
                      value={ex.weight} onChange={e => updateExercise(idx, 'weight', e.target.value)} />
                    <select className="input text-xs" value={ex.weightUnit || 'kg'}
                      onChange={e => updateExercise(idx, 'weightUnit', e.target.value)}>
                      <option>kg</option>
                      <option>lbs</option>
                    </select>
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

      <div className="flex space-x-2 mb-6 flex-wrap gap-y-2">
        {['log', 'stats', 'goals', 'prs'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t === 'log' ? 'Workout Log' : t === 'stats' ? 'Stats' : t === 'goals' ? 'Goals' : 'Personal Records'}
          </button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>
      )}

      {tab === 'goals' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-700">Your Goals</h2>
            <button onClick={() => setShowGoalForm(true)} className="btn btn-primary text-sm">+ New Goal</button>
          </div>

          {showGoalForm && (
            <div className="card">
              <h3 className="text-md font-semibold text-gray-700">Create Goal</h3>
              <GoalForm onSave={handleCreateGoal} onCancel={() => setShowGoalForm(false)} />
            </div>
          )}

          {goals.length === 0 && !showGoalForm && (
            <p className="text-gray-500 text-center py-12">No goals set yet. Create one to start tracking!</p>
          )}

          {goals.map(goal => {
            const pct = goalPct(goal)
            const isComplete = goal.status === 'COMPLETED' || pct >= 100
            return (
              <div key={goal.id} className={`card ${isComplete ? 'border-green-200 bg-green-50' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-800">{goal.title}</h3>
                    {goal.deadline && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Deadline: {new Date(goal.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    {isComplete && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Completed!</span>}
                    <button onClick={() => handleDeleteGoal(goal.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </div>
                </div>

                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                  <span className="font-semibold">{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all ${isComplete ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-primary-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {!isComplete && (
                  updateGoalId === goal.id ? (
                    <div className="flex gap-2">
                      <input type="number" className="input text-sm" placeholder="New value" step="0.1"
                        value={newProgressValue} onChange={e => setNewProgressValue(e.target.value)} />
                      <button onClick={() => handleUpdateGoalProgress(goal.id)} className="btn btn-primary text-sm">Update</button>
                      <button onClick={() => setUpdateGoalId(null)} className="btn btn-secondary text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setUpdateGoalId(goal.id); setNewProgressValue(String(goal.currentValue)) }}
                      className="text-sm text-primary-600 hover:underline">
                      Update progress →
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'prs' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Personal Records</h2>
          {Object.keys(personalRecords).length === 0 ? (
            <p className="text-gray-500 text-center py-12">No personal records yet. Log workouts with weight to track PRs.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(personalRecords).map(([exercise, record]) => (
                <div key={exercise} className="card">
                  <p className="font-semibold text-gray-800">{exercise}</p>
                  <p className="text-2xl font-bold text-primary-600 mt-1">
                    {record.weight} {record.unit}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {record.sets && `${record.sets} sets`}{record.sets && record.reps ? ' × ' : ''}{record.reps && `${record.reps} reps`}
                    {' · '}{new Date(record.date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
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
                          <p className="text-gray-500 text-xs">
                            {ex.sets && `${ex.sets}×`}{ex.reps && `${ex.reps}`}{ex.weight && ` @ ${ex.weight}${ex.weightUnit || 'kg'}`}
                          </p>
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
