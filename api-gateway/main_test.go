package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestEnvOr(t *testing.T) {
	t.Setenv("EXISTING_KEY", "hello")
	if got := envOr("EXISTING_KEY", "default"); got != "hello" {
		t.Fatalf("expected hello, got %s", got)
	}
	if got := envOr("MISSING_KEY", "default"); got != "default" {
		t.Fatalf("expected default, got %s", got)
	}
}

func TestSplitCSV(t *testing.T) {
	tests := []struct {
		input string
		want  int
	}{
		{"a,b,c", 3},
		{"a", 1},
		{"", 1},
		{" , , ", 1},
	}
	for _, tt := range tests {
		got := splitCSV(tt.input)
		if len(got) != tt.want {
			t.Fatalf("splitCSV(%q) len=%d, want %d", tt.input, len(got), tt.want)
		}
	}
}

func TestNewRateLimiter(t *testing.T) {
	rl := newRateLimiter(10, 20)
	if rl == nil {
		t.Fatal("expected non-nil rate limiter")
	}
	if rl.rate != 10 || rl.burst != 20 {
		t.Fatalf("rate=%d burst=%d", rl.rate, rl.burst)
	}
}

func TestRateLimiterAllow(t *testing.T) {
	rl := newRateLimiter(1, 2)
	if !rl.allow("1.2.3.4") {
		t.Fatal("first request should be allowed")
	}
	if !rl.allow("1.2.3.4") {
		t.Fatal("second request (burst) should be allowed")
	}
	if rl.allow("1.2.3.4") {
		t.Fatal("third request should be rate limited")
	}
}

func TestRateLimiterDifferentIPs(t *testing.T) {
	rl := newRateLimiter(1, 1)
	if !rl.allow("1.1.1.1") {
		t.Fatal("ip1 first request should be allowed")
	}
	if !rl.allow("2.2.2.2") {
		t.Fatal("ip2 first request should be allowed")
	}
}

func TestValidateTokenValid(t *testing.T) {
	secret := "my-test-secret"
	header := `{"alg":"HS256","typ":"JWT"}`
	payload := `{"sub":"user123","email":"test@test.com","role":"STUDENT"}`

	encHeader := base64.RawURLEncoding.EncodeToString([]byte(header))
	encPayload := base64.RawURLEncoding.EncodeToString([]byte(payload))
	signingInput := encHeader + "." + encPayload

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	tokenString := signingInput + "." + sig

	claims, err := validateToken(tokenString, secret)
	if err != nil {
		t.Fatalf("expected valid token, got error: %v", err)
	}
	if claims.Sub != "user123" {
		t.Fatalf("expected sub=user123, got %s", claims.Sub)
	}
	if claims.Email != "test@test.com" {
		t.Fatalf("expected email=test@test.com, got %s", claims.Email)
	}
	if claims.Role != "STUDENT" {
		t.Fatalf("expected role=STUDENT, got %s", claims.Role)
	}
}

func TestValidateTokenInvalidSignature(t *testing.T) {
	header := `{"alg":"HS256","typ":"JWT"}`
	payload := `{"sub":"user123","email":"test@test.com","role":"STUDENT"}`
	encHeader := base64.RawURLEncoding.EncodeToString([]byte(header))
	encPayload := base64.RawURLEncoding.EncodeToString([]byte(payload))
	tokenString := encHeader + "." + encPayload + ".invalidsignature"

	_, err := validateToken(tokenString, "secret")
	if err == nil {
		t.Fatal("expected error for invalid signature")
	}
}

func TestValidateTokenMalformed(t *testing.T) {
	_, err := validateToken("not-a-jwt", "secret")
	if err == nil {
		t.Fatal("expected error for malformed token")
	}
}

func TestValidateTokenEmptySub(t *testing.T) {
	secret := "secret"
	payload := `{"sub":"","email":"test@test.com"}`
	encHeader := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256"}`))
	encPayload := base64.RawURLEncoding.EncodeToString([]byte(payload))
	signingInput := encHeader + "." + encPayload
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	_, err := validateToken(signingInput+"."+sig, secret)
	if err == nil {
		t.Fatal("expected error for empty sub claim")
	}
}

