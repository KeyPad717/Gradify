import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'

function ProfessorCourseGrading() {
  const { courseId, componentId } = useParams()
  const navigate = useNavigate()
  
  const [course, setCourse] = useState(null)
  const [component, setComponent] = useState(null)
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState({}) // { student_id: mark_value }
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [courseRes, studentsRes, marksRes, componentsRes] = await Promise.all([
          api.get(`/api/professor/courses/${courseId}`),
          api.get(`/api/professor/courses/${courseId}/students`),
          api.get(`/api/professor/components/${componentId}/marks`),
          api.get(`/api/professor/courses/${courseId}/components`)
        ])
        
        setCourse(courseRes.data)
        setStudents(studentsRes.data)
        
        // Find specific component
        const comp = componentsRes.data.find(c => c.id === parseInt(componentId))
        setComponent(comp)

        // Map marks to object
        const marksMap = {}
        marksRes.data.forEach(m => {
          marksMap[m.student_id] = m.marks
        })
        setMarks(marksMap)
        
      } catch (err) {
        console.error('Failed to fetch grading data:', err)
        setError('Could not load grading information. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (courseId && componentId) {
      fetchData()
    }
  }, [courseId, componentId])

  const handleMarkChange = (studentId, value) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: value
    }))
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const marksToSave = students.map(student => ({
        student_id: student.student_id || student.email, // Use student unique identifier
        course_id: parseInt(courseId),
        component_id: parseInt(componentId),
        marks: parseInt(marks[student.student_id || student.email] || 0)
      }))

      await api.post('/api/professor/marks/bulk', marksToSave)
      alert('Marks saved successfully!')
    } catch (err) {
      console.error('Failed to save marks:', err)
      alert('Failed to save marks. Please check if the service is running.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/professor/courses/${courseId}/components`)}
              className="group flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              <svg className="h-5 w-5 transition group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <div className="mb-1 inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                Grading Mode
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                {component?.component_name || 'Loading...'} 
                <span className="ml-2 text-zinc-500 font-normal">({component?.weightage}%)</span>
              </h1>
              <p className="text-sm text-zinc-500">{course?.course_name}</p>
            </div>
          </div>
          
          <button
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save All Marks'}
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-emerald-500"></div>
            <p className="text-sm">Fetching student roster...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-12 text-center text-red-400">
            <p className="font-medium">{error}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-800/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-right">Marks (out of 100)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {students.map((student) => (
                  <tr key={student.email} className="transition hover:bg-zinc-800/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-500 border border-zinc-700">
                          {student.name?.split(' ').map(n => n[0]).join('') || 'ST'}
                        </div>
                        <span className="font-medium text-zinc-200">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{student.email}</td>
                    <td className="px-6 py-4 text-right">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={marks[student.student_id || student.email] || ''}
                        onChange={(e) => handleMarkChange(student.student_id || student.email, e.target.value)}
                        className="w-24 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-right focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {students.length === 0 && (
              <div className="py-20 text-center text-zinc-500">
                No students enrolled in this course yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfessorCourseGrading
