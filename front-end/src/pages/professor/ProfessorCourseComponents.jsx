import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

function ProfessorCourseComponents() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newComponentName, setNewComponentName] = useState('')
  const [newComponentWeightage, setNewComponentWeightage] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingWeightage, setEditingWeightage] = useState('')

  const totalWeightage = components.reduce((sum, c) => sum + (parseInt(c.weightage) || 0), 0)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [courseRes, componentsRes] = await Promise.all([
          api.get(`/api/professor/courses/${courseId}`),
          api.get(`/api/professor/courses/${courseId}/components`)
        ])
        setCourse(courseRes.data)
        setComponents(componentsRes.data)
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Could not load assessment data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (courseId) {
      fetchData()
    }
  }, [courseId])

  const handleAddComponent = async (e) => {
    e.preventDefault()
    if (!newComponentName || !newComponentWeightage) return

    setAdding(true)
    try {
      const resp = await api.post(`/api/professor/courses/${courseId}/components`, {
        component_name: newComponentName,
        weightage: parseInt(newComponentWeightage)
      })
      setComponents([...components, resp.data])
      setNewComponentName('')
      setNewComponentWeightage('')
    } catch (err) {
      console.error('Failed to add component:', err)
      alert('Failed to add component. Check if it exceeds total allowable weightage.')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (comp) => {
    setEditingId(comp.id)
    setEditingName(comp.component_name)
    setEditingWeightage(comp.weightage.toString())
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
    setEditingWeightage('')
  }

  const handleUpdateComponent = async (id) => {
    try {
      const resp = await api.put(`/api/professor/components/${id}`, {
        component_name: editingName,
        weightage: parseInt(editingWeightage)
      })
      setComponents(components.map(c => c.id === id ? resp.data : c))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to update component:', err)
      alert('Failed to update component.')
    }
  }

  const handleDeleteComponent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this evaluation component?')) {
      return
    }

    try {
      await api.delete(`/api/professor/components/${id}`)
      setComponents(components.filter(c => c.id !== id))
    } catch (err) {
      console.error('Failed to delete component:', err)
      alert('Failed to delete component.')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/professor')}
              className="group flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              <svg className="h-5 w-5 transition group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <div className="mb-1 inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400 ring-1 ring-inset ring-blue-500/20">
                Evaluation Admin
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                {loading ? 'Loading Course...' : course?.course_name || 'Course Not Found'}
              </h1>
              <p className="text-sm text-zinc-500">{course?.course_code}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
            <button
              onClick={() => navigate(`/professor/courses/${courseId}/students`)}
              className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              Students
            </button>
            <button
              className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 shadow-sm"
            >
              Evaluation Components
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-blue-500"></div>
            <p className="text-sm">Fetching evaluation metrics...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-12 text-center text-red-400">
            <p className="font-medium">{error}</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Warning logic */}
            {totalWeightage !== 100 && (
              <div className={`flex items-center gap-3 rounded-2xl border px-6 py-4 transition-all ${totalWeightage > 100 ? 'border-red-500/20 bg-red-500/5 text-red-400' : 'border-amber-500/20 bg-amber-500/5 text-amber-400'}`}>
                <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm font-medium">
                  {totalWeightage > 100 
                    ? `Warning: Total weightage exceeds 100% (currently ${totalWeightage}%)!`
                    : `Notice: Total weightage is currently ${totalWeightage}%. It must add up to exactly 100%.`}
                </div>
              </div>
            )}

            {/* List and Table */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-800/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-4">Structure</th>
                    <th className="px-6 py-4">Weightage (%)</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {components.map((comp, idx) => (
                    <tr key={comp.id} className="transition hover:bg-zinc-800/20">
                      <td className="px-6 py-4">
                        {editingId === comp.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        ) : (
                          <span className="font-medium text-zinc-200">
                            Component {idx + 1}: <span className="text-zinc-400">{comp.component_name}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === comp.id ? (
                          <input
                            type="number"
                            value={editingWeightage}
                            onChange={(e) => setEditingWeightage(e.target.value)}
                            className="w-20 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        ) : (
                          <span className="text-zinc-300">{comp.weightage}%</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId === comp.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleUpdateComponent(comp.id)}
                              className="text-emerald-400 hover:text-emerald-300 font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-zinc-500 hover:text-zinc-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => startEdit(comp)}
                              className="text-zinc-400 hover:text-blue-400 transition"
                              title="Edit"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteComponent(comp.id)}
                              className="text-zinc-400 hover:text-red-400 transition"
                              title="Delete"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Add New Row */}
                  <tr className="bg-zinc-900/40">
                    <td className="px-6 py-6">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                          Component {components.length + 1} Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Final Exam"
                          value={newComponentName}
                          onChange={(e) => setNewComponentName(e.target.value)}
                          className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-6" colSpan="2">
                      <div className="flex items-end gap-4">
                        <div className="flex flex-col gap-1.5 flex-1">
                          <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                            Weightage (%)
                          </label>
                          <input
                            type="number"
                            placeholder="0-100"
                            value={newComponentWeightage}
                            onChange={(e) => setNewComponentWeightage(e.target.value)}
                            className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                          />
                        </div>
                        <button
                          onClick={handleAddComponent}
                          disabled={adding || !newComponentName || !newComponentWeightage}
                          className="h-[46px] rounded-xl bg-blue-600 px-6 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {adding ? 'Adding...' : 'Add Component'}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              
              <div className="bg-zinc-800/30 px-6 py-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-medium">Total Assessment Weightage</span>
                  <span className={`text-lg font-bold ${totalWeightage === 100 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {totalWeightage}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfessorCourseComponents
