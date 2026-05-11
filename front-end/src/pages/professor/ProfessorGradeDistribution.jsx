import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

const GRADE_LIST = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D']

function ProfessorGradeDistribution() {
  const { courseId } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [students, setStudents] = useState([])
  const [distribution, setDistribution] = useState({}) // { grade: percentage }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const saveTimeoutRef = useRef(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [courseRes, studentsRes, distRes] = await Promise.all([
          api.get(`/api/professor/courses/${courseId}`),
          api.get(`/api/professor/courses/${courseId}/students`),
          api.get(`/api/professor/courses/${courseId}/grade-distribution`)
        ])

        setCourse(courseRes.data)
        setStudents(studentsRes.data)

        // Initialize distribution
        const distMap = {}
        GRADE_LIST.forEach(g => distMap[g] = 0)
        distRes.data.forEach(d => {
          distMap[d.grade] = d.percentage
        })
        setDistribution(distMap)
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Could not load grade distribution. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (courseId) {
      fetchData()
    }
  }, [courseId])

  const totalPercentage = Object.values(distribution).reduce((sum, val) => sum + (parseInt(val) || 0), 0)
  const studentCount = students.length

  const handlePercentageChange = (grade, value) => {
    const val = value === '' ? 0 : parseInt(value)
    if (isNaN(val) || val < 0 || val > 100) return

    setDistribution(prev => {
      const next = { ...prev, [grade]: val }
      
      // Trigger autosave
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        saveData(next)
      }, 1000)

      return next
    })
  }

  const saveData = async (currentDist) => {
    setSaving(true)
    try {
      const dataToSave = Object.entries(currentDist).map(([grade, percentage]) => ({
        grade,
        percentage
      }))
      await api.post(`/api/professor/courses/${courseId}/grade-distribution`, dataToSave)
    } catch (err) {
      console.error('Failed to autosave distribution:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        {/* Header */}
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
              <div className="mb-1 inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500 ring-1 ring-inset ring-amber-500/20">
                Relative Grading
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Grade Distribution
              </h1>
              <p className="text-sm text-zinc-500">{course?.course_name} ({course?.course_code})</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className={`text-sm font-medium ${totalPercentage === 100 ? 'text-emerald-400' : 'text-zinc-500'}`}>
              Total: {totalPercentage}%
            </div>
            <div className="text-[10px] text-zinc-600 flex items-center gap-1.5">
              {saving ? (
                <>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500"></div>
                  Saving changes...
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  Changes saved
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Stats Card */}
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">Class Overview</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-zinc-400">Total Students</div>
                  <div className="text-2xl font-semibold text-zinc-100">{studentCount}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-400">Grading System</div>
                  <div className="text-sm text-zinc-100">Relative (Percentage-based)</div>
                </div>
              </div>
            </div>

            {totalPercentage !== 100 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 animate-in fade-in slide-in-from-top-2">
                <div className="flex gap-3">
                  <svg className="h-5 w-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-xs text-amber-200/80 leading-relaxed">
                    The total percentage is currently <strong>{totalPercentage}%</strong>. It should sum to <strong>100%</strong> to ensure all students are assigned a grade category correctly.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Distribution Table */}
          <div className="md:col-span-2 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-800/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-4">Grade</th>
                  <th className="px-6 py-4">Percentage (%)</th>
                  <th className="px-6 py-4 text-right">Estimated Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {GRADE_LIST.map((grade) => {
                  const percent = distribution[grade] || 0
                  const estimated = Math.round((percent / 100) * studentCount)
                  
                  return (
                    <tr key={grade} className="transition hover:bg-zinc-800/20">
                      <td className="px-6 py-4">
                        <div className="flex h-8 w-12 items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200">
                          {grade}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={distribution[grade]}
                            onChange={(e) => handlePercentageChange(grade, e.target.value)}
                            className="w-20 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-right focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                            placeholder="0"
                          />
                          <div className="flex-1 max-w-[100px] h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div 
                              className="h-full bg-amber-500/50 transition-all duration-500" 
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-mono ${estimated > 0 ? 'text-zinc-200' : 'text-zinc-600'}`}>
                          {estimated}
                        </span>
                        <span className="ml-1 text-[10px] text-zinc-600 uppercase">Students</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfessorGradeDistribution
