const express = require('express');
const { body, validationResult } = require('express-validator');
const { get, run, all } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const router = express.Router();

router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const stats = await get(`SELECT
      (SELECT COUNT(*) FROM users WHERE role='student' AND status='active') AS total_students,
      (SELECT COUNT(*) FROM users WHERE role='staff') AS staff_count,
      (SELECT COUNT(*) FROM enrollments e JOIN students s ON s.id=e.student_id WHERE e.status='enrolled') AS pending_results,
      (SELECT COUNT(*) FROM enrollments e JOIN students s ON s.id=e.student_id WHERE e.status='completed') AS completed_results,
      (SELECT COALESCE(SUM(final_grade),0) FROM enrollments WHERE status='completed') AS total_points_earned,
      (SELECT COALESCE(SUM(credits),0) FROM courses) AS total_course_credits`);
    res.json(stats);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load platform statistics' }); }
});

router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await all('SELECT id,login_id,email,role,display_name,program,department,status,created_at FROM users ORDER BY created_at DESC LIMIT 500');
    res.json(users);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load users' }); }
});

router.patch('/users/:userId/status', authenticateToken, requireRole('admin'), [body('status').isIn(['active', 'suspended'])], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid status value' });
  const { status } = req.body;
  try {
    const result = await run('UPDATE users SET status=? WHERE id=? RETURNING id', [status, req.params.userId]);
    if (!result.changes) return res.status(404).json({ error: 'User not found' });
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, status === 'suspended' ? 'USER_SUSPENDED' : 'USER_ACTIVATED', 'user', req.params.userId, req.ip]);
    res.json({ message: `User ${status} successfully` });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to update user status' }); }
});

router.post('/users', authenticateToken, requireRole('admin'), [body('loginId').trim().notEmpty(), body('email').isEmail(), body('password').isLength({ min: 8, max: 128 }), body('role').isIn(['student', 'staff'])], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid user details' });
  const { loginId, email, password, role, displayName, program, department } = req.body;
  try {
    const exists = await get('SELECT id FROM users WHERE login_id=?', [loginId.trim()]);
    if (exists) return res.status(409).json({ error: 'Login ID already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (login_id,email,password_hash,role,display_name,program,department,status) VALUES(?,?,?,?,?,?,?,\'active\') RETURNING id', [loginId.trim(), email, hashed, role, displayName || loginId.trim(), program || null, department || null]);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, 'USER_CREATED', 'user', result.lastID, req.ip]);
    const otp = String(crypto.randomInt(100000, 1000000));
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await run("UPDATE users SET otp_hash=?, otp_expires_at=?, otp_attempts=0 WHERE id=?", [hashOtp(otp), otpExpires, result.lastID]);
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) {
        return res.status(503).json({ error: 'Email verification is not configured' });
      }
      const nodemailer = await import('nodemailer');
      const implicitTls = process.env.SMTP_SECURE === 'true';
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: implicitTls,
        requireTLS: !implicitTls,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Your academic portal verification code',
        text: `Your sign-in code is ${otp}. It expires in five minutes.`
      });
    } else console.info(`Development OTP for ${email}: ${otp}`);
    res.status(201).json({ message: 'User created successfully. A verification code was sent to the email.', userId: result.lastID, mfaRequired: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to create user' }); }
});

router.get('/catalog', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const departments = await all('SELECT * FROM departments WHERE is_active=1');
    const programmes = await all('SELECT * FROM programmes WHERE is_active=1');
    const sessions = await all('SELECT * FROM academic_sessions WHERE is_active=1');
    const semesters = await all('SELECT * FROM semesters WHERE is_active=1');
    const courses = await all('SELECT * FROM courses WHERE is_active=1');
    res.json({ departments, programmes, sessions, semesters, courses });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load catalog' }); }
});

