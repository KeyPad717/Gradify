import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clearSession, getStoredUser } from '../auth/authStorage'
import { api } from '../../api/client'

function AdminHomepage() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [coursesError, setCoursesError] = useState('')

  const handleLogout = () => {
    clearSession()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    const fetchCourses = async () => {
      setLoadingCourses(true)
      setCoursesError('')
      try {
        const response = await api.get('/api/admin/courses')
        setCourses(Array.isArray(response.data) ? response.data : [])
      } catch (error) {
        setCoursesError(
          error.response?.data?.details ||
            error.response?.data?.error ||
            'Unable to load courses'
        )
      } finally {
        setLoadingCourses(false)
      }
    }

    fetchCourses()
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Admin service</h1>
        <p className="mt-2 text-sm text-zinc-400">Gateway: /api/admin/*</p>
      </div>
      {user?.email && (
        <p className="text-sm text-zinc-400">Signed in as {user.email}</p>
      )}
      <nav className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          to="/admin-service/create-user"
          className="rounded-lg border border-zinc-600 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
        >
          Create user
        </Link>
        <Link
          to="/admin-service/create-course"
          className="rounded-lg border border-zinc-600 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
        >
          Create course
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
        >
          Log out
        </button>
      </nav>

      <section className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Courses</h2>
        </div>

        {loadingCourses && (
          <p className="text-sm text-zinc-400">Loading courses...</p>
        )}

        {!loadingCourses && coursesError && (
          <p className="text-sm text-red-300">{coursesError}</p>
        )}

        {!loadingCourses && !coursesError && courses.length === 0 && (
          <p className="text-sm text-zinc-400">No courses found.</p>
        )}

        {!loadingCourses && !coursesError && courses.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <article
                key={course.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-lg shadow-black/20"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-400">Course code</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">
                  {course.course_code || '-'}
                </p>

                <p className="mt-4 text-xs uppercase tracking-wide text-zinc-400">Course name</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">
                  {course.course_name || '-'}
                </p>

                <Link
                  to={`/admin-service/courses/${course.id}/users`}
                  state={{
                    courseCode: course.course_code,
                    courseName: course.course_name,
                  }}
                  className="mt-4 inline-block rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
                >
                  Add users
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  )
}

export default AdminHomepage
