-- Additive compatibility migration for earlier portal schemas.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, login_id VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL CHECK (role IN ('student','staff','admin')),
  display_name VARCHAR(160) NOT NULL, student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, otp_hash TEXT, otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='identifier')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='login_id') THEN
    ALTER TABLE users RENAME COLUMN identifier TO login_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='login_id') THEN
    ALTER TABLE users ADD COLUMN login_id VARCHAR(100);
    UPDATE users SET login_id = COALESCE(email, 'account-' || id::text);
    ALTER TABLE users ALTER COLUMN login_id SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id_compat ON users(login_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='display_name') THEN
    ALTER TABLE users ADD COLUMN display_name VARCHAR(160);
    UPDATE users SET display_name = COALESCE(email, login_id);
    ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='student_id') THEN
    ALTER TABLE users ADD COLUMN student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='otp_locked_until')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='locked_until') THEN
    ALTER TABLE users RENAME COLUMN otp_locked_until TO locked_until;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='locked_until') THEN
    ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='otp_hash') THEN ALTER TABLE users ADD COLUMN otp_hash TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='otp_expires_at') THEN ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMPTZ; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='otp_attempts') THEN ALTER TABLE users ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active') THEN ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE; END IF;
END $$;

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY, course_code VARCHAR(20) UNIQUE NOT NULL, course_name VARCHAR(200) NOT NULL,
  credits INTEGER NOT NULL CHECK (credits BETWEEN 1 AND 6), department VARCHAR(120), semester VARCHAR(20)
);
UPDATE courses SET department='Business Administration' WHERE department='Business';
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  academic_session VARCHAR(20) NOT NULL DEFAULT '2023/2024', semester VARCHAR(40) NOT NULL DEFAULT 'Unknown',
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE, grade VARCHAR(5),
  final_grade NUMERIC(4,2) CHECK (final_grade BETWEEN 0 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','completed','dropped','withdrawn'))
);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS academic_session VARCHAR(20) NOT NULL DEFAULT '2023/2024';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS semester VARCHAR(40) NOT NULL DEFAULT 'Unknown';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score BETWEEN 0 AND 100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS department VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
UPDATE students SET department=program WHERE department IS NULL;
UPDATE enrollments e SET semester=COALESCE(c.semester,'Unknown') FROM courses c WHERE e.course_id=c.id AND e.semester='Unknown';
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_unique_term ON enrollments(student_id,course_id,academic_session,semester);
CREATE TABLE IF NOT EXISTS academic_records (
  id SERIAL PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_session VARCHAR(20) NOT NULL DEFAULT '2023/2024', semester VARCHAR(40) NOT NULL,
  gpa NUMERIC(4,2), credits_earned INTEGER NOT NULL DEFAULT 0, total_credits INTEGER NOT NULL DEFAULT 0,
  cumulative_gpa NUMERIC(4,2), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS academic_session VARCHAR(20) NOT NULL DEFAULT '2023/2024';
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_record_unique_term ON academic_records(student_id,academic_session,semester);

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
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Audit logs are append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_id_compat ON users(login_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Attach legacy student accounts to their matching matriculation record where possible.
UPDATE users u SET student_id=s.id FROM students s WHERE u.role='student' AND u.student_id IS NULL AND lower(u.login_id)=lower(s.student_id);