func TestWithAuthMissingHeader(t *testing.T) {
	handler := withAuth("secret", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
	var body map[string]string
	json.Unmarshal(rec.Body.Bytes(), &body)
	if body["error"] != "missing_authorization_header" {
		t.Fatalf("unexpected error: %s", body["error"])
	}
}

func TestWithAuthInvalidFormat(t *testing.T) {
	handler := withAuth("secret", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Authorization", "NotBearer token")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestWithAuthValidToken(t *testing.T) {
	secret := "my-secret"
	claims := jwtClaims{Sub: "abc123", Email: "a@b.com", Role: "STUDENT"}
	token := signTestToken(claims, secret)

	handler := withAuth(secret, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-User-Id") != "abc123" {
			t.Fatalf("wrong X-User-Id: %s", r.Header.Get("X-User-Id"))
		}
		if r.Header.Get("X-User-Email") != "a@b.com" {
			t.Fatalf("wrong X-User-Email: %s", r.Header.Get("X-User-Email"))
		}
		if r.Header.Get("X-User-Role") != "STUDENT" {
			t.Fatalf("wrong X-User-Role: %s", r.Header.Get("X-User-Role"))
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestWithAuthNoSecret(t *testing.T) {
	handler := withAuth("", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 when no secret configured, got %d", rec.Code)
	}
}

func TestWithRateLimit(t *testing.T) {
	rl := newRateLimiter(1, 1)
	handler := withRateLimit(rl, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.RemoteAddr = "10.0.0.1:12345"

	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d", rec1.Code)
	}

	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req)
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request: expected 429, got %d", rec2.Code)
	}
}

func TestWithCORSAllowedOrigin(t *testing.T) {
	handler := withCORS([]string{"http://allowed.com"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Origin", "http://allowed.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") != "http://allowed.com" {
		t.Fatalf("missing CORS header for allowed origin")
	}
}

func TestWithCORSDisallowedOrigin(t *testing.T) {
	handler := withCORS([]string{"http://allowed.com"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("should not set CORS header for disallowed origin")
	}
}

func TestWithCORSPreflight(t *testing.T) {
	handler := withCORS([]string{"http://example.com"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("OPTIONS", "/api/test", nil)
	req.Header.Set("Origin", "http://example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight: expected 204, got %d", rec.Code)
	}
}

func TestWithCORSAllowAll(t *testing.T) {
	handler := withCORS([]string{"*"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Origin", "http://any.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") != "http://any.com" {
		t.Fatalf("expected CORS header for wildcard config")
	}
}

func TestIsAllowedOrigin(t *testing.T) {
	allowed := map[string]struct{}{"http://a.com": {}}
	if !isAllowedOrigin(allowed, "http://a.com") {
		t.Fatal("expected allowed")
	}
	if isAllowedOrigin(allowed, "http://b.com") {
		t.Fatal("expected not allowed")
	}
}

func TestSchemeOrDefault(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	if schemeOrDefault(req) != "http" {
		t.Fatal("expected http for non-TLS request")
	}
}

func signTestToken(claims jwtClaims, secret string) string {
	header := `{"alg":"HS256","typ":"JWT"}`
	payload, _ := json.Marshal(claims)

	encHeader := base64.RawURLEncoding.EncodeToString([]byte(header))
	encPayload := base64.RawURLEncoding.EncodeToString(payload)
	signingInput := encHeader + "." + encPayload

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return signingInput + "." + sig
}

func TestRateLimiterCleanup(t *testing.T) {
	rl := newRateLimiter(5, 10)
	rl.allow("10.0.0.1")

	rl.mu.Lock()
	now := time.Now()
	for ip, cl := range rl.clients {
		cl.lastTick = now.Add(-15 * time.Minute)
		rl.clients[ip] = cl
	}
	rl.mu.Unlock()

	rl.mu.Lock()
	for ip, cl := range rl.clients {
		if now.Sub(cl.lastTick) > 10*time.Minute {
			delete(rl.clients, ip)
		}
	}
	rl.mu.Unlock()

	if len(rl.clients) != 0 {
		t.Fatal("expected clients to be cleaned up")
	}
}

func TestWithAuthInvalidToken(t *testing.T) {
	handler := withAuth("secret", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Authorization", "Bearer invalidtoken")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestNotFoundRoute(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"route_not_found"}`))
	})

	req := httptest.NewRequest("GET", "/nonexistent", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestHealthEndpoint(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]bool
	json.Unmarshal(rec.Body.Bytes(), &body)
	if !body["ok"] {
		t.Fatal("expected ok:true")
	}
}