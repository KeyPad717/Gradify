export function formatError(error, defaultFallback = 'An error occurred') {
  if (!error) return defaultFallback

  const details = error.response?.data?.details
  let parsedDetails = details

  if (typeof details === 'string') {
    try {
      const json = JSON.parse(details)
      parsedDetails = json?.msg || json?.message || json?.error_description || details
    } catch {
      parsedDetails = details
    }
  }

  const rawMsg =
    parsedDetails ||
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    defaultFallback

  const str = String(rawMsg)

  if (str.includes('courses_course_code_key') || (str.includes('duplicate key') && str.includes('course_code'))) {
    return 'A course with this Course Code already exists. Please use a unique Course Code.'
  }

  if (str.includes('users_email_key') || str.includes('User already registered') || str.includes('email_already_exists')) {
    return 'A user with this email address already exists.'
  }

  if (str.includes('user_record_not_found_for_email')) {
    return 'No user profile record found for this email address.'
  }

  if (str.includes('supabase_service_role_not_configured')) {
    return 'Server configuration error: Supabase Service Role Key is missing.'
  }

  if (str.includes('invalid_credentials') || str.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.'
  }

  if (str.includes('duplicate key value violates unique constraint')) {
    return 'A record with this information already exists.'
  }

  return rawMsg
}
