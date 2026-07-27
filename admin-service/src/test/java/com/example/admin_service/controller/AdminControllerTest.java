package com.example.admin_service.controller;

import com.example.admin_service.service.SupabaseAuthAdminService;
import com.example.admin_service.service.SupabaseAuthAdminService.SupabaseAuthException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminController.class)
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SupabaseAuthAdminService supabaseAuthAdminService;

    @Test
    void health_shouldReturnOk() throws Exception {
        mockMvc.perform(get("/api/admin/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("admin-service"))
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void createUser_missingEmail_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"password": "pass123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("email_required"));
    }

    @Test
    void createUser_missingPassword_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "test@test.com"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("password_required"));
    }

    @Test
    void createUser_serviceRoleNotConfigured_shouldReturn503() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(false);

        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "test@test.com", "password": "pass123"}
                                """))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("supabase_service_role_not_configured"));
    }

    @Test
    void createUser_shouldReturn201() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);
        when(supabaseAuthAdminService.createAuthUser("test@test.com", "pass123"))
                .thenReturn(Map.of("id", "abc123", "email", "test@test.com"));

        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "test@test.com", "password": "pass123"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("test@test.com"));
    }

    @Test
    void createUser_supabaseAuthException_shouldReturnErrorStatus() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);
        when(supabaseAuthAdminService.createAuthUser("test@test.com", "pass123"))
                .thenThrow(new SupabaseAuthException(400, "{\"error\":\"user_exists\"}"));

        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "test@test.com", "password": "pass123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("supabase_auth_failed"));
    }

    @Test
    void updateUserProfile_missingFields_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/admin/users/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("email_required"));
    }

    @Test
    void updateUserProfile_invalidRole_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/admin/users/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "a@b.com", "name": "Test", "role": "INVALID"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_role"));
    }

    @Test
    void updateUserProfile_valid_shouldReturn200() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);

        mockMvc.perform(post("/api/admin/users/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "a@b.com", "userId": "u1", "name": "Test", "role": "STUDENT"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(true));
    }

    @Test
    void listProfessors_shouldReturnOk() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);
        when(supabaseAuthAdminService.listProfessors()).thenReturn(List.of(Map.of("id", "p1", "name", "Dr. X")));

        mockMvc.perform(get("/api/admin/professors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("p1"));
    }

    @Test
    void listProfessors_serviceRoleNotConfigured_shouldReturn503() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(false);

        mockMvc.perform(get("/api/admin/professors"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("supabase_service_role_not_configured"));
    }

    @Test
    void createCourse_missingFields_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/admin/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("professor_id_required"));
    }

    @Test
    void createCourse_valid_shouldReturn201() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);
        when(supabaseAuthAdminService.createCourse("p1", "CS101", "Intro", "2024-01-01"))
                .thenReturn(Map.of("id", 1));

        mockMvc.perform(post("/api/admin/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"professorId": "p1", "courseCode": "CS101", "courseName": "Intro", "createdAt": "2024-01-01"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void listCourses_shouldReturnOk() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);
        when(supabaseAuthAdminService.listCourses()).thenReturn(List.of(Map.of("id", 1)));

        mockMvc.perform(get("/api/admin/courses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    void listStudents_shouldReturnOk() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);
        when(supabaseAuthAdminService.listStudents()).thenReturn(List.of(Map.of("id", "s1")));

        mockMvc.perform(get("/api/admin/students"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("s1"));
    }

    @Test
    void listCourseEnrollments_shouldReturnOk() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);
        when(supabaseAuthAdminService.listEnrolledStudentIds(1)).thenReturn(List.of("s1", "s2"));

        mockMvc.perform(get("/api/admin/courses/1/enrollments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.courseId").value(1))
                .andExpect(jsonPath("$.studentIds[0]").value("s1"));
    }

    @Test
    void syncCourseEnrollments_missingStudentIds_shouldReturn400() throws Exception {
        mockMvc.perform(put("/api/admin/courses/1/enrollments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("student_ids_required"));
    }

    @Test
    void syncCourseEnrollments_valid_shouldReturnOk() throws Exception {
        when(supabaseAuthAdminService.isServiceRoleConfigured()).thenReturn(true);
        when(supabaseAuthAdminService.syncCourseEnrollments(eq(1), anyList()))
                .thenReturn(Map.of("courseId", 1, "added", 2, "removed", 0));

        mockMvc.perform(put("/api/admin/courses/1/enrollments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentIds": ["s1", "s2"]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(2));
    }
}