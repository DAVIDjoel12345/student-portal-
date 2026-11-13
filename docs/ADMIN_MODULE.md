# Administrator dashboard module

The administrator workspace remains within the current React + Express + PostgreSQL application; this project is not converted to Django.

## Implemented routes

| API | Description | Mutation |
| --- | --- | --- |
| `GET /api/admin/stats` | Live user, result, failure, and lockout counts | No |
| `GET /api/admin/users` | Searchable, filtered, paged account list | No |
| `GET /api/admin/users/:id` | Read-only user and recent activity | No |
| `POST /api/admin/reauth/start` + `/verify` | Password then email OTP; returns a five-minute step-up grant | Creates short-lived grant |
| `POST /api/admin/users` | Create staff/admin account; step-up required | Yes, audited |
| `PATCH /api/admin/users/:id/status` | Activate/deactivate with reason; step-up required | Yes, audited |
| `PATCH /api/admin/users/:id/role` | Staff/admin role change with reason; step-up required | Yes, audited |
| `PATCH /api/admin/users/:id/department` | Staff department assignment; step-up required | Yes, audited |
| `GET /api/admin/students`, `/results` | Read-only academic oversight | No |
| `GET /api/admin/audit-logs`, `/audit-logs/:id` | Read-only audit viewer | No |
| `GET /api/admin/audit-logs/export` | Filtered CSV export; logs the export | Appends audit event |
| `GET /api/admin/my-activity` | Current admin's audit events | No |

All admin API routes require an active admin account and a JWT issued after the normal login OTP. Failed role checks are recorded as `UNAUTHORIZED_ACCESS`. Admin result writes are separately forbidden by the records API. There is intentionally no admin result edit/delete API, nor any audit-log update/delete API. PostgreSQL enforces audit immutability with the existing `audit_logs_immutable` trigger.

## Step-up flow

```text
Sensitive UI action
  -> admin re-enters account password
  -> API sends a new six-digit OTP to registered email (5 minute expiry)
  -> admin submits OTP
  -> API consumes OTP and returns a signed 5-minute step-up grant
  -> mutation checks grant + admin role and records the action in audit_logs
```

## Permission boundaries and audit actions

Admins can manage staff/admin/student accounts through their available account flows and inspect student/results data. They cannot mutate grades or audit rows. Self-deactivation and self-role changes are rejected. The last active admin cannot be deactivated or demoted; the check is protected by a transaction and row locks. Reactivating an account does not bypass OTP; authentication still performs OTP on login. Deactivated users are rejected on every API request because token authentication re-reads `is_active` from PostgreSQL.

Audit actions currently emitted by this module include `ADMIN_STEP_UP_FAILED`, `ADMIN_STEP_UP_VERIFIED`, `USER_ACCOUNT_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_ROLE_CHANGED`, `STAFF_DEPARTMENT_CHANGED`, `AUDIT_LOG_EXPORTED`, and `UNAUTHORIZED_ACCESS`.

## Not yet implemented from the full brief

Reset-password links, verified email changes, admin welcome-link provisioning, reference-data CRUD and semester locking, persistent system configuration, failed-login time-series/charts, CSV date-filter parity, and a complete paged user-detail interface remain future work. The current account creation interface still provisions the initial password directly; do not use real production credentials in demos. Email OTP delivery for step-up uses configured SMTP in production and backend logs only in development.
