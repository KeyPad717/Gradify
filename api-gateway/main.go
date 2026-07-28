package main

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
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
	supabaseURL      string
}

type rateLimiter struct {
	mu      sync.Mutex
	clients map[string]*clientLimit
	rate    int
	burst   int
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

type jwkKey struct {
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	Kid string `json:"kid"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

type jwksCache struct {
	mu        sync.RWMutex
	keys      map[string]interface{}
	fetchedAt time.Time
}

var globalJWKSCache = &jwksCache{
	keys: make(map[string]interface{}),
}

func (c *jwksCache) getKey(supabaseURL, kid string) (interface{}, error) {
	c.mu.RLock()
	if time.Since(c.fetchedAt) < 10*time.Minute && len(c.keys) > 0 {
		if k, ok := c.keys[kid]; ok {
			c.mu.RUnlock()
			return k, nil
		}
		if kid == "" {
			for _, k := range c.keys {
				c.mu.RUnlock()
				return k, nil
			}
		}
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()

	if time.Since(c.fetchedAt) < 10*time.Minute && len(c.keys) > 0 {
		if k, ok := c.keys[kid]; ok {
			return k, nil
		}
	}

	if supabaseURL == "" {
		return nil, errors.New("supabase URL not configured for JWKS lookup")
	}

	jwksURL := strings.TrimRight(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(jwksURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS from %s: %w", jwksURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read JWKS body: %w", err)
	}

	var jwks jwksResponse
	if err := json.Unmarshal(body, &jwks); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JWKS: %w", err)
	}

	newKeys := make(map[string]interface{})
	for idx, k := range jwks.Keys {
		pubKey, err := parseJWK(k)
		if err != nil {
			log.Printf("jwksCache: error parsing key %s: %v", k.Kid, err)
			continue
		}
		if k.Kid != "" {
			newKeys[k.Kid] = pubKey
		}
		newKeys[fmt.Sprintf("key_%d", idx)] = pubKey
	}

	c.keys = newKeys
	c.fetchedAt = time.Now()

	if kid != "" {
		if k, ok := c.keys[kid]; ok {
			return k, nil
		}
	}
	if len(c.keys) > 0 {
		for _, k := range c.keys {
			return k, nil
		}
	}

	return nil, fmt.Errorf("key with kid %q not found in JWKS", kid)
}

func parseJWK(k jwkKey) (interface{}, error) {
	if k.Kty == "EC" {
		xBytes, err := decodeB64URL(k.X)
		if err != nil {
			return nil, err
		}
		yBytes, err := decodeB64URL(k.Y)
		if err != nil {
			return nil, err
		}
		return &ecdsa.PublicKey{
			Curve: elliptic.P256(),
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		}, nil
	} else if k.Kty == "RSA" {
		nBytes, err := decodeB64URL(k.N)
		if err != nil {
			return nil, err
		}
		eBytes, err := decodeB64URL(k.E)
		if err != nil {
			return nil, err
		}
		eInt := 0
		for _, b := range eBytes {
			eInt = (eInt << 8) | int(b)
		}
		return &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: eInt,
		}, nil
	}
	return nil, fmt.Errorf("unsupported JWK kty: %s", k.Kty)
}

func decodeB64URL(s string) ([]byte, error) {
	s = strings.TrimRight(s, "=")
	return base64.RawURLEncoding.DecodeString(s)
}

type jwtHeader struct {
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	Typ string `json:"typ"`
}

type jwtClaims struct {
	Sub          string `json:"sub"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	Exp          int64  `json:"exp"`
	UserMetadata struct {
		Role string `json:"role"`
	} `json:"user_metadata"`
	AppMetadata struct {
		Role string `json:"role"`
	} `json:"app_metadata"`
}

func validateToken(tokenString, secret string) (*jwtClaims, error) {
	return validateTokenWithURL(tokenString, secret, os.Getenv("SUPABASE_URL"))
}

func validateTokenWithURL(tokenString, secret, supabaseURL string) (*jwtClaims, error) {
	parts := strings.Split(tokenString, ".")
	if len(parts) != 3 {
		log.Printf("validateToken: expected 3 parts, got %d", len(parts))
		return nil, http.ErrNoLocation
	}

	headerBytes, err := decodeB64URL(parts[0])
	if err != nil {
		log.Printf("validateToken: base64 decode header: %v", err)
		return nil, err
	}

	var header jwtHeader
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		log.Printf("validateToken: JSON unmarshal header: %v", err)
		return nil, err
	}

	signingInput := parts[0] + "." + parts[1]
	sigBytes, err := decodeB64URL(parts[2])
	if err != nil {
		log.Printf("validateToken: base64 decode signature: %v", err)
		return nil, err
	}

	alg := strings.ToUpper(header.Alg)
	if alg == "" || alg == "HS256" {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(signingInput))
		expected := mac.Sum(nil)

		if !hmac.Equal(sigBytes, expected) {
			log.Printf("validateToken: HMAC mismatch (sig len=%d, expected len=%d)", len(sigBytes), len(expected))
			return nil, http.ErrNoLocation
		}
	} else if alg == "ES256" {
		pubKey, err := globalJWKSCache.getKey(supabaseURL, header.Kid)
		if err != nil {
			log.Printf("validateToken: JWKS key lookup failed: %v", err)
			return nil, err
		}
		ecKey, ok := pubKey.(*ecdsa.PublicKey)
		if !ok {
			log.Printf("validateToken: key is not ECDSA public key")
			return nil, http.ErrNoLocation
		}
		if !verifyES256(ecKey, signingInput, sigBytes) {
			log.Printf("validateToken: ES256 signature verification failed")
			return nil, http.ErrNoLocation
		}
	} else if alg == "RS256" {
		pubKey, err := globalJWKSCache.getKey(supabaseURL, header.Kid)
		if err != nil {
			log.Printf("validateToken: JWKS key lookup failed: %v", err)
			return nil, err
		}
		rsaKey, ok := pubKey.(*rsa.PublicKey)
		if !ok {
			log.Printf("validateToken: key is not RSA public key")
			return nil, http.ErrNoLocation
		}
		hash := sha256.Sum256([]byte(signingInput))
		if err := rsa.VerifyPKCS1v15(rsaKey, crypto.SHA256, hash[:], sigBytes); err != nil {
			log.Printf("validateToken: RS256 signature verification failed: %v", err)
			return nil, err
		}
	} else {
		log.Printf("validateToken: unsupported algorithm %s", header.Alg)
		return nil, http.ErrNoLocation
	}

	payload, err := decodeB64URL(parts[1])
	if err != nil {
		log.Printf("validateToken: base64 decode payload: %v", err)
		return nil, err
	}

	var claims jwtClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		log.Printf("validateToken: JSON unmarshal payload: %v", err)
		return nil, err
	}

	if claims.Exp > 0 && time.Now().Unix() > claims.Exp {
		log.Printf("validateToken: token expired at %d", claims.Exp)
		return nil, http.ErrNoLocation
	}

	if claims.Sub == "" {
		log.Printf("validateToken: empty sub claim")
		return nil, http.ErrNoLocation
	}

	return &claims, nil
}

