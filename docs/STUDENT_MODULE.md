# Student dashboard module

The student dashboard uses the existing React/Express/PostgreSQL stack. Student API routes require an active `student` role. Transcript queries join the authenticated account to its own student row; account/profile and activity queries use the authenticated user ID, never a browser-supplied student ID.

## Student-facing capabilities

- Dashboard summary and semester transcript sourced from the database, with an explicit no-results state (no fabricated `0.00` CGPA).
- GPA trend and semester summary derived from server-calculated records; course details and grade points come from the API.
- Read-only identity details and academic profile.
- Self-service phone update with server-side format validation and `PHONE_UPDATED` audit event.
- Password change requires the current password and a 12-character minimum. It writes `PASSWORD_CHANGED` and increments `users.token_version`, invalidating all existing JWTs, including the current device; the student must sign in again and complete OTP.
- Student activity endpoint returns audit rows for the current user only. Profile/transcript views are audited.

## Isolation and access rules

`GET /api/records` only returns the student attached to the authenticated user. `/api/students/me`, `/summary`, `/activity`, `/me/phone`, and `/me/password` do not accept a student identifier. Student attempts to access staff/admin APIs are rejected by role middleware and recorded as `UNAUTHORIZED_ACCESS` where an authenticated account is available. Student result/course mutation routes do not exist; administrator result access is also explicitly denied by the records API.

## Not implemented yet

Dual-confirmation email changes, profile image upload, active-device/session listing and selective revocation, PDF result statements, a dedicated semester-detail route, and chart-library/CGPA reference-line controls are not implemented. JWT token-version invalidation provides a logout-all effect but cannot display individual devices. Student passwords currently use bcrypt hashing, with a 12-character minimum; additional common-password/attribute-similarity checks and password-change notification email remain to be added for production.
