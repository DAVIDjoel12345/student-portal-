# Staff dashboard

The staff workspace is implemented in the existing React, Express, and PostgreSQL application.

## Routes and permissions

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Staff dashboard and summary statistics | Active, OTP-authenticated staff |
| `/records` | Search directory, read-only student academic profile, enter/update result, own activity | Active, OTP-authenticated staff |
| `/api/records/catalog` | Server-filtered directory (`q`, `level`, `programme`, `page`, `limit`) | Staff; department scoped |
| `/api/records/students/:id` | Department-scoped student profile and records | Staff; other-department IDs return 404 |
| `/api/records/results` | Create or update a result | Staff; department and course checked server-side |
| `/api/records/activity` | Own audit history | Staff; actor-filtered |

Staff can view student academic information and manage student course registrations and results only within their assigned department. Staff cannot create or change the master course catalogue. Result deletion is not exposed. Administrators cannot call grade-record endpoints, and audit rows have a database trigger preventing update/delete.

## Result entry flow

```text
Staff enters student + course + term + score
  -> API verifies active staff role and assigned department
  -> API validates student/course/term and score range
  -> API maps score to grade and grade point (never trusts grade from browser)
  -> transaction registers course for student/term and appends audit event
  -> staff enters score only for registered course
  -> transaction calculates grade, recalculates semester GPA and CGPA, appends audit event
  -> response returns success; staff activity page shows the event
```

Grade bands: A 70–100 (5), B 60–69 (4), C 50–59 (3), D 45–49 (2), E 40–44 (1), F 0–39 (0). A reason is required when an existing score changes by more than five points.

## Department setup

Run `npm run db:migrate` in the backend to add department and score columns. Existing students are assigned their current `program` as their department. When an administrator creates a staff account, enter the exact department value used by its students and courses (for example, `Computer Science`). Older staff accounts without a department are denied directory/course access until an administrator assigns one. To assign an existing staff account, call the admin-only endpoint with a valid admin token:

```sh
curl -X PATCH http://localhost:5000/api/admin/users/STAFF_USER_ID/department \
  -H 'Authorization: Bearer ADMIN_TOKEN' -H 'Content-Type: application/json' \
  -d '{"department":"Computer Science"}'
```

Audit actions emitted for academic changes: `RESULT_CREATED` and `RESULT_UPDATED`, each with the result resource and before/after score, grade, and grade-point details. Staff activity is restricted to the logged-in actor.
