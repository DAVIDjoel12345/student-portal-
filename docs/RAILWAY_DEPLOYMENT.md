# Production deployment on Railway

This repository is a monorepo. Deploy the API and web frontend as separate Railway services, plus a Railway PostgreSQL service. Keep the Root Directory at `/` (the repository root) for both app services: the Dockerfiles use repository-root build contexts.

## 1. PostgreSQL service

Create a PostgreSQL service in the Railway project. Keep it private; do not enable public networking unless you have a specific operational need. Use Railway variable references on the backend service for the database values (replace `Postgres` below if Railway gave the database service another name):

```text
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_SSL=false
```

These are backend service variables, not values to commit to this repository. If you choose a database connection mode requiring TLS, configure and validate TLS against the database provider’s CA rather than disabling certificate verification.

## 2. Backend service

Connect the GitHub repository and create a service named `backend`.

- Root Directory: `/`
- Builder: Dockerfile
- Dockerfile path: `backend/Dockerfile`
- Pre-deploy command: `npm run db:migrate`
- Health check: `/api/health`
- Health check timeout: 300 seconds
- Restart policy: on failure
- Public networking: generate a Railway domain for the API

Set these variables on the backend service:

```text
NODE_ENV=production
TRUST_PROXY=true
JWT_SECRET=<a fresh random value of at least 32 characters>
CORS_ORIGIN=https://<your-frontend-domain>
SMTP_HOST=<your SMTP host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<SMTP username>
SMTP_PASSWORD=<SMTP password>
SMTP_FROM=<verified sender address>
```

Generate the JWT secret locally with `openssl rand -hex 32`; enter it directly into Railway’s secret variable editor. Do not put production secrets in `.env`, Git, build arguments, or logs. Use the SMTP provider’s correct port/security combination and verify its sender domain before production. The app deliberately refuses to start in production when SMTP credentials are missing because email OTP is required.

Run the migration as a pre-deploy command and check `/api/health` before activating a deployment. The health endpoint checks PostgreSQL too. Back up any existing production database before deploying schema changes; inspect Railway deploy logs and verify a healthy response before directing users to the new service.

## 3. Frontend service

Create a second Railway service from the same repository.

- Root Directory: `/frontend`
- Builder: Dockerfile
- Dockerfile path: `Dockerfile`
- Health check: `/`
- Health check timeout: 300 seconds
- Restart policy: on failure
- Generate a public Railway domain for the frontend.
- Add a frontend service variable named `VITE_API_URL` with the value `https://<your-backend-domain>/api` (enter only the URL as its value, not `VITE_API_URL=`), then redeploy so Vite embeds the production API URL in the static app.
- Update backend `CORS_ORIGIN` to the exact frontend origin, including `https://` and excluding a trailing slash.

The frontend is a static Nginx image and calls the backend’s public HTTPS URL directly; it does not proxy to a Docker Compose hostname. Its production API URL must be set when building the image; changing the runtime variable alone does not rewrite the already-built JavaScript bundle.

## 4. Bootstrap the first administrator

After the backend and database are healthy, run a one-off command in the backend service/container with temporary variables:

```sh
BOOTSTRAP_ADMIN_LOGIN=<private-admin-login> \
BOOTSTRAP_ADMIN_EMAIL=<admin-email> \
BOOTSTRAP_ADMIN_NAME="Portal Administrator" \
BOOTSTRAP_ADMIN_PASSWORD='<unique password of at least 12 characters>' \
npm run bootstrap-admin
```

Use Railway’s one-off command/shell workflow so these values are not committed. The script does not reset an existing account if the login ID is already taken. Remove temporary bootstrap variables after the command completes. Confirm that production OTP email arrives before inviting users.

## 5. Production smoke checks

1. Open `https://<backend-domain>/api/health`; expect HTTP 200 with `status: "ok"` and `database: "connected"`.
2. Open the frontend Railway domain and verify the login page loads over HTTPS.
3. Sign in with the bootstrap administrator and confirm the six-digit OTP is delivered to the registered email.
4. Verify account/catalogue administration works and that administrators cannot write grades or alter audit history.
5. Check Railway logs for startup errors, failed migrations, SMTP errors, CORS rejections, and database connection failures.

Do not use sample accounts or demo passwords in production. Configure a database backup/restore policy and restrict Railway project access before launch.

## Railway service configuration note

Build and deploy settings are intentionally configured per service in Railway, not through a repository-root `railway.json`. A shared root config would force its backend Dockerfile path onto the frontend deployment. Railway documents Config as Code as deprecated; use the dashboard settings above, and avoid adding a shared root Railway config file.
