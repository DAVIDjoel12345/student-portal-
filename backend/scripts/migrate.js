const { getDb } = require('../config/db');
const bcrypt = require('bcryptjs');

const runMigrations = async () => {
  const db = getDb();
  console.log('Running database migrations...');

  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login_id TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('student', 'staff', 'admin')),
        display_name TEXT,
        program TEXT,
        department TEXT,
        year INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
        otp_hash TEXT,
        otp_expires_at TEXT,
        otp_attempts INTEGER DEFAULT 0,
        locked_until TEXT,
        token_version INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`, (err) => err ? reject(err) : console.log('users table ready'));

      db.run(`CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_code TEXT UNIQUE NOT NULL,
        course_name TEXT NOT NULL,
        credits INTEGER NOT NULL DEFAULT 3,
        department TEXT,
        programme_id INTEGER,
        level INTEGER,
        semester_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`, (err) => err ? reject(err) : console.log('courses table ready'));

      db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_id TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        program TEXT,
        year INTEGER DEFAULT 1,
        department TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'graduated')),
        created_at TEXT DEFAULT (datetime('now'))
      )`, (err) => err ? reject(err) : console.log('students table ready'));

      db.run(`CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        academic_session TEXT NOT NULL,
        semester TEXT NOT NULL,
        status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'dropped', 'failed')),
        score INTEGER,
        grade TEXT,
        final_grade REAL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(student_id, course_id, academic_session, semester)
      )`, (err) => err ? reject(err) : console.log('enrollments table ready'));

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id INTEGER,
        ip_address TEXT,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`, (err) => err ? reject(err) : console.log('audit_logs table ready'));

      db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`, (err) => err ? reject(err) : console.log('departments table ready'));

      db.run(`CREATE TABLE IF NOT EXISTS programmes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`, (err) => err ? reject(err) : console.log('programmes table ready'));

      db.run(`CREATE TABLE IF NOT EXISTS academic_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        is_current INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`, (err) => err ? reject(err) : console.log('academic_sessions table ready'));

      db.run(`CREATE TABLE IF NOT EXISTS semesters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        term_order INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`, (err) => err ? reject(err) : console.log('semesters table ready'));

      db.run(`CREATE INDEX IF NOT EXISTS idx_users_login ON users(login_id)`, (err) => err ? reject(err) : null);
      db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`, (err) => err ? reject(err) : null);
      db.run(`CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id)`, (err) => err ? reject(err) : null);
      db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id)`, (err) => err ? reject(err) : null);
      db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id)`, (err) => err ? reject(err) : null);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`, (err) => err ? reject(err) : null);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`, (err) => err ? reject(err) : null);
    }, (err) => err ? reject(err) : resolve());
  });

  console.log('Seeding default admin user...');
  const adminLoginId = process.env.ADMIN_LOGIN_ID || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@your-domain.com';
  const adminDisplayName = process.env.ADMIN_DISPLAY_NAME || 'System Administrator';

  const adminExists = await new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE login_id = ?', [adminLoginId], (err, row) => err ? reject(err) : resolve(!!row));
  });

  if (!adminExists) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    await new Promise((resolve, reject) => {
      db.run('INSERT INTO users (login_id, email, password_hash, role, display_name, status) VALUES (?, ?, ?, ?, ?, ?)', [adminLoginId, adminEmail, hashed, 'admin', adminDisplayName, 'active'], function(err) { err ? reject(err) : resolve(); });
    });
    console.log(`Default admin created: login=${adminLoginId}, password=${adminPassword}`);
  }

  console.log('Seeding default departments...');
  const departments = ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Business Administration', 'Law'];
  for (const dept of departments) {
    const exists = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM departments WHERE name = ?', [dept], (err, row) => err ? reject(err) : resolve(!!row));
    });
    if (!exists) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO departments (name) VALUES (?)', [dept], function(err) { err ? reject(err) : resolve(); });
      });
    }
  }

  console.log('Seeding default academic sessions...');
  const sessions = ['2023/2024', '2024/2025', '2025/2026'];
  for (const session of sessions) {
    const exists = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM academic_sessions WHERE name = ?', [session], (err, row) => err ? reject(err) : resolve(!!row));
    });
    if (!exists) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO academic_sessions (name, is_current) VALUES (?, ?)', [session, session === '2025/2026' ? 1 : 0], function(err) { err ? reject(err) : resolve(); });
      });
    }
  }

  console.log('Seeding default semesters...');
  const semesters = [{ name: 'First Semester', order: 1 }, { name: 'Second Semester', order: 2 }, { name: 'Summer Semester', order: 3 }];
  for (const sem of semesters) {
    const exists = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM semesters WHERE name = ?', [sem.name], (err, row) => err ? reject(err) : resolve(!!row));
    });
    if (!exists) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO semesters (name, term_order) VALUES (?, ?)', [sem.name, sem.order], function(err) { err ? reject(err) : resolve(); });
      });
    }
  }

  console.log('Migrations completed successfully');
};

if (require.main === module) {
  runMigrations().catch(err => { console.error('Migration failed:', err); process.exit(1); });
}

module.exports = { runMigrations };
