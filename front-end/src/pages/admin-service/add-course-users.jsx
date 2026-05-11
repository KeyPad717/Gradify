import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../api/client'

function AddCourseUsers() {
  const { courseId } = useParams()
  const location = useLocation()
  const [students, setStudents] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const courseCode = location.state?.courseCode || `Course #${courseId}`
  const courseName = location.state?.courseName || ''

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setMessage('')
      try {
        const [studentsRes, enrollmentsRes] = await Promise.all([
          api.get('/api/admin/students'),
          api.get(`/api/admin/courses/${courseId}/enrollments`),
        ])

        const studentList = Array.isArray(studentsRes.data) ? studentsRes.data : []
        const enrolled = Array.isArray(enrollmentsRes.data?.studentIds)
          ? enrollmentsRes.data.studentIds
          : []

        setStudents(studentList)
        setSelectedIds(new Set(enrolled.map((id) => String(id))))
      } catch (error) {
        setMessage(
          error.response?.data?.details ||
            error.response?.data?.error ||
            'Unable to load students/enrollments'
        )
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [courseId])

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds])

  const toggleStudent = (studentId) => {
    const key = String(studentId)
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const response = await api.put(`/api/admin/courses/${courseId}/enrollments`, {
        studentIds: Array.from(selectedIds),
      })
      const body = response.data || {}
      setMessage(`Saved. Added ${body.added || 0}, removed ${body.removed || 0}.`)
    } catch (error) {
      const details = error.response?.data?.details
      let parsedDetails = details
      if (typeof details === 'string') {
        try {
          const json = JSON.parse(details)
          parsedDetails = json?.msg || json?.message || details
        } catch {
          parsedDetails = details
        }
      }
      setMessage(
        parsedDetails ||
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Unable to save enrollments'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6">
          <Link
            to="/admin-service"
            className="text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            ← Back to admin home
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Add users</h1>
          <p className="mt-2 text-sm text-zinc-300">
            {courseCode}
            {courseName ? ` - ${courseName}` : ''}
          </p>
          <p className="mt-1 text-sm text-zinc-400">Selected students: {selectedCount}</p>
        </div>

        {loading && <p className="text-sm text-zinc-400">Loading students...</p>}

        {!loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            {students.length === 0 ? (
              <p className="text-sm text-zinc-400">No students found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {students.map((student) => {
                  const checked = selectedIds.has(String(student.id))
                  return (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(student.id)}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-medium text-zinc-100">
                          {student.name || '(No Name)'}
                        </p>
                        <p className="text-xs text-zinc-400">{student.email}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving…' : 'Save enrollment changes'}
          </button>
        </div>

        {message && (
          <p className="mt-4 text-sm text-zinc-300" role="status">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

export default AddCourseUsers
