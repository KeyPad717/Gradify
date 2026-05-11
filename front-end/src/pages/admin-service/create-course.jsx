import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'

function toDateTimeLocalValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function CreateCourse() {
  const [professors, setProfessors] = useState([])
  const [professorId, setProfessorId] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [courseName, setCourseName] = useState('')
  const [createdAt, setCreatedAt] = useState(toDateTimeLocalValue())
  const [loading, setLoading] = useState(false)
  const [loadingProfessors, setLoadingProfessors] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchProfessors = async () => {
      setLoadingProfessors(true)
      try {
        const response = await api.get('/api/admin/professors')
        const list = Array.isArray(response.data) ? response.data : []
        setProfessors(list)
        if (list.length > 0) {
          setProfessorId(String(list[0].id))
        }
      } catch (error) {
        setMessage(
          error.response?.data?.details ||
            error.response?.data?.error ||
            'Unable to load professors list'
        )
      } finally {
        setLoadingProfessors(false)
      }
    }
    fetchProfessors()
  }, [])

  const selectedProfessor = useMemo(
    () => professors.find((item) => String(item.id) === String(professorId)),
    [professorId, professors]
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      await api.post('/api/admin/courses', {
        professorId,
        courseCode,
        courseName,
        createdAt: new Date(createdAt).toISOString(),
      })
      setMessage('Course created successfully')
      setCourseCode('')
      setCourseName('')
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
          'Unable to create course'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mb-6 w-full max-w-md">
        <Link
          to="/admin-service"
          className="text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          ← Admin home
        </Link>
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl shadow-black/40"
      >
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight">Create course</h1>

        <div className="mb-4">
          <label htmlFor="course-professor" className="mb-2 block text-sm text-zinc-300">
            Professor
          </label>
          <select
            id="course-professor"
            value={professorId}
            onChange={(event) => setProfessorId(event.target.value)}
            disabled={loadingProfessors || professors.length === 0}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30 disabled:opacity-70"
          >
            {professors.length === 0 && <option value="">No professor found</option>}
            {professors.map((professor) => (
              <option key={professor.id} value={professor.id}>
                {professor.name || '(No Name)'} - {professor.email}
              </option>
            ))}
          </select>
          {selectedProfessor && (
            <p className="mt-2 text-xs text-zinc-400">Selected ID: {selectedProfessor.id}</p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="course-code" className="mb-2 block text-sm text-zinc-300">
            Course code
          </label>
          <input
            id="course-code"
            type="text"
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
            placeholder="CS101"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="course-name" className="mb-2 block text-sm text-zinc-300">
            Course name
          </label>
          <input
            id="course-name"
            type="text"
            value={courseName}
            onChange={(event) => setCourseName(event.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
            placeholder="Data Structures"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="created-at" className="mb-2 block text-sm text-zinc-300">
            Created at
          </label>
          <input
            id="created-at"
            type="datetime-local"
            value={createdAt}
            onChange={(event) => setCreatedAt(event.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30"
          />
        </div>

        <button
          type="submit"
          disabled={loading || loadingProfessors || !professorId}
          className="w-full rounded-lg bg-zinc-200 px-4 py-2.5 font-medium text-zinc-900 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Creating…' : 'Create course'}
        </button>

        {message && (
          <p className="mt-4 text-sm text-zinc-300" role="status">
            {message}
          </p>
        )}
      </form>
    </div>
  )
}

export default CreateCourse
