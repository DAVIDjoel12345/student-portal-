# Secure Student Academic Record Portal

## Project topic

**Development of a Secure Student Academic Record Portal Using Multi-Factor Authentication**

## Abstract

This project delivers a web-based portal for viewing and managing university academic records. Students can securely sign in and view their profile, semester results, GPA and cumulative GPA (CGPA). Authorised academic staff can access student records and enter course results. Administrators manage accounts, roles and system activity but are not authorised to view or change grades. Authentication combines a password with a six-digit email one-time password (OTP). The application is implemented with a React and TypeScript frontend, an Express/Node.js API and PostgreSQL. It includes database migrations, role checks, audit events and a Docker Compose deployment configuration.

## 1. Introduction

Academic records contain sensitive personal information and must remain accurate, private and available to their owners and authorised university personnel. Paper-based or loosely controlled workflows can make it difficult to access records promptly and to determine who changed them. This project provides a central portal with role-specific access, database-backed academic records and a second authentication factor.

## 2. Problem statement

Students need convenient access to their academic results, while academic officers need a controlled way to maintain those results. A system without strong authentication, access restrictions and traceable changes risks unauthorised disclosure or alteration. The portal addresses these needs through password-plus-OTP sign-in, role-based API permissions, GPA calculations and append-only audit records.

## 3. Aim and objectives

The aim is to implement a secure, usable student academic-record portal. Its objectives are to:

1. Provide separate student, staff and administrator experiences.
2. Require a password and six-digit email OTP for sign-in.
3. Store passwords as salted hashes and protect application secrets through environment configuration.
4. Restrict academic-record operations to authorised staff and students to their own records.
5. Calculate semester GPA and cumulative GPA from course grade points and credit units.
6. Record important authentication, account-management and academic-record events.
7. Provide schema migrations and repeatable local/deployment setup instructions.

## 4. Scope and user roles

### Students

Students authenticate using their matriculation number and password, complete OTP verification, and view their own profile and completed academic results, including semester GPA and CGPA.

### Staff / academic officers

Staff authenticate using a staff login ID and password, complete OTP verification, view relevant student/course information and add or update course results. The application calculates term and cumulative GPA using course credit weights.

### Administrators

Administrators create and manage accounts, assign permitted staff/admin roles, activate or deactivate accounts, view system statistics and read audit logs. Administrators are explicitly denied access to academic grade records. Audit rows are protected from update and deletion at the database level.

## 5. Functional requirements

- Password-based authentication followed by email OTP verification.
- Role-specific dashboards and protected API routes.
- Student profile and academic-history views.
- Staff student/course views and result entry/update.
- Credit-weighted GPA and CGPA calculations.
- Administrator account, role, status, statistics and audit-log management.
- Audit records for significant sign-in, account and result operations.
- Session token expiry and logout.

## 6. Security requirements and implementation

- Passwords use bcrypt hashing; credentials are not stored in plaintext.
- OTPs are six digits, expire after five minutes, and are limited to three incorrect attempts before a temporary lockout.
- OTP material is protected with a server-side secret; successful verification is one-time.
- JWTs expire after two hours; protected requests re-check account status and role against the database.
- Helmet security headers, CORS origin configuration, request-size limits and authentication rate limiting are applied by the API.
- PostgreSQL queries use parameters, and academic result writes are transactional.
- Students can only retrieve records associated with their account; administrators cannot retrieve grade records.
- Audit rows are append-only through a PostgreSQL trigger.
- Database credentials, JWT secret and SMTP credentials are supplied using environment variables and must not be committed.

**Security note:** the brief names Django as its preferred backend framework. The supplied implementation is instead Node.js/Express with PostgreSQL and React/TypeScript. This report documents the actual code. If Django is a mandatory academic requirement, a separate framework migration would be needed; this project should not be presented as Django-based.

## 7. Technology and architecture

| Layer | Implementation |
|---|---|
| User interface | React 18, TypeScript, Vite, CSS |
| API | Node.js 20+, Express |
| Database | PostgreSQL 15 |
| Authentication | bcrypt, six-digit email OTP, JWT |
| Email | SMTP via Nodemailer (required for production OTP delivery) |
| Deployment | Docker Compose, Nginx reverse proxy |

The browser communicates with the API over `/api`. The API validates identity, role and input, then accesses PostgreSQL. Docker Compose starts PostgreSQL, applies migrations, waits for backend health, starts the frontend, and routes browser/API traffic through Nginx.

## 8. Database design

The schema contains these main entities:

- `users`: login ID, email, password hash, role, active status and OTP state; optionally links a student account to its student profile.
- `students`: matriculation number, name, email, programme, year and status.
- `courses`: course code, title, credit units and department.
- `enrollments`: student/course/academic term, grade, grade points and completion status.
- `academic_records`: per-student term GPA, credits and cumulative GPA.
- `audit_logs`: actor, action, target resource, request IP, details and timestamp.

Fresh installations use `database/001_init.sql`; `database/002_compat.sql` applies compatibility changes for older schemas. The initial migration includes demonstration student/course/result rows but does not create demo login credentials.

## 9. GPA calculation

For each completed course, grade points are multiplied by credit units. Term GPA is the sum of weighted grade points divided by the sum of credit units for that term. CGPA is the corresponding weighted average across completed terms. The current API accepts the mapping A=5, B=4, C=3, D=2, E=1, F=0; confirm and update this mapping with the institution before real academic use.

## 10. User interface

The portal provides a responsive blue-themed sign-in and OTP flow, role-specific dashboard views, student academic/profile pages, staff result-entry controls, and administrative account/audit views. The frontend is a Vite application and its production bundle is served by Nginx.

## 11. Testing and demonstration plan

Use the run guide in the README to start the application and create local demonstration accounts. Verify at minimum:

1. `GET /api/health` reports healthy after startup.
2. A staff account can request OTP, verify it, list students/courses and record a result.
3. A student account can request OTP and sees only its own profile/results and calculated GPA/CGPA.
4. An administrator can manage accounts and read audit logs, but a request for academic grade records returns HTTP 403.
5. An incorrect OTP is rejected; after three incorrect attempts the account is temporarily locked.
6. An inactive account cannot use an existing token for protected API requests.
7. Database audit rows cannot be updated or deleted through normal SQL operations.

The frontend production bundle has been built successfully and dependency audits were clean at the time of the code review. Full live integration testing requires Docker and a running PostgreSQL instance; those services were not available in the development environment used to prepare this document.

## 12. Limitations and future work

- Confirm institutional grading scale, academic-term conventions and approval workflows before production use.
- Configure a trusted SMTP provider and test mail deliverability; development OTPs are printed to the backend process log.
- Add automated API/database integration tests and end-to-end browser tests.
- Consider staff department-level authorization and formal result publication/approval workflows.
- Establish production TLS, database backups, monitoring, log retention and incident response procedures.
- The current interface does not provide a bulk spreadsheet import workflow.

## 13. Conclusion

The implemented portal provides a database-backed foundation for protected academic-record access, staff result maintenance and administrative account management. Password-plus-OTP authentication, role checks, audit logging and weighted GPA calculations address the project’s core goals. Production deployment should follow the README, use real SMTP and strong secrets, and be validated against university policies and grading rules.