router.post('/catalog/:kind', authenticateToken, requireRole('admin'), async (req, res) => {
  const { kind } = req.params;
  const { name, departmentId, termOrder, courseCode, courseName, credits, programmeId, level, semesterId } = req.body;
  try {
    if (kind === 'departments') {
      await run('INSERT INTO departments (name) VALUES(?)', [name]);
    } else if (kind === 'programmes') {
      await run('INSERT INTO programmes (name, department_id) VALUES(?,?)', [name, departmentId]);
    } else if (kind === 'sessions') {
      await run('INSERT INTO academic_sessions (name) VALUES(?)', [name]);
    } else if (kind === 'semesters') {
      await run('INSERT INTO semesters (name, term_order) VALUES(?,?)', [name, termOrder]);
    } else if (kind === 'courses') {
      await run('INSERT INTO courses (course_code, course_name, credits, programme_id, level, semester_id) VALUES(?,?,?,?,?,?)', [courseCode, courseName, credits, programmeId, level, semesterId]);
    } else {
      return res.status(400).json({ error: 'Invalid catalog kind' });
    }
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, 'CATALOG_ITEM_CREATED', 'catalog', null, req.ip]);
    res.status(201).json({ message: 'Catalog item created successfully' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to create catalog item' }); }
});

router.patch('/catalog/courses/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { courseCode, courseName, credits, programmeId, level, semesterId, isActive } = req.body;
  try {
    await run('UPDATE courses SET course_code=?, course_name=?, credits=?, programme_id=?, level=?, semester_id=?, is_active=? WHERE id=?', [courseCode, courseName, credits, programmeId, level, semesterId, isActive ? 1 : 0, id]);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, 'COURSE_UPDATED', 'course', id, req.ip]);
    res.json({ message: 'Course updated successfully' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to update course' }); }
});

router.patch('/catalog/:type/:id/status', authenticateToken, requireRole('admin'), async (req, res) => {
  const { type, id } = req.params;
  const { isActive } = req.body;
  try {
    if (type === 'departments') {
      await run('UPDATE departments SET is_active=? WHERE id=?', [isActive ? 1 : 0, id]);
    } else if (type === 'programmes') {
      await run('UPDATE programmes SET is_active=? WHERE id=?', [isActive ? 1 : 0, id]);
    } else if (type === 'sessions') {
      await run('UPDATE academic_sessions SET is_active=? WHERE id=?', [isActive ? 1 : 0, id]);
    } else if (type === 'semesters') {
      await run('UPDATE semesters SET is_active=? WHERE id=?', [isActive ? 1 : 0, id]);
    } else {
      return res.status(400).json({ error: 'Invalid catalog type' });
    }
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, 'CATALOG_STATUS_UPDATED', 'catalog', id, req.ip]);
    res.json({ message: 'Catalog status updated successfully' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to update catalog status' }); }
});

router.patch('/catalog/sessions/:id/current', authenticateToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await run('UPDATE academic_sessions SET is_current=0');
    await run('UPDATE academic_sessions SET is_current=1 WHERE id=?', [id]);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, 'CURRENT_SESSION_SET', 'session', id, req.ip]);
    res.json({ message: 'Current session updated successfully' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to set current session' }); }
});

router.post('/reauth/start', authenticateToken, requireRole('admin'), [body('password').isString()], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Password required' });
  const { password } = req.body;
  try {
    const user = await get('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
    const passwordMatches = await bcrypt.compare(password, user?.password_hash || '');
    if (!passwordMatches) return res.status(401).json({ error: 'Invalid password' });
    const otp = String(crypto.randomInt(100000, 1000000));
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await run("UPDATE users SET otp_hash=?, otp_expires_at=? WHERE id=?", [hashOtp(otp), otpExpires, req.user.id]);
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) return res.status(503).json({ error: 'Email verification is not configured' });
      const nodemailer = await import('nodemailer');
      const implicitTls = process.env.SMTP_SECURE === 'true';
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: implicitTls, requireTLS: !implicitTls, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
      await transporter.sendMail({ from: process.env.SMTP_FROM, to: user.email, subject: 'Your academic portal verification code', text: `Your sign-in code is ${otp}. It expires in five minutes.` });
    } else console.info(`Development OTP for ${req.user.loginId}: ${otp}`);
    res.json({ message: 'Verification code sent to your email' });
  } catch (error) { console.error('Reauth start error:', error.message); res.status(500).json({ error: 'Unable to start reauthentication' }); }
});

router.post('/reauth/verify', authenticateToken, requireRole('admin'), [body('otp').matches(/^\d{6}$/)], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Six-digit code required' });
  const { otp } = req.body;
  try {
    const user = await get('SELECT otp_hash, otp_expires_at FROM users WHERE id=?', [req.user.id]);
    if (!user || !user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) return res.status(401).json({ error: 'Code expired' });
    if (hashOtp(otp) !== user.otp_hash) return res.status(401).json({ error: 'Incorrect verification code' });
    await run('UPDATE users SET otp_hash=NULL, otp_expires_at=NULL WHERE id=?', [req.user.id]);
    const stepUpToken = jwt.sign({ id: req.user.id, role: req.user.role, loginId: req.user.loginId, stepUp: true }, process.env.JWT_SECRET, { expiresIn: '10m', issuer: 'academic-record-portal', audience: 'academic-record-portal-client' });
    res.json({ stepUpToken });
  } catch (error) { console.error('Reauth verify error:', error.message); res.status(500).json({ error: 'Unable to verify code' }); }
});

router.get('/audit-logs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const logs = await all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json(logs);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load audit logs' }); }
});

router.get('/audit-logs/export', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const logs = await all('SELECT * FROM audit_logs ORDER BY created_at DESC');
    const csv = ['id,user_id,action,resource_type,resource_id,ip_address,details,created_at', ...logs.map(log => `${log.id},${log.user_id},${log.action},${log.resource_type},${log.resource_id},${log.ip_address},${log.details},${log.created_at}`)].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to export audit logs' }); }
});

router.get('/students', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const students = await all('SELECT * FROM students ORDER BY created_at DESC');
    res.json(students);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load students' }); }
});

router.get('/results', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const results = await all('SELECT * FROM enrollments WHERE status=\'completed\' ORDER BY created_at DESC');
    res.json(results);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load results' }); }
});

router.get('/my-activity', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const activity = await all('SELECT * FROM audit_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(activity);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load activity' }); }
});

module.exports = router;
