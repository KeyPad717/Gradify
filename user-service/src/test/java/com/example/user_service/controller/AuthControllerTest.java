package com.example.user_service.controller;

import com.example.user_service.dto.LoginRequest;
import com.example.user_service.services.AuthService;
import com.example.user_service.services.RoleResolutionException;
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
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @Test
    void login_shouldReturnOk() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenReturn(Map.of("access_token", "mock-token", "role", "STUDENT"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "test@test.com", "password": "pass123"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").value("mock-token"))
                .andExpect(jsonPath("$.role").value("STUDENT"));
    }

    @Test
    void login_invalidCredentials_shouldReturn401() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new RuntimeException("Invalid email or password."));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "wrong@test.com", "password": "badpass"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid email or password."));
    }

    @Test
    void login_roleLookupEmptyRows_shouldReturn401() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new RuntimeException("Unable to verify account role. Please try again."));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "norole@test.com", "password": "pass123"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unable to verify account role. Please try again."));
    }

    @Test
    void login_roleLookupException_shouldReturn401() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new RuntimeException("Unable to verify account role. Please try again."));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "error@test.com", "password": "pass123"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Unable to verify account role. Please try again."));
    }
}