func verifyES256(pubKey *ecdsa.PublicKey, signingInput string, sigBytes []byte) bool {
	if len(sigBytes) != 64 {
		return false
	}
	r := new(big.Int).SetBytes(sigBytes[:32])
	s := new(big.Int).SetBytes(sigBytes[32:])
	hash := sha256.Sum256([]byte(signingInput))
	return ecdsa.Verify(pubKey, hash[:], r, s)
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
	mux.Handle("/api/auth/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuthWithURL(cfg.jwtSecret, cfg.supabaseURL, reverseProxy(cfg.userService)))))

	// Protected service routes
	mux.Handle("/api/admin/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuthWithURL(cfg.jwtSecret, cfg.supabaseURL, reverseProxy(cfg.adminService)))))
	mux.Handle("/api/professor/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuthWithURL(cfg.jwtSecret, cfg.supabaseURL, reverseProxy(cfg.professorService)))))
	mux.Handle("/api/student/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuthWithURL(cfg.jwtSecret, cfg.supabaseURL, reverseProxy(cfg.studentService)))))
	mux.Handle("/api/stats/", withRequestLogging(withCORS(cfg.allowedOrigin, withAuthWithURL(cfg.jwtSecret, cfg.supabaseURL, reverseProxy(cfg.statsService)))))

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
	supabaseURL := envOr("SUPABASE_URL", "")

	return config{
		addr:             addr,
		userService:      u,
		adminService:     a,
		professorService: p,
		studentService:   s,
		statsService:     st,
		allowedOrigin:    allowedOrigins,
		jwtSecret:        jwtSecret,
		supabaseURL:      supabaseURL,
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
	return withAuthWithURL(secret, os.Getenv("SUPABASE_URL"), next)
}

func withAuthWithURL(secret, supabaseURL string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if secret == "" && supabaseURL == "" {
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

		claims, err := validateTokenWithURL(tokenString, secret, supabaseURL)
		if err != nil {
			prefix := tokenString
			if len(prefix) > 30 {
				prefix = prefix[:30]
			}
			log.Printf("withAuth: token validation failed: %v (token prefix: %s...)", err, prefix)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"invalid_or_expired_token"}`))
			return
		}

		r.Header.Set("X-User-Id", claims.Sub)
		r.Header.Set("X-User-Email", claims.Email)

		role := claims.Role
		if claims.UserMetadata.Role != "" {
			role = claims.UserMetadata.Role
		} else if claims.AppMetadata.Role != "" {
			role = claims.AppMetadata.Role
		}
		if role != "" {
			r.Header.Set("X-User-Role", role)
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