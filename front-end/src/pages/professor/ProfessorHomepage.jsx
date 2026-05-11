import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearSession, getStoredUser } from '../auth/authStorage'
import { api } from '../../api/client'

function ProfessorHomepage() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return

    async function fetchCourses() {
      setLoading(true)
      try {
        const response = await api.get(`/api/professor/courses?professorId=${user.id}`)
        setCourses(response.data)
      } catch (err) {
        console.error('Failed to fetch courses:', err)
        setError('Could not load courses. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchCourses()
  }, [user?.id])

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  const handleViewStudents = (courseId) => {
    navigate(`/professor/courses/${courseId}/students`)
  }

  const handleViewComponents = (courseId) => {
    navigate(`/professor/courses/${courseId}/components`)
  }

  const handleViewGrades = (courseId) => {
    navigate(`/professor/courses/${courseId}/grades`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
            Professor Portal
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome, {user?.email?.split('@')[0] || 'Professor'}</h1>
          <p className="mt-2 text-sm text-zinc-400">Manage your courses, students, and grading.</p>
        </div>

        <nav className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            Log out
          </button>
        </nav>

        <section className="w-full">
          <div className="mb-6 flex items-center justify-between border-b border-zinc-800 pb-4">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Teaching Courses</h2>
          </div>

          {loading ? (
            <div className="py-12 text-center text-zinc-500">Loading courses...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-400">
              {error}
            </div>
          ) : courses.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-zinc-700 hover:bg-zinc-800/80"
                >
                  <div>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 transition group-hover:bg-zinc-700">
                      <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-zinc-100">{course.course_name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{course.course_code}</p>
                  </div>
                  
                  <div className="mt-8 flex flex-col gap-2">
                    <button
                      onClick={() => handleViewStudents(course.id)}
                      className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800/50 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-emerald-400 border border-zinc-700/50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      View Enrollments
                    </button>
                    <button
                      onClick={() => handleViewComponents(course.id)}
                      className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800/50 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-blue-400 border border-zinc-700/50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Evaluation Components
                    </button>
                    <button
                      onClick={() => handleViewGrades(course.id)}
                      className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800/50 py-2.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-amber-400 border border-zinc-700/50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Grades
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50">
                <svg className="h-6 w-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-zinc-300">No courses assigned</h3>
              <p className="mt-1 text-xs text-zinc-500">You are currently not teaching any courses.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default ProfessorHomepage
