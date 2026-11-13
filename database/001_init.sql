-- Fresh-install schema for the Secure Student Academic Record Portal.
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(30) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(30),
  program VARCHAR(150) NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 8),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','graduated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login_id VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student','staff','admin')),
  display_name VARCHAR(160) NOT NULL,
  student_id INTEGER UNIQUE REFERENCES students(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  otp_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  course_code VARCHAR(20) UNIQUE NOT NULL,
  course_name VARCHAR(200) NOT NULL,
  credits INTEGER NOT NULL CHECK (credits BETWEEN 1 AND 6),
  department VARCHAR(120),
  semester VARCHAR(20) CHECK (semester IN ('fall','spring','summer'))
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  academic_session VARCHAR(20) NOT NULL DEFAULT '2023/2024',
  semester VARCHAR(40) NOT NULL,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  grade VARCHAR(5),
  final_grade NUMERIC(4,2) CHECK (final_grade BETWEEN 0 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','completed','dropped','withdrawn'))
);

CREATE TABLE IF NOT EXISTS academic_records (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_session VARCHAR(20) NOT NULL DEFAULT '2023/2024',
  semester VARCHAR(40) NOT NULL,
  gpa NUMERIC(4,2),
  credits_earned INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  cumulative_gpa NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  ip_address VARCHAR(45),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id_compat ON users(login_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_unique_term ON enrollments(student_id,course_id,academic_session,semester);
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_record_unique_term ON academic_records(student_id,academic_session,semester);

CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Audit logs are append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_session ON enrollments(student_id, academic_session, semester);
CREATE INDEX IF NOT EXISTS idx_academic_records_student ON academic_records(student_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

INSERT INTO students(student_id,first_name,last_name,email,program,year,status) VALUES
 ('STU001','John','Doe','john.doe@school.edu','Computer Science',3,'active'),
 ('STU002','Jane','Smith','jane.smith@school.edu','Computer Science',2,'active'),
 ('STU003','Bob','Johnson','bob.johnson@school.edu','Business Administration',4,'graduated')
ON CONFLICT(student_id) DO NOTHING;

INSERT INTO courses(course_code,course_name,credits,department,semester) VALUES
 ('CS101','Introduction to Computer Science',3,'Computer Science','fall'),
 ('CS201','Data Structures and Algorithms',4,'Computer Science','fall'),
 ('CS301','Database Systems',3,'Computer Science','spring'),
 ('BA101','Introduction to Business',3,'Business','fall'),
 ('BA201','Organizational Behavior',3,'Business','spring')
ON CONFLICT(course_code) DO NOTHING;

INSERT INTO enrollments(student_id,course_id,academic_session,semester,grade,final_grade,status)
SELECT 1,c.id,'2023/2024','Fall 2023',g.grade,g.points,'completed' FROM courses c JOIN (VALUES ('CS101','A',5.0),('CS201','A-',4.5)) AS g(code,grade,points) ON c.course_code=g.code
ON CONFLICT DO NOTHING;
INSERT INTO enrollments(student_id,course_id,academic_session,semester,grade,final_grade,status)
SELECT 1,c.id,'2023/2024','Spring 2024',g.grade,g.points,'completed' FROM courses c JOIN (VALUES ('CS301','B+',4.0)) AS g(code,grade,points) ON c.course_code=g.code
ON CONFLICT DO NOTHING;

INSERT INTO academic_records(student_id,academic_session,semester,gpa,credits_earned,total_credits,cumulative_gpa)
SELECT 1,'2023/2024',s.semester,ROUND(SUM(e.final_grade*c.credits)/SUM(c.credits),2),SUM(c.credits),SUM(c.credits),NULL
FROM (VALUES ('Fall 2023'),('Spring 2024')) s(semester) JOIN enrollments e ON e.student_id=1 AND e.semester=s.semester JOIN courses c ON c.id=e.course_id GROUP BY s.semester
ON CONFLICT(student_id,academic_session,semester) DO NOTHING;
