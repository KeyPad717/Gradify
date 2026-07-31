# Gradify

Gradify is a multi-service application: a **React (Vite) front-end**, a **Go API gateway**, and a **Spring Boot user-service** (authentication and related APIs). Services are being **containerized incrementally** (user-service has a `Dockerfile` today; a full `docker-compose` setup may follow as more services are added).

---

## Architecture

The browser talks to **one** backend URL: the **API gateway**. The gateway proxies `/api/*` to the **user-service**.

| Service | Role | Default URL / port |
|--------|------|---------------------|
| Front-end | Vite dev server | `http://localhost:5173` |
| API gateway | Reverse proxy, CORS, single entrypoint | `http://localhost:8080` |
| User-service | Spring Boot (Java 21), JPA/PostgreSQL | `http://localhost:8081` |

**Traffic flow:** `Front-end → :8080 (gateway) → :8081 (user-service)`.

Do **not** point the front-end at user-service directly; use `VITE_API_GATEWAY_URL` (default `http://localhost:8080`). All HTTP API calls go through `front-end/src/api/client.js`.

---

## Prerequisites

- **Node.js** (for the front-end)
- **Go** (for the API gateway)
- **Java 21** + **Maven** (for user-service; wrapper: `./mvnw`)
- **PostgreSQL** (for user-service; configure in `user-service/src/main/resources/application.properties`)
- **Docker** (optional, for building/running the user-service image)

---

## Run everything locally

1. Start **PostgreSQL** and align credentials with `application.properties`.
2. **User-service** — from `user-service/`:
   ```bash
   ./mvnw clean package
   java -jar target/user-service-0.0.1-SNAPSHOT.jar
   ```
   Listens on **8081** by default.
3. **API gateway** — from `api-gateway/`:
   ```bash
   go run .
   ```
   Listens on **8080**; proxies `/api/auth/*` (and other `/api/*` routes as configured) to `http://localhost:8081`.
4. **Front-end** — from `front-end/`:
   ```bash
   npm install
   npm run dev
   ```
   Opens **5173** by default.

If the gateway is **not** running, the UI will show **Axios “Network Error”** or **ERR_CONNECTION_REFUSED** when calling the API — start the gateway and confirm `VITE_API_GATEWAY_URL` matches.

---

## Front-end (`front-end/`)

**Stack:** React, Vite, React Router DOM, Axios, Tailwind CSS.

**Features**

- **Login** — `src/pages/auth/login.jsx` uses `src/api/client.js` → `POST /api/auth/login` with `{ email, password }` (via gateway: `http://localhost:8080/api/auth/login` with defaults). Response is logged to the console (`access_token`, `refresh_token`, etc. when present).
- **API base URL** — set `VITE_API_GATEWAY_URL` in `.env` if the gateway is not at `http://localhost:8080`.
- **Session** — `src/pages/auth/authStorage.js` stores tokens and expiry in `localStorage`; `isAuthenticated()` drives routing.
- **Routes**
  - `/` → `/admin` if authenticated, else `/login`
  - `/login` — guest-only (authenticated users redirect to `/admin`)
  - `/admin` — protected (unauthenticated users redirect to `/login`)
- **Logout** — on `/admin`, clears storage and redirects to `/login`.

**Notes**

- Signup flow is intentionally not implemented yet.
- Access tokens expire (e.g. `expires_in: 3600`). Refresh-token rotation is not implemented; users sign in again when expired.

---

## API gateway (`api-gateway/`)

Small **reverse proxy** so the front-end uses a single origin for APIs.

**Run**

```bash
cd api-gateway
go run .
```

**Defaults**

- Listens on `:8080`
- Proxies `/api/auth/*` to the user-service at `http://localhost:8081`
- CORS allows `http://localhost:5173` (Vite)

**Environment variables**

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_ADDR` | `:8080` | Listen address |
| `USER_SERVICE_URL` | `http://localhost:8081` | Upstream user-service base URL |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS origins, or `*` |

