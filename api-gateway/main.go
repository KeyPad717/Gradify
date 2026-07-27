package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

type config struct {
	addr             string
	userService      *url.URL
	adminService     *url.URL
	professorService *url.URL
	studentService   *url.URL
	statsService     *url.URL
	allowedOrigin    []string
	jwtSecret        string
}

type rateLimiter struct {
	mu       sync.Mutex
	clients  map[string]*clientLimit
	rate     int
	burst    int
}

type clientLimit struct {
	tokens   int
	lastTick time.Time
}

func newRateLimiter(rate, burst int) *rateLimiter {
	return &rateLimiter{
		clients: make(map[string]*clientLimit),
		rate:    rate,
		burst:   burst,
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cl, ok := rl.clients[ip]
	if !ok {
		cl = &clientLimit{tokens: rl.burst, lastTick: now}
		rl.clients[ip] = cl
	}

	elapsed := now.Sub(cl.lastTick)
	cl.lastTick = now
	cl.tokens += int(elapsed.Seconds()) * rl.rate
	if cl.tokens > rl.burst {
		cl.tokens = rl.burst
	}

	if cl.tokens > 0 {
		cl.tokens--
		return true
	}
	return false
}

type jwtClaims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

func validateToken(tokenString, secret string) (*jwtClaims, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		return nil, http.ErrNoLocation
	}

	signingInput := parts[0] + "." + parts[1]
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, err
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	expected := mac.Sum(nil)

	if !hmac.Equal(sig, expected) {
		return nil, http.ErrNoLocation
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}

	var claims jwtClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, err
	}

	if claims.Sub == "" {
		return nil, http.ErrNoLocation
	}

	return &claims, nil
}

