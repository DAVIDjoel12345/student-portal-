# Secure Student Academic Record Portal

React and TypeScript frontend, Express API, and PostgreSQL database for student records with role based access and email OTP authentication.

For production deployment on Railway, including separate API/frontend services, PostgreSQL variables, SMTP setup, migrations, health checks, and administrator bootstrap, see [Railway deployment guide](docs/RAILWAY_DEPLOYMENT.md).

## Run with Docker Desktop (macOS)

Docker Compose runs PostgreSQL, applies the database schema, starts the API, and serves the web app. You do not need to install Node.js or PostgreSQL on macOS for this route.

1. Install and open Docker Desktop. Wait until Docker Desktop reports that its engine is running.
2. In Terminal, go to the project root (the folder containing `docker-compose.yml`):

   ```sh
   cd "/Users/mac/Desktop/school system"
   ```

   If your project is stored elsewhere, use that folder path instead. Check with `pwd` and `ls`; do not run `cd backend` for the Docker steps.
3. Create the root environment file if it does not already exist, then edit it. This avoids overwriting existing local settings:

   ```sh
   test -f .env || cp .env.example .env
   open -e .env
   ```

   Replace `DB_PASSWORD` with a private local database password. Generate a JWT secret by running `openssl rand -hex 32` in another Terminal tab and paste the output into `JWT_SECRET`. Save `.env`. Do not share or commit it.

   If you already configured `backend/.env` and the root `.env` is missing, you can create the Compose env file from the project root with `cp backend/.env .env`. Compose overrides `DB_HOST` to the internal Docker hostname `postgres`; keep the same `DB_PASSWORD` and `JWT_SECRET` values as the backend configuration.
4. Build and start all containers from the project root:

   ```sh
   docker compose up --build
   ```

   Leave this Terminal window running. The first build may take a few minutes. Compose starts the `postgres` service, waits until it is healthy, runs migrations, then starts the backend, frontend and Nginx. Do not run `npm run db:migrate` or `npm run dev` on the Mac for this Docker setup.
5. In a browser, open `http://localhost:3000`. Check the API/database at `http://localhost:3000/api/health`; a healthy response should include `"status":"ok"` and `"database":"connected"`.
6. To stop the containers, press Ctrl+C in the running Compose Terminal. Then run `docker compose down` from the project root. This preserves the database and demo accounts. To see service state use `docker compose ps`; to inspect logs use `docker compose logs -f backend` or `docker compose logs -f postgres`.

If Docker says it cannot connect to the daemon, open Docker Desktop and wait for its engine to finish starting, then retry. If port 3000 is already in use, change `WEB_PORT` in `.env` (for example to `3001`), restart Compose, and use that port in the browser.

For the completed project write-up, architecture, security notes and limitations, see [docs/PROJECT_REPORT.md](docs/PROJECT_REPORT.md).

For a deployment, set `NODE_ENV=production`, configure the SMTP values and exact `CORS_ORIGIN`, set `VITE_API_URL=/api`, and choose `WEB_PORT=80`. Terminate HTTPS at a trusted ingress or load balancer in front of the Compose Nginx service. The database and API are not published directly to the host.

The one-shot `migrate` service applies the initial schema on an empty database plus compatibility and academic-catalogue migrations before the API starts. The migrations add/update schema objects; keep a database backup before deploying changes to an existing production database.

## Bootstrap the first administrator

After the database is healthy, run this command from the project root, replacing the values with private credentials:

```sh
docker compose exec -e BOOTSTRAP_ADMIN_LOGIN=portal-admin \
  -e BOOTSTRAP_ADMIN_EMAIL=admin@test.edu \
  -e BOOTSTRAP_ADMIN_NAME="Portal Administrator" \
  -e BOOTSTRAP_ADMIN_PASSWORD='replace-with-a-private-password-of-12-or-more-characters' \
  backend npm run bootstrap-admin
```

Run this in a second Terminal window, from the project root, while the Compose services are running. Replace the example email and password with your own values before running it.

### Admin login demo commands

