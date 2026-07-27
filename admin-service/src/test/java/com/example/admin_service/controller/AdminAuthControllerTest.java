package com.example.admin_service.controller;

import com.example.admin_service.dto.LoginRequest;
import com.example.admin_service.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
class AdminAuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @Test
    void createUser_shouldReturnOk() throws Exception {
        when(authService.createUser(any(LoginRequest.class)))
                .thenReturn(Map.of("id", "abc", "email", "test@test.com"));

        mockMvc.perform(post("/api/auth/create-user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "test@test.com", "password": "pass123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("abc"));
    }

    @Test
    void createUser_serviceError_shouldReturn400() throws Exception {
        when(authService.createUser(any(LoginRequest.class)))
                .thenThrow(new RuntimeException("User already exists"));

        mockMvc.perform(post("/api/auth/create-user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "test@test.com", "password": "pass123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("User already exists"));
    }
}