package com.example.admin_service.service;

import java.util.Map;
import java.util.List;
import java.util.Collections;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

@Service
public class SupabaseAuthAdminService {

	private final RestTemplate restTemplate;

	@Value("${supabase.url}")
	private String supabaseUrl;

	@Value("${supabase.service_role.key:}")
	private String serviceRoleKey;

	public SupabaseAuthAdminService(RestTemplate restTemplate) {
		this.restTemplate = restTemplate;
	}

	public boolean isServiceRoleConfigured() {
		return StringUtils.hasText(serviceRoleKey);
	}

	public void updateUserProfile(String email, String userId, String name, String role) {
		if (!isServiceRoleConfigured()) {
			throw new IllegalStateException("supabase_service_role_not_configured");
		}

		String url = buildUsersFilterUrl(email, userId);

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);
		headers.set("Prefer", "return=representation");

		Map<String, Object> payload = Map.of(
				"name", name,
				"role", role);
		HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

		try {
			// Two-phase flow: attempt PATCH update on mirrored public.users row first.
			for (int attempt = 1; attempt <= 3; attempt++) {
				ResponseEntity<List> response = restTemplate.exchange(java.net.URI.create(url), HttpMethod.PATCH, entity, List.class);
				List body = response.getBody();
				if (body != null && !body.isEmpty()) {
					return;
				}

				try {
					Thread.sleep(200);
				} catch (InterruptedException ie) {
					Thread.currentThread().interrupt();
					throw new IllegalStateException("profile_update_interrupted");
				}
			}

			// If PATCH yields no updated row (public.users missing record), perform upsert/insert
			String resolvedUserId = (userId != null && !userId.isBlank()) ? userId : fetchAuthUserIdByEmail(email);

			String upsertUrl = supabaseUrl.replaceAll("/+$", "") + "/rest/v1/users";
			HttpHeaders upsertHeaders = new HttpHeaders();
			upsertHeaders.setContentType(MediaType.APPLICATION_JSON);
			upsertHeaders.set("apikey", serviceRoleKey);
			upsertHeaders.set("Authorization", "Bearer " + serviceRoleKey);
			upsertHeaders.set("Prefer", "resolution=merge-duplicates,return=representation");

			Map<String, Object> upsertPayload = new java.util.HashMap<>();
			if (resolvedUserId != null && !resolvedUserId.isBlank()) {
				upsertPayload.put("id", resolvedUserId);
			}
			upsertPayload.put("email", email);
			upsertPayload.put("name", name);
			upsertPayload.put("role", role);

			ResponseEntity<List> upsertResponse = restTemplate.postForEntity(
					java.net.URI.create(upsertUrl),
					new HttpEntity<>(upsertPayload, upsertHeaders),
					List.class);

			List upsertBody = upsertResponse.getBody();
			if (upsertBody != null && !upsertBody.isEmpty()) {
				return;
			}

			throw new UserProfileNotFoundException("user_record_not_found_for_email");
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	@SuppressWarnings("unchecked")
	private String fetchAuthUserIdByEmail(String email) {
		String url = supabaseUrl.replaceAll("/+$", "") + "/auth/v1/admin/users";
		HttpHeaders headers = new HttpHeaders();
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);

		try {
			ResponseEntity<Map> response = restTemplate.exchange(
					java.net.URI.create(url),
					HttpMethod.GET,
					new HttpEntity<>(headers),
					Map.class);

			Map body = response.getBody();
			if (body != null && body.get("users") instanceof List usersList) {
				for (Object u : usersList) {
					if (u instanceof Map userMap) {
						Object userEmail = userMap.get("email");
						if (userEmail != null && email.equalsIgnoreCase(userEmail.toString())) {
							Object id = userMap.get("id");
							if (id != null) {
								return id.toString();
							}
						}
					}
				}
			}
		} catch (Exception e) {
			// Fallback silently if auth query fails
		}
		return null;
	}

