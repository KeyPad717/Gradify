package com.example.user_service.services;
import com.example.user_service.dto.LoginRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.HashMap;
import java.util.List;

@Service
public class AuthService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anon.key}")
    private String supabaseAnonKey;

    @Value("${supabase.service_role.key:}")
    private String supabaseServiceRoleKey;

    private final RestTemplate restTemplate;  // ← injected

    public AuthService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public Map<String, Object> login(LoginRequest request) {
        String url = supabaseUrl + "/auth/v1/token?grant_type=password";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", supabaseAnonKey);

        HttpEntity<Map<String, String>> entity = new HttpEntity<>(
                Map.of("email", request.getEmail(), "password", request.getPassword()),
                headers
        );

        try {
            ResponseEntity<Map> authResponse = restTemplate.postForEntity(url, entity, Map.class);
            Map<String, Object> originalBody = authResponse.getBody();

            // Reconstruct everything into a fresh LinkedHashMap to guarantee mutability
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            if (originalBody != null) {
                result.putAll(originalBody);
            }

            String accessToken = null;
            if (result.get("access_token") instanceof String tok) {
                accessToken = tok;
            }

            String role = fetchRole(request.getEmail(), accessToken);
            result.put("role", role);

            // Mirror role inside user metadata
            if (result.get("user") instanceof Map userMap) {
                Map<String, Object> userWithRole = new java.util.LinkedHashMap<>(userMap);
                userWithRole.put("role", role);
                result.put("user", userWithRole);
            }

            return result;
        } catch (HttpClientErrorException e) {
            throw new RuntimeException("Invalid email or password.");
        }
    }

    private String fetchRole(String email, String accessToken) {
        String encodedEmail = URLEncoder.encode(email, StandardCharsets.UTF_8);
        String rawUrl = supabaseUrl + "/rest/v1/users?email=eq." + encodedEmail + "&select=role";
        java.net.URI uri = java.net.URI.create(rawUrl);

        String keyToUse = (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) 
                ? supabaseServiceRoleKey 
                : supabaseAnonKey;

        String bearerToken = (supabaseServiceRoleKey != null && !supabaseServiceRoleKey.isBlank()) 
                ? supabaseServiceRoleKey 
                : (accessToken != null && !accessToken.isBlank() ? accessToken : supabaseAnonKey);

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", keyToUse);
        headers.set("Authorization", "Bearer " + bearerToken);

        try {
            ResponseEntity<List> dbResponse = restTemplate.exchange(
                    uri,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    List.class
            );

            List<Map<String, Object>> rows = dbResponse.getBody();
            if (rows != null && !rows.isEmpty()) {
                Object r = rows.get(0).get("role");
                if (r != null) {
                    return r.toString();
                }
            }
        } catch (Exception e) {
            // Log error
        }
        return "STUDENT"; // Default fallback
    }
}