func main() {
	cfg := mustLoadConfig()
	loginLimiter := newRateLimiter(5, 10)

	cleanupTicker := time.NewTicker(5 * time.Minute)
	go func() {
		for range cleanupTicker.C {
			loginLimiter.mu.Lock()
			now := time.Now()
			for ip, cl := range loginLimiter.clients {
				if now.Sub(cl.lastTick) > 10*time.Minute {
					delete(loginLimiter.clients, ip)
				}
			}
			loginLimiter.mu.Unlock()
		}
	}()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	// Login endpoint: rate-limited, no JWT required
	loginProxy := withRateLimit(loginLimiter, withRequestLogging(withCORS(cfg.allowedOrigin, reverseProxy(cfg.userService))))
	mux.HandleFunc("POST /api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		loginProxy.ServeHTTP(w, r)
	})

	// Other auth endpoints require JWT
	mux.Handle("/api/auth/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuth(cfg.jwtSecret, reverseProxy(cfg.userService)))))

	// Protected service routes
	mux.Handle("/api/admin/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuth(cfg.jwtSecret, reverseProxy(cfg.adminService)))))
	mux.Handle("/api/professor/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuth(cfg.jwtSecret, reverseProxy(cfg.professorService)))))
	mux.Handle("/api/student/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuth(cfg.jwtSecret, reverseProxy(cfg.studentService)))))
	mux.Handle("/api/stats/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuth(cfg.jwtSecret, reverseProxy(cfg.statsService)))))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"route_not_found"}`))
	})

	srv := &http.Server{
		Addr:              cfg.addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	l, err := net.Listen("tcp", cfg.addr)
	if err != nil {
		log.Fatalf("listen %s: %v", cfg.addr, err)
	}

	log.Printf("api-gateway listening on %s", cfg.addr)
	log.Printf("proxy /api/auth/* -> %s", cfg.userService.String())
	log.Printf("proxy /api/admin/* -> %s", cfg.adminService.String())
	log.Printf("proxy /api/professor/* -> %s", cfg.professorService.String())
	log.Printf("proxy /api/student/* -> %s", cfg.studentService.String())
	log.Printf("proxy /api/stats/* -> %s", cfg.statsService.String())

	go func() {
		if err := srv.Serve(l); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func mustLoadConfig() config {
	addr := envOr("GATEWAY_ADDR", ":8080")

	userServiceURL := envOr("USER_SERVICE_URL", "http://localhost:8081")
	u, err := url.Parse(userServiceURL)
	if err != nil {
		log.Fatalf("invalid USER_SERVICE_URL %q: %v", userServiceURL, err)
	}

	adminServiceURL := envOr("ADMIN_SERVICE_URL", "http://localhost:8083")
	a, err := url.Parse(adminServiceURL)
	if err != nil {
		log.Fatalf("invalid ADMIN_SERVICE_URL %q: %v", adminServiceURL, err)
	}

	professorServiceURL := envOr("PROFESSOR_SERVICE_URL", "http://localhost:8084")
	p, err := url.Parse(professorServiceURL)
	if err != nil {
		log.Fatalf("invalid PROFESSOR_SERVICE_URL %q: %v", professorServiceURL, err)
	}

	studentServiceURL := envOr("STUDENT_SERVICE_URL", "http://localhost:8085")
	s, err := url.Parse(studentServiceURL)
	if err != nil {
		log.Fatalf("invalid STUDENT_SERVICE_URL %q: %v", studentServiceURL, err)
	}

	statsServiceURL := envOr("STATS_SERVICE_URL", "http://localhost:8086")
	st, err := url.Parse(statsServiceURL)
	if err != nil {
		log.Fatalf("invalid STATS_SERVICE_URL %q: %v", statsServiceURL, err)
	}

	allowed := envOr("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
	allowedOrigins := splitCSV(allowed)

	jwtSecret := envOr("SUPABASE_JWT_SECRET", "")

	return config{
		addr:             addr,
		userService:      u,
		adminService:     a,
		professorService: p,
		studentService:   s,
		statsService:     st,
		allowedOrigin:    allowedOrigins,
		jwtSecret:        jwtSecret,
	}
}

func reverseProxy(target *url.URL) http.Handler {
	p := httputil.NewSingleHostReverseProxy(target)

	originalDirector := p.Director
	p.Director = func(r *http.Request) {
		originalHost := r.Host
		originalDirector(r)
		r.Header.Set("X-Forwarded-Host", originalHost)
		r.Header.Set("X-Forwarded-Proto", schemeOrDefault(r))
	}

	p.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("proxy error %s %s: %v", r.Method, r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"error":"bad_gateway"}`))
	}

	p.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Expose-Headers")
		resp.Header.Del("Access-Control-Max-Age")
		return nil
	}

	return p
}

func withAuth(secret string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if secret == "" {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"missing_authorization_header"}`))
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"invalid_authorization_format"}`))
			return
		}

		claims, err := validateToken(tokenString, secret)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"invalid_or_expired_token"}`))
			return
		}

		r.Header.Set("X-User-Id", claims.Sub)
		r.Header.Set("X-User-Email", claims.Email)
		if claims.Role != "" {
			r.Header.Set("X-User-Role", claims.Role)
		}

		next.ServeHTTP(w, r)
	})
}

func withRateLimit(rl *rateLimiter, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if idx := strings.LastIndex(ip, ":"); idx != -1 {
			ip = ip[:idx]
		}

		if !rl.allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"rate_limit_exceeded","retry_after_seconds":60}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func withCORS(allowedOrigins []string, next http.Handler) http.Handler {
	allowAll := len(allowedOrigins) == 1 && allowedOrigins[0] == "*"
	allowedSet := map[string]struct{}{}
	for _, o := range allowedOrigins {
		if o == "" {
			continue
		}
		allowedSet[o] = struct{}{}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (allowAll || isAllowedOrigin(allowedSet, origin)) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func withRequestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Truncate(time.Millisecond))
	})
}

func isAllowedOrigin(allowed map[string]struct{}, origin string) bool {
	_, ok := allowed[origin]
	return ok
}

func schemeOrDefault(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	return "http"
}

func envOr(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}