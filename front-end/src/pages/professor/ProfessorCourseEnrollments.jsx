import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

function ProfessorCourseEnrollments() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  
  const [course, setCourse] = useState(null)
  const [students, setStudents] = useState([])
  const [components, setComponents] = useState([])
  const [marks, setMarks] = useState({}) // { studentId: { componentId: marks_obtained } }
  const [maxMarks, setMaxMarks] = useState({}) // { componentId: maxMarks }
  
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState('Saved') // 'Saved', 'Saving...', 'Error'
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [courseRes, studentsRes, componentsRes, marksRes] = await Promise.all([
          api.get(`/api/professor/courses/${courseId}`),
          api.get(`/api/professor/courses/${courseId}/students`),
          api.get(`/api/professor/courses/${courseId}/components`),
          api.get(`/api/professor/courses/${courseId}/marks/all`)
        ])
        
        setCourse(courseRes.data)
        setStudents(studentsRes.data)
        setComponents(componentsRes.data)
        
        // Populate marks map using marks_obtained
        const marksMap = {}
        marksRes.data.forEach(m => {
          if (!marksMap[m.student_id]) marksMap[m.student_id] = {}
          marksMap[m.student_id][m.component_id] = m.marks_obtained
        })
        setMarks(marksMap)
        
        // Populate max marks map
        const maxMarksMap = {}
        componentsRes.data.forEach(c => {
          maxMarksMap[c.id] = c.max_marks || ''
        })
        setMaxMarks(maxMarksMap)
        
      } catch (err) {
        console.error('Failed to fetch gradebook data:', err)
        setError('Could not load gradebook. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (courseId) {
      fetchData()
    }
  }, [courseId])

  const handleMarkChange = (studentId, componentId, value) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [componentId]: value
      }
    }))
  }

  const handleMarkBlur = async (studentId, componentId) => {
    const value = marks[studentId]?.[componentId]
    if (value === undefined || value === '') return

    setSyncStatus('Saving...')
    try {
      const markToSave = [{
        student_id: studentId,
        course_id: parseInt(courseId),
        component_id: componentId,
        marks_obtained: parseFloat(value)
      }]
      await api.post('/api/professor/marks/bulk', markToSave)
      setSyncStatus('Saved')
    } catch (err) {
      console.error('Auto-save mark failed:', err)
      setSyncStatus('Error')
    }
  }

  const handleMaxMarkChange = (componentId, value) => {
    setMaxMarks(prev => ({
      ...prev,
      [componentId]: value
    }))
  }

  const handleMaxMarkBlur = async (componentId) => {
    const value = maxMarks[componentId]
    setSyncStatus('Saving...')
    try {
      const compToUpdate = components.find(c => c.id === componentId)
      if (!compToUpdate) return

      const updatedComp = [{
        ...compToUpdate,
        max_marks: value === '' ? null : parseInt(value)
      }]
      
      await api.post(`/api/professor/courses/${courseId}/components/bulk`, updatedComp)
      setSyncStatus('Saved')
    } catch (err) {
      console.error('Auto-save max mark failed:', err)
      setSyncStatus('Error')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="text-center">
          <div className="mb-4 h-10 w-10 animate-spin border-4 border-zinc-800 border-t-emerald-500 rounded-full mx-auto"></div>
          <p>Loading Gradebook...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-[95%] flex-col gap-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/professor')}
              className="group flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <div className="mb-1 inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                Gradebook
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{course?.course_name}</h1>
              <p className="text-sm text-zinc-500">{course?.course_code}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 text-xs font-medium transition-opacity ${syncStatus === 'Saving...' ? 'opacity-100' : 'opacity-60'}`}>
              <div className={`h-2 w-2 rounded-full ${syncStatus === 'Saving...' ? 'bg-amber-500 animate-pulse' : syncStatus === 'Saved' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className={syncStatus === 'Error' ? 'text-red-400' : 'text-zinc-400'}>
                {syncStatus === 'Saving...' ? 'Saving changes...' : syncStatus === 'Error' ? 'Save failed' : 'All changes saved'}
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
              <button className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100">Gradebook</button>
              <button
                onClick={() => navigate(`/professor/courses/${courseId}/components`)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300"
              >
                Structure
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-12 text-center text-red-400">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl">
            <table className="w-full text-left text-sm text-zinc-300 border-collapse">
              <thead className="bg-zinc-800/80 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 border-b border-zinc-700 font-semibold min-w-[250px]">Student / Component</th>
                  {components.map(comp => (
                    <th key={comp.id} className="px-6 py-4 border-b border-zinc-700 font-semibold text-center border-l border-zinc-800">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-zinc-100">{comp.component_name}</span>
                        <span className="text-[10px] text-zinc-500">Weight: {comp.weightage}%</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 border-b border-zinc-700 font-semibold text-right border-l border-zinc-800">Weighted Total</th>
                </tr>
                <tr className="bg-zinc-800/20">
                  <td className="px-6 py-2 border-b border-zinc-800 font-bold text-[10px] uppercase tracking-widest text-zinc-500">Max Marks</td>
                  {components.map(comp => (
                    <td key={comp.id} className="px-6 py-2 border-b border-zinc-800 border-l border-zinc-800 text-center">
                      <input
                        type="number"
                        placeholder="100"
                        value={maxMarks[comp.id] || ''}
                        onChange={(e) => handleMaxMarkChange(comp.id, e.target.value)}
                        onBlur={() => handleMaxMarkBlur(comp.id)}
                        className="w-20 rounded bg-zinc-950/50 border border-zinc-800 px-2 py-1 text-center text-emerald-400 font-bold focus:border-emerald-500/50 outline-none transition text-xs"
                      />
                    </td>
                  ))}
                  <td className="px-6 py-2 border-b border-zinc-800 border-l border-zinc-800"></td>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {students.map((student) => {
                  let totalWeightedScore = 0
                  components.forEach(comp => {
                    const score = marks[student.studentId]?.[comp.id] || 0
                    const max = maxMarks[comp.id] || 100
                    if (max > 0) {
                      totalWeightedScore += (score / max) * comp.weightage
                    }
                  })

                  return (
                    <tr key={student.studentId} className="transition hover:bg-zinc-800/30 group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-500 group-hover:border-emerald-500/50 transition-colors">
                            {student.name?.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-100 group-hover:text-white transition-colors">{student.name}</p>
                            <p className="text-[10px] text-zinc-500">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      {components.map(comp => (
                        <td key={comp.id} className="px-6 py-4 border-l border-zinc-800/50 text-center">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={maxMarks[comp.id] || 1000}
                            value={marks[student.studentId]?.[comp.id] || ''}
                            onChange={(e) => handleMarkChange(student.studentId, comp.id, e.target.value)}
                            onBlur={() => handleMarkBlur(student.studentId, comp.id)}
                            className="w-20 rounded-lg bg-transparent border border-transparent hover:bg-zinc-950/30 hover:border-zinc-800 focus:bg-zinc-950 focus:border-emerald-500/50 px-2 py-2 text-center transition-all outline-none"
                            placeholder="-"
                          />
                        </td>
                      ))}
                      <td className="px-6 py-4 border-l border-zinc-800/50 text-right">
                        <span className={`font-bold tracking-tight ${totalWeightedScore >= 40 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {totalWeightedScore.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {students.length === 0 && (
              <div className="py-20 text-center text-zinc-500">
                <p>No students enrolled in this course.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfessorCourseEnrollments
