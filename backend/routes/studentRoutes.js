const express = require('express');
const { body, validationResult } = require('express-validator');
const { get, run, all } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const student = await get('SELECT id,login_id,email,display_name,program,year,department,created_at FROM users WHERE id=?', [req.user.id]);
    if (!student) return res.status(404).json({ error: 'Student profile not found' });
    const enrollments = await all(`SELECT e.id,e.course_id,e.academic_session,e.semester,e.status,e.score,e.grade,e.final_grade,e.created_at,c.course_code,c.course_name,c.credits FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? ORDER BY e.academic_session DESC,e.semester DESC`, [req.user.id]);
    res.json({ student, enrollments });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load student profile' }); }
});

router.patch('/profile', authenticateToken, requireRole('student'), [body('displayName').optional().trim().notEmpty(), body('program').optional().trim().notEmpty(), body('year').optional().isInt({ min: 1, max: 6 })], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid profile data' });
  const { displayName, program, year } = req.body;
  try {
    const updates = [];
    const params = [];
    if (displayName) { updates.push('display_name=?'); params.push(displayName); }
    if (program) { updates.push('program=?'); params.push(program); }
    if (year) { updates.push('year=?'); params.push(year); }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.user.id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id=?`, params);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, 'PROFILE_UPDATED', 'user', req.user.id, req.ip]);
    res.json({ message: 'Profile updated successfully' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to update profile' }); }
});

router.get('/enrollments', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const enrollments = await all(`SELECT e.id,e.course_id,e.academic_session,e.semester,e.status,e.score,e.grade,e.final_grade,c.course_code,c.course_name,c.credits FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? ORDER BY e.academic_session DESC,e.semester DESC`, [req.user.id]);
    res.json(enrollments);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load enrollments' }); }
});

router.post('/enrollments', authenticateToken, requireRole('student'), [body('courseId').isInt({ min: 1 }), body('academicSession').trim().notEmpty(), body('semester').trim().notEmpty()], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid enrollment data' });
  const { courseId, academicSession, semester } = req.body;
  try {
    const course = await get('SELECT * FROM courses WHERE id=?', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const existing = await get('SELECT * FROM enrollments WHERE student_id=? AND course_id=? AND academic_session=? AND semester=?', [req.user.id, courseId, academicSession, semester]);
    if (existing) return res.status(409).json({ error: 'Already enrolled in this course for this session' });
    await run('INSERT INTO enrollments (student_id,course_id,academic_session,semester,status) VALUES(?,?,?,?,\'enrolled\')', [req.user.id, courseId, academicSession, semester]);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address,details) VALUES(?,?,?,?,?,?)', [req.user.id, 'ENROLLMENT_REQUESTED', 'enrollment', req.user.id, req.ip, JSON.stringify({ courseId, academicSession, semester })]);
    res.status(201).json({ message: 'Enrollment request submitted successfully' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to submit enrollment request' }); }
});

module.exports = router;