	@SuppressWarnings("unchecked")
	public List<Map<String, Object>> listProfessors() {
		if (!isServiceRoleConfigured()) {
			throw new IllegalStateException("supabase_service_role_not_configured");
		}

		String url = supabaseUrl.replaceAll("/+$", "")
				+ "/rest/v1/users?select=id,email,name,role&role=eq.PROFESSOR&order=created_at.desc";

		HttpHeaders headers = new HttpHeaders();
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);

		try {
			ResponseEntity<List> response = restTemplate.exchange(
					url,
					HttpMethod.GET,
					new HttpEntity<>(headers),
					List.class);

			List body = response.getBody();
			if (body == null) {
				return Collections.emptyList();
			}
			return body;
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	@SuppressWarnings("unchecked")
	public Map<String, Object> createCourse(String professorId, String courseCode, String courseName, String createdAt) {
		if (!isServiceRoleConfigured()) {
			throw new IllegalStateException("supabase_service_role_not_configured");
		}

		String url = supabaseUrl.replaceAll("/+$", "") + "/rest/v1/courses";

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);
		headers.set("Prefer", "return=representation");

		Map<String, Object> payload = Map.of(
				"professor_id", professorId,
				"course_code", courseCode,
				"course_name", courseName,
				"created_at", createdAt);

		try {
			ResponseEntity<List> response = restTemplate.postForEntity(
					url,
					new HttpEntity<>(payload, headers),
					List.class);
			List body = response.getBody();
			if (body != null && !body.isEmpty() && body.get(0) instanceof Map<?, ?> first) {
				return (Map<String, Object>) first;
			}
			return Map.of("created", true);
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	@SuppressWarnings("unchecked")
	public List<Map<String, Object>> listCourses() {
		if (!isServiceRoleConfigured()) {
			throw new IllegalStateException("supabase_service_role_not_configured");
		}

		String url = supabaseUrl.replaceAll("/+$", "")
				+ "/rest/v1/courses?select=id,course_code,course_name,created_at,professor_id&order=created_at.desc";

		HttpHeaders headers = new HttpHeaders();
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);

		try {
			ResponseEntity<List> response = restTemplate.exchange(
					url,
					HttpMethod.GET,
					new HttpEntity<>(headers),
					List.class);
			List body = response.getBody();
			if (body == null) {
				return Collections.emptyList();
			}
			return body;
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	@SuppressWarnings("unchecked")
	public List<Map<String, Object>> listStudents() {
		if (!isServiceRoleConfigured()) {
			throw new IllegalStateException("supabase_service_role_not_configured");
		}

		String url = supabaseUrl.replaceAll("/+$", "")
				+ "/rest/v1/users?select=id,email,name,role&role=eq.STUDENT&order=created_at.desc";

		HttpHeaders headers = new HttpHeaders();
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);

		try {
			ResponseEntity<List> response = restTemplate.exchange(
					url,
					HttpMethod.GET,
					new HttpEntity<>(headers),
					List.class);
			List body = response.getBody();
			if (body == null) {
				return Collections.emptyList();
			}
			return body;
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	@SuppressWarnings("unchecked")
	public List<String> listEnrolledStudentIds(int courseId) {
		if (!isServiceRoleConfigured()) {
			throw new IllegalStateException("supabase_service_role_not_configured");
		}

		String url = supabaseUrl.replaceAll("/+$", "")
				+ "/rest/v1/enrollments?select=student_id&course_id=eq." + courseId;

		HttpHeaders headers = new HttpHeaders();
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);

		try {
			ResponseEntity<List> response = restTemplate.exchange(
					url,
					HttpMethod.GET,
					new HttpEntity<>(headers),
					List.class);
			List<Map<String, Object>> rows = response.getBody();
			if (rows == null) {
				return Collections.emptyList();
			}

			List<String> studentIds = new ArrayList<>();
			for (Map<String, Object> row : rows) {
				Object studentId = row.get("student_id");
				if (studentId != null) {
					studentIds.add(String.valueOf(studentId));
				}
			}
			return studentIds;
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	@SuppressWarnings("unchecked")
	public Map<String, Object> syncCourseEnrollments(int courseId, List<String> selectedStudentIds) {
		if (!isServiceRoleConfigured()) {
			throw new IllegalStateException("supabase_service_role_not_configured");
		}

		Set<String> targetSet = new HashSet<>();
		for (String id : selectedStudentIds) {
			if (id != null && !id.isBlank()) {
				targetSet.add(id.trim());
			}
		}

		List<String> existingIds = listEnrolledStudentIds(courseId);
		Set<String> existingSet = new HashSet<>(existingIds);

		List<String> toAdd = new ArrayList<>();
		for (String id : targetSet) {
			if (!existingSet.contains(id)) {
				toAdd.add(id);
			}
		}

		List<String> toRemove = new ArrayList<>();
		for (String id : existingSet) {
			if (!targetSet.contains(id)) {
				toRemove.add(id);
			}
		}

		if (!toAdd.isEmpty()) {
			insertEnrollments(courseId, toAdd);
		}
		if (!toRemove.isEmpty()) {
			deleteEnrollments(courseId, toRemove);
		}

		return Map.of(
				"courseId", courseId,
				"added", toAdd.size(),
				"removed", toRemove.size(),
				"selectedCount", targetSet.size());
	}

	private void insertEnrollments(int courseId, List<String> studentIds) {
		String url = supabaseUrl.replaceAll("/+$", "") + "/rest/v1/enrollments";

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);

		List<Map<String, Object>> payload = new ArrayList<>();
		for (String studentId : studentIds) {
			payload.add(Map.of("course_id", courseId, "student_id", studentId));
		}

		try {
			restTemplate.postForEntity(url, new HttpEntity<>(payload, headers), List.class);
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	private void deleteEnrollments(int courseId, List<String> studentIds) {
		String csv = String.join(",", studentIds);
		String encodedCsv = URLEncoder.encode(csv, StandardCharsets.UTF_8);
		String url = supabaseUrl.replaceAll("/+$", "")
				+ "/rest/v1/enrollments?course_id=eq." + courseId + "&student_id=in.(" + encodedCsv + ")";

		HttpHeaders headers = new HttpHeaders();
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);

		try {
			restTemplate.exchange(java.net.URI.create(url), HttpMethod.DELETE, new HttpEntity<>(headers), String.class);
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	private String buildUsersFilterUrl(String email, String userId) {
		String base = supabaseUrl.replaceAll("/+$", "") + "/rest/v1/users";
		if (userId != null && !userId.isBlank()) {
			String encodedUserID = URLEncoder.encode(userId.trim(), StandardCharsets.UTF_8);
			return base + "?id=eq." + encodedUserID;
		}
		String encodedEmail = URLEncoder.encode(email, StandardCharsets.UTF_8);
		return base + "?email=eq." + encodedEmail;
	}

	@SuppressWarnings("unchecked")
	public Map<String, Object> createAuthUser(String email, String password) {
		if (!isServiceRoleConfigured()) {
			throw new IllegalStateException("supabase_service_role_not_configured");
		}

		String url = supabaseUrl.replaceAll("/+$", "") + "/auth/v1/admin/users";

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.set("apikey", serviceRoleKey);
		headers.set("Authorization", "Bearer " + serviceRoleKey);

		Map<String, Object> payload = Map.of(
				"email", email,
				"password", password,
				"email_confirm", true);

		HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

		try {
			ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
			Map<String, Object> body = response.getBody();
			if (body == null) {
				return Map.of("email", email, "message", "created");
			}
			return body;
		} catch (HttpClientErrorException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		} catch (RestClientResponseException e) {
			throw new SupabaseAuthException(e.getStatusCode().value(), e.getResponseBodyAsString());
		}
	}

	public static final class SupabaseAuthException extends RuntimeException {
		private final int status;
		private final String responseBody;

		public SupabaseAuthException(int status, String responseBody) {
			super(responseBody);
			this.status = status;
			this.responseBody = responseBody;
		}

		public int getStatus() {
			return status;
		}

		public String getResponseBody() {
			return responseBody;
		}
	}

	public static final class UserProfileNotFoundException extends RuntimeException {
		public UserProfileNotFoundException(String message) {
			super(message);
		}
	}
}
