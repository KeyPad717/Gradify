package com.example.admin_service.controller;

import java.util.Map;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.admin_service.service.SupabaseAuthAdminService;
import com.example.admin_service.service.SupabaseAuthAdminService.SupabaseAuthException;
import com.example.admin_service.service.SupabaseAuthAdminService.UserProfileNotFoundException;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

	private final SupabaseAuthAdminService supabaseAuthAdminService;

	public AdminController(SupabaseAuthAdminService supabaseAuthAdminService) {
		this.supabaseAuthAdminService = supabaseAuthAdminService;
	}

	@GetMapping("/health")
	public Map<String, String> health() {
		return Map.of("service", "admin-service", "status", "ok");
	}

	@PostMapping("/users")
	public ResponseEntity<?> createUser(@RequestBody CreateUserRequest body) {
		if (body.email() == null || body.email().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "email_required"));
		}
		if (body.password() == null || body.password().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "password_required"));
		}
		if (!supabaseAuthAdminService.isServiceRoleConfigured()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
					"error", "supabase_service_role_not_configured",
					"hint", "Set supabase.service_role.key or env SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API → service_role)."));
		}
		try {
			Map<String, Object> created = supabaseAuthAdminService.createAuthUser(body.email(), body.password());
			return ResponseEntity.status(HttpStatus.CREATED).body(created);
		} catch (SupabaseAuthException e) {
			return ResponseEntity.status(e.getStatus()).body(Map.of(
					"error", "supabase_auth_failed",
					"details", e.getResponseBody()));
		} catch (IllegalStateException e) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"error", "unexpected_admin_service_error",
					"details", "An internal error occurred"));
		}
	}

	@PostMapping("/users/profile")
	public ResponseEntity<?> updateUserProfile(@RequestBody UpdateUserProfileRequest body) {
		if (body.email() == null || body.email().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "email_required"));
		}
		if (body.name() == null || body.name().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "name_required"));
		}
		if (body.role() == null || body.role().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "role_required"));
		}

		String normalizedRole = body.role().trim().toUpperCase();
		if (!normalizedRole.equals("STUDENT") && !normalizedRole.equals("PROFESSOR")) {
			return ResponseEntity.badRequest().body(Map.of("error", "invalid_role"));
		}

		try {
			supabaseAuthAdminService.updateUserProfile(body.email().trim(), body.userId(), body.name().trim(), normalizedRole);
			return ResponseEntity.ok(Map.of("updated", true));
		} catch (SupabaseAuthException e) {
			return ResponseEntity.status(e.getStatus()).body(Map.of(
					"error", "supabase_rest_update_failed",
					"details", e.getResponseBody()));
		} catch (IllegalStateException e) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", e.getMessage()));
		} catch (UserProfileNotFoundException e) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"error", "unexpected_admin_service_error",
					"details", "An internal error occurred"));
		}
	}

	@GetMapping("/professors")
	public ResponseEntity<?> listProfessors() {
		if (!supabaseAuthAdminService.isServiceRoleConfigured()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
					"error", "supabase_service_role_not_configured"));
		}
		try {
			return ResponseEntity.ok(supabaseAuthAdminService.listProfessors());
		} catch (SupabaseAuthException e) {
			return ResponseEntity.status(e.getStatus()).body(Map.of(
					"error", "supabase_professors_fetch_failed",
					"details", e.getResponseBody()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"error", "unexpected_admin_service_error",
					"details", "An internal error occurred"));
		}
	}

	@PostMapping("/courses")
	public ResponseEntity<?> createCourse(@RequestBody CreateCourseRequest body) {
		if (body.professorId() == null || body.professorId().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "professor_id_required"));
		}
		if (body.courseCode() == null || body.courseCode().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "course_code_required"));
		}
		if (body.courseName() == null || body.courseName().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "course_name_required"));
		}
		if (body.createdAt() == null || body.createdAt().isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "created_at_required"));
		}
		if (!supabaseAuthAdminService.isServiceRoleConfigured()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
					"error", "supabase_service_role_not_configured"));
		}

		try {
			Map<String, Object> created = supabaseAuthAdminService.createCourse(
					body.professorId().trim(),
					body.courseCode().trim(),
					body.courseName().trim(),
					body.createdAt().trim());
			return ResponseEntity.status(HttpStatus.CREATED).body(created);
		} catch (SupabaseAuthException e) {
			return ResponseEntity.status(e.getStatus()).body(Map.of(
					"error", "supabase_course_create_failed",
					"details", e.getResponseBody()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"error", "unexpected_admin_service_error",
					"details", "An internal error occurred"));
		}
	}

	@GetMapping("/courses")
	public ResponseEntity<?> listCourses() {
		if (!supabaseAuthAdminService.isServiceRoleConfigured()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
					"error", "supabase_service_role_not_configured"));
		}
		try {
			return ResponseEntity.ok(supabaseAuthAdminService.listCourses());
		} catch (SupabaseAuthException e) {
			return ResponseEntity.status(e.getStatus()).body(Map.of(
					"error", "supabase_courses_fetch_failed",
					"details", e.getResponseBody()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"error", "unexpected_admin_service_error",
					"details", "An internal error occurred"));
		}
	}

	@GetMapping("/students")
	public ResponseEntity<?> listStudents() {
		if (!supabaseAuthAdminService.isServiceRoleConfigured()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
					"error", "supabase_service_role_not_configured"));
		}
		try {
			return ResponseEntity.ok(supabaseAuthAdminService.listStudents());
		} catch (SupabaseAuthException e) {
			return ResponseEntity.status(e.getStatus()).body(Map.of(
					"error", "supabase_students_fetch_failed",
					"details", e.getResponseBody()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"error", "unexpected_admin_service_error",
					"details", "An internal error occurred"));
		}
	}

	@GetMapping("/courses/{courseId}/enrollments")
	public ResponseEntity<?> listCourseEnrollments(@PathVariable int courseId) {
		if (!supabaseAuthAdminService.isServiceRoleConfigured()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
					"error", "supabase_service_role_not_configured"));
		}
		try {
			return ResponseEntity.ok(Map.of(
					"courseId", courseId,
					"studentIds", supabaseAuthAdminService.listEnrolledStudentIds(courseId)));
		} catch (SupabaseAuthException e) {
			return ResponseEntity.status(e.getStatus()).body(Map.of(
					"error", "supabase_enrollments_fetch_failed",
					"details", e.getResponseBody()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"error", "unexpected_admin_service_error",
					"details", "An internal error occurred"));
		}
	}

	@PutMapping("/courses/{courseId}/enrollments")
	public ResponseEntity<?> syncCourseEnrollments(@PathVariable int courseId, @RequestBody SyncEnrollmentRequest body) {
		if (body.studentIds() == null) {
			return ResponseEntity.badRequest().body(Map.of("error", "student_ids_required"));
		}
		if (!supabaseAuthAdminService.isServiceRoleConfigured()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
					"error", "supabase_service_role_not_configured"));
		}
		try {
			return ResponseEntity.ok(supabaseAuthAdminService.syncCourseEnrollments(courseId, body.studentIds()));
		} catch (SupabaseAuthException e) {
			return ResponseEntity.status(e.getStatus()).body(Map.of(
					"error", "supabase_enrollments_sync_failed",
					"details", e.getResponseBody()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"error", "unexpected_admin_service_error",
					"details", "An internal error occurred"));
		}
	}

	public record CreateUserRequest(String email, String password) {
	}

	public record UpdateUserProfileRequest(String email, String userId, String name, String role) {
	}

	public record CreateCourseRequest(String professorId, String courseCode, String courseName, String createdAt) {
	}

	public record SyncEnrollmentRequest(List<String> studentIds) {
	}
}