From the project root, bootstrap the demo administrator (this does not reset an existing account's password):

```sh
docker compose exec \
  -e BOOTSTRAP_ADMIN_LOGIN=portal-admin \
  -e BOOTSTRAP_ADMIN_EMAIL=admin@test.edu \
  -e BOOTSTRAP_ADMIN_NAME="Portal Administrator" \
  -e BOOTSTRAP_ADMIN_PASSWORD='replace-with-a-private-password-of-12-or-more-characters' \
  backend npm run bootstrap-admin
```

Then open `http://localhost:3000`, enter `portal-admin` and the exact password you supplied above, and click **Continue**. In a second Terminal window, get the development OTP:

```sh
docker compose logs --since=5m backend
```

Enter the six-digit OTP shown for `portal-admin` in the browser. It expires in five minutes. Once signed in, the admin dashboard and User accounts page should load. To confirm the admin API is healthy:

```sh
curl -i http://localhost:3000/api/health
```

The bootstrap script prints the same success message whether it created a new account or found the login ID already in use. If `portal-admin` already exists, the password provided to the command does **not** replace its current password. Use the existing password or create a different unused admin login ID.

If you forgot the password for an existing local administrator, reset it from the project root (this only updates an existing account with role `admin`):

```sh
docker compose exec \
  -e RESET_ADMIN_LOGIN=portal-admin \
  -e RESET_ADMIN_PASSWORD='choose-a-new-private-password-12-chars-min' \
  backend npm run reset-admin-password
```

The bootstrap command only creates an account if that login ID is unused. In this Docker command, the CLI options set the bootstrap values only for this invocation; they are not written to the project `.env` file. An administrator can create student/staff accounts from the User accounts page.

For a non-Docker backend, run from the `backend` directory after configuring `backend/.env` and applying migrations:

```sh
BOOTSTRAP_ADMIN_LOGIN=portal-admin \
BOOTSTRAP_ADMIN_EMAIL=admin@example.edu \
BOOTSTRAP_ADMIN_NAME="Portal Administrator" \
BOOTSTRAP_ADMIN_PASSWORD='choose-a-private-password-of-12-or-more-characters' \
npm run bootstrap-admin
```

## Login and end-to-end demo test

The database seeds sample student profiles and academic records, but deliberately does not seed accounts with known passwords. Create private demo passwords locally; do not use demonstration credentials for real users.

1. Start the services and bootstrap an administrator using the Docker command above. Run bootstrap once; it creates no account if that login ID already exists. The database migration inserts sample academic data (`STU001`, `STU002`, `STU003`) but deliberately creates no user accounts and no default passwords.
2. Open `http://localhost:3000`. Enter the admin login ID and password you chose during bootstrap, click Continue, then enter the six-digit OTP. With development settings, OTP is printed in the backend log (not emailed). For Docker, find it with:

   ```sh
   docker compose logs --since=5m backend
   ```

   For Docker, read the backend container output using the command above.

3. In the admin dashboard, open User accounts and create a staff account with a login ID, email, name and unique password (at least 12 characters). Create a student account with a matriculation number, email, programme, year and password. To attach the account to a seeded student profile, use that profile's exact matriculation number and email (e.g. `STU001` and `john.doe@school.edu`). The student logs in with the matriculation number as their login ID and the password set here. Alternatively, use a new matriculation number and a new email to create a new profile.
4. Log out, sign in using the staff login ID/password and complete OTP. In **Manage records**, register an active catalogue course for a student and academic term first. Then enter a score for that registered course; the server calculates the grade and GPA/CGPA.
5. Log out, sign in using the student's matriculation number/password and complete OTP. Confirm registered courses, results, GPA and CGPA are displayed.
6. Log back in as admin and check the audit log. Confirm that admin grade access is denied: `GET /api/records` with the admin token should return HTTP 403. Also verify that an incorrect OTP is rejected; three failed attempts trigger a 15-minute lockout.

You can also verify service health and permissions from a terminal:

```sh
curl -i http://localhost:3000/api/health
```

To exercise the API directly, use `POST /api/auth/login` with JSON `{"loginId":"...","password":"..."}`, then verify the returned `userId` with `POST /api/auth/verify-otp` and JSON `{"userId":123,"otp":"123456"}`. Use the returned JWT as `Authorization: Bearer <token>` on protected routes. Expected permission check: an administrator request to `GET /api/records` returns HTTP 403. Do not share actual passwords, OTPs, or tokens in screenshots or reports.

To stop the demonstration stack, run `docker compose down`. This preserves the database volume. To remove the local demo database as well, run `docker compose down -v` only when you are certain its contents are disposable.

## Authentication and OTP

Login endpoint: `POST /api/auth/login` with `{ "loginId": "...", "password": "..." }`. The response contains a temporary `userId`; verify with `POST /api/auth/verify-otp` and `{ "userId": 1, "otp": "123456" }`. OTPs expire after five minutes and three invalid attempts cause a 15 minute lockout.

In development, OTPs are printed to the backend process output. In production, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`; production login returns a service error if email delivery is not configured. JWT signing uses `JWT_SECRET`; tokens expire after two hours. The browser keeps the access token in session storage.

## Roles and endpoints

- Students can view their own profile, registered courses, and academic results. Course visibility uses `GET /api/students/me/courses`; results use `GET /api/records` and are scoped to the authenticated student account.
- Staff can search authorised students, register active courses with `POST /api/records/enrollments`, and enter/update results with `POST /api/records/results`. The API requires an existing registration before accepting a grade. GPA is weighted by course credit units; CGPA is recalculated across completed courses.
- Administrators can manage users and the academic catalogue (courses, departments, programmes, sessions, and semesters) through `/api/admin/catalog`. They can view system statistics and audit events, but cannot view or change grades. Audit rows are protected from update and deletion by a PostgreSQL trigger.

All protected API calls require `Authorization: Bearer <token>`. Set `CORS_ORIGIN` to the exact frontend origin for deployment. Configure TLS at the reverse proxy/load balancer and use managed database credentials and backups in production.

## Development without Docker

Manual mode still requires a running PostgreSQL server. The terminal prompt in your error already ends in `backend %`, which means you are inside the backend folder. Do **not** run `cd backend` there. Either return to the project root first (`cd ..`) or run the backend commands directly from the current folder.

First create `backend/.env` (from the project root; if already in `backend`, use `cp ../.env.example .env` as a starting point) and make sure it contains these settings. Replace the placeholder database password with the password configured for your local PostgreSQL account. Generate a fresh secret with `openssl rand -hex 32` and paste its output as `JWT_SECRET`—do not use the example value:

```dotenv
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=academic_portal
DB_USER=postgres
DB_PASSWORD=your_local_postgres_password
JWT_SECRET=paste_a_fresh_random_value_here
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

If PostgreSQL is not installed/running on macOS, install/start it (for example, with Homebrew: `brew install postgresql@15` then `brew services start postgresql@15`). Create the database named `academic_portal` using your PostgreSQL setup. Only after the database server is running, install dependencies and apply the schema.

From the project root:

```sh
cd backend
npm ci
npm run db:migrate
npm run dev
```

If your prompt already shows `backend %`, run only `npm ci`, `npm run db:migrate`, and `npm run dev`—omit `cd backend`.

`npm run dev` starts the API in the foreground; rerun it after code changes. It does not use Node's recursive watcher because that watcher can exceed file-watcher limits on macOS. In a second terminal, start the frontend:

```sh
cd frontend
npm ci
npm start
```

Open the Vite URL printed in the frontend terminal (usually `http://localhost:5173`). The frontend defaults to the API at `http://localhost:5000/api`; set `VITE_API_URL` before starting Vite if your API uses a different URL. Bootstrap the admin from the `backend` directory using the command above, then follow “Login and end-to-end demo test.”

If you see `JWT_SECRET must be set`, create or correct `backend/.env`; it must be beside `backend/server.js`, and the secret must be at least 32 characters. If migration reports `ECONNREFUSED ...:5432`, PostgreSQL is not listening; start it and verify the database exists. If you see an authentication/password error, correct `DB_USER` and `DB_PASSWORD`. Then rerun `npm run db:migrate` before `npm run dev`. Do not run the server or migration from a directory other than `backend` in this manual setup.
# Staff Dashboard — Setup & Usage

Apply the additive database changes before using the staff workspace:

```sh
cd backend
npm run db:migrate
```

Create staff accounts from the administrator's **User accounts** screen. Set a department matching the department value on the student's profile and courses (the current student creation flow uses Programme as the department). Staff authenticate with their staff login ID and password, then complete email OTP verification. On the staff dashboard, open **Manage records** to search the directory, inspect a read-only student academic profile, and enter or update a score (0–100). The server computes the grade, GPA and CGPA. For score corrections over five points, provide the reason in the form.

To verify a result was audited, sign in as the staff user and inspect **My recent activity** at the bottom of the records workspace. Administrators can also inspect the read-only system audit page. Existing staff accounts created before department support must be assigned a department by an administrator; see [Staff dashboard technical notes](docs/STAFF_MODULE.md).

# Admin Dashboard — Setup & Usage

The administrator overview, searchable account list, read-only student/results oversight, personal activity, and immutable audit viewer use the existing `/` dashboard, **User accounts**, and **Audit logs** pages. Sensitive account actions require the admin password and a fresh email OTP; the resulting authorization grant expires after five minutes. In development the step-up code is printed in backend logs; in production it is sent via configured SMTP. A reason is required for role and activation changes. The last active administrator and the signed-in administrator cannot be deactivated or demoted.

Apply migrations and restart the backend after pulling these changes. For Docker, rebuild/restart with `docker compose up --build -d`. Audit export is available from the Audit logs view. Audit rows are append-only in PostgreSQL; the API provides read endpoints only, and administrators are denied the academic result-write API.

This is a partial adaptation of the supplied administrator brief, not a complete implementation of all requested operations. Password-reset/email-change workflows, welcome-link provisioning, reference-data CRUD, system configuration, charts/time-series, and full account-detail pages are not implemented yet. Newly created accounts still use the existing initial-password flow; use non-production credentials for demonstrations.

# Student Dashboard — Setup & Usage

Apply migrations and rebuild/restart the app. Sign in with the student’s matriculation number, password, and email OTP. The dashboard shows the student’s own semester results, GPA/CGPA, semester summary, and GPA trend; students without results see an explanatory empty state. **Profile** provides read-only academic identity, phone update, password change, and the student’s own recent activity. Password changes require the current password and invalidate all device tokens, so the student must sign in again with OTP. Student result-write routes are not available. See [Student module notes](docs/STUDENT_MODULE.md) for access isolation and remaining limitations.


Demo passwords are not stored in this repository. Create fresh passwords locally when bootstrapping accounts. If any previously documented demo password was used, reset it before continuing; changing a README does not rotate a database password.