If user-service runs in Docker on another host port (e.g. `docker run -p 8082:8081 user-service`), set `USER_SERVICE_URL=http://localhost:8082`.

The gateway is **not** containerized in-repo yet; keep it running alongside the Vite app for local development.

---

## User-service (`user-service/`)

Spring Boot **4.x**, **Java 21**, JPA, PostgreSQL. Default port **8081**.

**Build**

```bash
cd user-service
./mvnw clean package
```

- First-time builds need network access to **Maven Central** (dependencies cached under `~/.m2`).
- To skip tests (e.g. no DB for tests): `./mvnw clean package -DskipTests`

**Run (JAR)**

```bash
java -jar target/user-service-0.0.1-SNAPSHOT.jar
```

**Docker**

Build the JAR, then build and run the image from `user-service/`:

```bash
./mvnw clean package -DskipTests
docker build -t user-service .
docker run -p 8081:8081 user-service
```

- **Base image:** `eclipse-temurin:21-jre-jammy`. Legacy Docker Hub tags like `openjdk:21-jdk-slim` are **not** used (deprecated/removed).
- **Port conflict:** if **8081** is already in use (e.g. a local Java process), stop that process or use `docker run -p 8082:8081 user-service` and set `USER_SERVICE_URL=http://localhost:8082` on the gateway.

`Dockerfile` copies `target/user-service-0.0.1-SNAPSHOT.jar` and exposes **8081**.

---

## Kubernetes deployment (`k8s/`)

Deployments pull image tags injected by the pipeline (the Git commit SHA, e.g. `key717/user-service:<sha>`) so each deploy is reproducible. Secrets never live in the repo or in manifests — they are injected at runtime from one shared in-cluster Secret.

**One-time setup** (on the cluster, before first `kubectl apply`):

```bash
kubectl create secret generic gradify-secrets --from-env-file=.env
```

Every deployment references it via `envFrom`, so the Supabase credentials
(`SUPABASE_DB_HOST`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are available to all services.

**Deploy flow**: Jenkins builds and pushes each service as `key717/<svc>:${GIT_COMMIT}`.
The Ansible deploy (`ansible/deploy-k8s.yml`, role `gradify_deploy`) substitutes that tag
into the copied manifests for the services built in that run only (from
`GRADIFY_BUILD_LIST`) before `kubectl apply -R`, so a changed tag triggers a normal
rolling update — no `:latest` staleness, no phantom rollouts of untouched services,
no manual restarts.

---

## Containerization strategy

- Add **Dockerfiles per service** as each service stabilizes; wire them together with **Compose** when multiple services are ready.
- Prefer **defining a common convention** (ports, env files, health checks) early and extending it service by service rather than containerizing everything in one batch at the end.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Maven: `Temporary failure in name resolution` for `repo.maven.apache.org` | Fix host DNS/network; retry when online. `-DskipTests` does not avoid downloading plugins on a clean machine. |
| Docker: timeout / `lookup ... on 127.0.0.53` when pulling images | System DNS may work for `getent` but Docker’s path to systemd-resolved can fail. Set `/etc/docker/daemon.json` to `{"dns":["8.8.8.8","1.1.1.1"]}` and `sudo systemctl restart docker`. |
| Docker: `manifest unknown` for `openjdk:*` | Use the current `Dockerfile` base (`eclipse-temurin:21-jre-jammy`), not deprecated `openjdk` tags. |
| Docker: `address already in use` on **8081** | Free the port or map another host port (`-p 8082:8081`) and update `USER_SERVICE_URL`. |
| Front-end: Network Error / connection refused | Start the **API gateway** on 8080; check `VITE_API_GATEWAY_URL`. |

---

## Repository layout (high level)

```
Gradify/
├── front-end/          # React + Vite UI
├── api-gateway/        # Go reverse proxy
├── user-service/       # Spring Boot + Dockerfile
└── README.md           # This file
```

Package-level `README.md` files under `front-end/`, `api-gateway/`, and `user-service/` point here so documentation stays in one place.
