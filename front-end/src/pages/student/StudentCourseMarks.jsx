import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getStoredUser } from '../auth/authStorage'
import { api } from '../../api/client'

function StudentCourseMarks() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const user = getStoredUser()

  const courseName = location.state?.courseName || 'Course'
  const courseCode = location.state?.courseCode || ''

  const [rankings, setRankings] = useState([])
  const [distribution, setDistribution] = useState([])
  const [courseStats, setCourseStats] = useState(null)
  const [componentStats, setComponentStats] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.email) return

    async function fetchRankings() {
      setLoading(true)
      try {
        const [rankRes, distRes, statsRes, compStatsRes] = await Promise.all([
          api.get(`/api/student/courses/${courseId}/rankings?email=${encodeURIComponent(user.email)}`),
          api.get(`/api/student/courses/${courseId}/grade-distribution`),
          api.get(`/api/stats/courses/${courseId}`),
          api.get(`/api/stats/courses/${courseId}/components`)
        ])
        setRankings(rankRes.data)
        setDistribution(distRes.data)
        setCourseStats(statsRes.data)
        setComponentStats(compStatsRes.data)
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('Could not load marks. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchRankings()
  }, [courseId, user?.email])

  const medalLabel = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getExpectedGrade = (idx) => {
    if (!distribution || distribution.length === 0) return null
    
    // Sort distribution by standard grade order
    const order = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D']
    const sortedDist = [...distribution]
      .filter(d => d.percentage > 0)
      .sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade))

    if (sortedDist.length === 0) return null

    let accumulatedSlots = 0
    for (const d of sortedDist) {
      const slots = Math.round((d.percentage / 100) * rankings.length)
      accumulatedSlots += slots
      if (idx < accumulatedSlots) return d.grade
    }
    
    // Default to last defined grade if rounding leaves anyone out
    return sortedDist[sortedDist.length - 1].grade
  }

  // Derive component columns from first ranking row
  const components = rankings.length > 0 ? rankings[0].components : []

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/student')}
            className="mb-6 flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to My Courses
          </button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                Student Portal · Rankings
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{courseName}</h1>
              <p className="mt-1 text-sm text-zinc-500">{courseCode} · Marks leaderboard (Weighted Score)</p>
            </div>

            {/* Stats section instead of rank widget */}
            {!loading && courseStats && (
              <div className="flex items-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 py-4 shadow-xl backdrop-blur-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Class Average</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-blue-400">{courseStats.average_weighted_score?.toFixed(1)}</span>
                    <span className="text-xs font-semibold text-zinc-600">/ {rankings[0]?.total_weightage}</span>
                  </div>
                </div>
                <div className="h-10 w-px bg-zinc-800" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Students</span>
                  <span className="text-2xl font-bold text-zinc-200">{courseStats.student_count}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-16 text-center text-zinc-500">Loading rankings…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-400">{error}</div>
        ) : rankings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <h3 className="text-sm font-medium text-zinc-300">No marks available yet</h3>
            <p className="mt-1 text-xs text-zinc-500">Check back after your professor grades the course.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Student
                  </th>
                  {components.map((comp) => (
                    <th
                      key={comp.component_id}
                      className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400"
                    >
                      <div>{comp.component_name}</div>
                      <div className="mt-0.5 text-[10px] font-normal text-zinc-500 uppercase tracking-tight">
                        / {comp.max_marks || 100} ({comp.weightage} pts)
                      </div>
                      {componentStats.find(s => s.component_id === comp.component_id) && (
                        <div className="mt-1.5 inline-block rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-bold text-blue-400 ring-1 ring-zinc-700/50">
                          AVG: {componentStats.find(s => s.component_id === comp.component_id).average_marks.toFixed(1)}
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Course Total
                    <span className="ml-1 font-normal text-zinc-600">/ {rankings[0]?.total_weightage}</span>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Expected Grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((row, idx) => {
                  const isMe = row.is_current_user
                  return (
                    <tr
                      key={row.student_id}
                      className={[
                        'border-b border-zinc-800/60 transition-colors',
                        isMe
                          ? 'bg-blue-500/10 hover:bg-blue-500/15'
                          : idx % 2 === 0
                          ? 'bg-zinc-900/20 hover:bg-zinc-800/40'
                          : 'hover:bg-zinc-800/40',
                      ].join(' ')}
                    >
                      {/* Rank */}
                      <td className="px-4 py-3">
                        <span className={[
                          'inline-flex min-w-[2.5rem] items-center justify-center rounded-lg px-2 py-1 text-sm font-bold',
                          row.rank === 1 ? 'bg-yellow-500/15 text-yellow-400' :
                          row.rank === 2 ? 'bg-zinc-400/10 text-zinc-300' :
                          row.rank === 3 ? 'bg-orange-500/10 text-orange-400' :
                          'text-zinc-500',
                        ].join(' ')}>
                          {medalLabel(row.rank)}
                        </span>
                      </td>

                      {/* Student name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={[
                            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                            isMe ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400',
                          ].join(' ')}>
                            {(row.student_name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className={['font-medium', isMe ? 'text-blue-300' : 'text-zinc-100'].join(' ')}>
                              {row.student_name || '—'}
                              {isMe && (
                                <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500">{row.student_email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Per-component marks */}
                      {row.components.map((comp) => (
                        <td key={comp.component_id} className="px-4 py-3 text-center">
                          {comp.obtained_marks != null ? (
                            <div>
                                <span className={[
                                'font-semibold',
                                isMe ? 'text-blue-300' : 'text-zinc-100',
                                ].join(' ')}>
                                {comp.obtained_marks}
                                </span>
                                <span className="text-zinc-600 ml-1">/ {comp.max_marks || 100}</span>
                                <div className="text-[10px] text-zinc-500">
                                    {(comp.weighted_score || 0).toFixed(1)} pts
                                </div>
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      ))}

                      {/* Total */}
                      <td className="px-4 py-3 text-center">
                        <span className={[
                          'font-bold text-lg',
                          isMe ? 'text-blue-300' : 'text-zinc-100',
                        ].join(' ')}>
                          {row.total_weighted_score?.toFixed(1)}
                        </span>
                        <span className="text-zinc-600 ml-1"> / {row.total_weightage}</span>
                      </td>

                      {/* Grade */}
                      <td className="px-4 py-3 text-center">
                        {getExpectedGrade(idx) ? (
                          <span className={[
                            'inline-flex items-center justify-center rounded-lg px-3 py-1 text-xs font-bold ring-1 ring-inset',
                            getExpectedGrade(idx).startsWith('A') ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' :
                            getExpectedGrade(idx).startsWith('B') ? 'bg-blue-500/10 text-blue-400 ring-blue-500/20' :
                            getExpectedGrade(idx).startsWith('C') ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20' :
                            'bg-zinc-500/10 text-zinc-400 ring-zinc-500/20'
                          ].join(' ')}>
                            {getExpectedGrade(idx)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentCourseMarks
