-- Academic reference data and course catalogue managed by administrators.
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programmes (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(department_id, name)
);

CREATE TABLE IF NOT EXISTS academic_sessions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE CHECK (name ~ '^[0-9]{4}/[0-9]{4}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE academic_sessions ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS semesters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(40) NOT NULL UNIQUE,
  term_order SMALLINT NOT NULL UNIQUE CHECK (term_order BETWEEN 1 AND 10),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS programme_id INTEGER REFERENCES programmes(id) ON DELETE RESTRICT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS level SMALLINT CHECK (level BETWEEN 100 AND 800);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester_id INTEGER REFERENCES semesters(id) ON DELETE RESTRICT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS programme_id INTEGER REFERENCES programmes(id) ON DELETE RESTRICT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS registered_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

INSERT INTO departments(name)
SELECT DISTINCT trim(department) FROM (
  SELECT department FROM students WHERE department IS NOT NULL AND trim(department) <> ''
  UNION SELECT department FROM courses WHERE department IS NOT NULL AND trim(department) <> ''
) d ON CONFLICT(name) DO NOTHING;

INSERT INTO programmes(department_id, name)
SELECT DISTINCT d.id, trim(s.program)
FROM students s JOIN departments d ON d.name=trim(s.department)
WHERE s.program IS NOT NULL AND trim(s.program) <> ''
ON CONFLICT(department_id,name) DO NOTHING;

UPDATE students s SET programme_id=p.id
FROM programmes p JOIN departments d ON d.id=p.department_id
WHERE s.programme_id IS NULL AND p.name=trim(s.program) AND d.name=trim(s.department);

INSERT INTO academic_sessions(name)
SELECT DISTINCT academic_session FROM enrollments WHERE academic_session ~ '^[0-9]{4}/[0-9]{4}$'
ON CONFLICT(name) DO NOTHING;
UPDATE academic_sessions SET is_current=TRUE
WHERE id=(SELECT id FROM academic_sessions ORDER BY name DESC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM academic_sessions WHERE is_current=TRUE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_sessions_one_current ON academic_sessions(is_current) WHERE is_current=TRUE;
INSERT INTO academic_sessions(name)
SELECT CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 8
  THEN EXTRACT(YEAR FROM CURRENT_DATE)::int::text || '/' || (EXTRACT(YEAR FROM CURRENT_DATE)::int + 1)::text
  ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::int - 1)::text || '/' || EXTRACT(YEAR FROM CURRENT_DATE)::int::text END
ON CONFLICT(name) DO NOTHING;

INSERT INTO semesters(name,term_order) VALUES
 ('First Semester',1),('Second Semester',2),('Summer',3)
ON CONFLICT(name) DO NOTHING;

UPDATE courses c SET programme_id=p.id
FROM programmes p JOIN departments d ON d.id=p.department_id
WHERE c.programme_id IS NULL AND p.name=trim(c.department) AND d.name=trim(c.department);
UPDATE courses c SET semester_id=sm.id
FROM semesters sm
WHERE c.semester_id IS NULL AND (
  (lower(c.semester)='fall' AND sm.name='First Semester') OR
  (lower(c.semester)='spring' AND sm.name='Second Semester') OR
  (lower(c.semester)='summer' AND sm.name='Summer')
);

CREATE INDEX IF NOT EXISTS idx_courses_department_active ON courses(department,is_active,course_code);
CREATE INDEX IF NOT EXISTS idx_courses_programme_level ON courses(programme_id,level,is_active);
CREATE INDEX IF NOT EXISTS idx_enrollments_status_term ON enrollments(status,academic_session,semester);
CREATE INDEX IF NOT EXISTS idx_programmes_department_active ON programmes(department_id,is_active);

-- Preserve historical courses; only new catalogue entries are required to be active.
UPDATE courses SET is_active=TRUE WHERE is_active IS NULL;
