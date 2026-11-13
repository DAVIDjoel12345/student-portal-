const express = require('express');
const { body, validationResult } = require('express-validator');
const { get, run, all } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const staffDepartment = async (userId) => {
  const row = await get('SELECT department FROM users WHERE id=? AND role=\'staff\'', [userId]);
  return row?.department || '__UNASSIGNED__';
};

const scopedStudent = async (userId, studentId) => {
  const department = await staffDepartment(userId);
  const params = [studentId];
  let sql = 'SELECT * FROM students WHERE id=?';
  if (department) { params.push(department); sql += ' AND department=?'; }
  return await get(sql, params);
};

const gradeForScore = (score) => {
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('Score must be a whole number from 0 to 100');
  if (score >= 70) return { grade: 'A', point: 5 };
  if (score >= 60) return { grade: 'B', point: 4 };
  if (score >= 50) return { grade: 'C', point: 3 };
  if (score >= 45) return { grade: 'D', point: 2 };
  if (score >= 40) return { grade: 'E', point: 1 };
  return { grade: 'F', point: 0 };
};

const recordsQuery = `WITH semester_totals AS (
  SELECT e.student_id,e.academic_session,e.semester,ROUND(SUM(e.final_grade*c.credits)/NULLIF(SUM(c.credits),0),2) AS gpa,SUM(e.final_grade*c.credits) AS weighted_points,
  SUM(c.credits) FILTER (WHERE e.final_grade >= 1) AS credits_earned,SUM(c.credits) AS total_credits,
  json_group_array(json_object('id',e.id,'code',c.course_code,'name',c.course_name,'credits',c.credits,'grade',e.grade,'point',e.final_grade,'score',e.score)) AS courses
  FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.status='completed' AND e.final_grade IS NOT NULL
  GROUP BY e.student_id,e.academic_session,e.semester
), calculated AS (
  SELECT st.*,ROUND(SUM(weighted_points) OVER (PARTITION BY student_id ORDER BY substring(academic_session from '^[0-9]{4}')::int,CASE WHEN lower(semester) IN ('first semester','fall','fall semester') THEN 1 WHEN lower(semester) IN ('second semester','spring','spring semester') THEN 2 WHEN lower(semester) IN ('summer','summer semester') THEN 3 ELSE 4 END,semester ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)/NULLIF(SUM(total_credits) OVER (PARTITION BY student_id ORDER BY substring(academic_session from '^[0-9]{4}')::int,CASE WHEN lower(semester) IN ('first semester','fall','fall semester') THEN 1 WHEN lower(semester) IN ('second semester','spring','spring semester') THEN 2 WHEN lower(semester) IN ('summer','summer semester') THEN 3 ELSE 4 END,semester ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),0),2) AS cumulative_gpa
  FROM semester_totals st
)
SELECT c.*,s.student_id AS matriculation_number,s.first_name,s.last_name,s.program,s.year FROM calculated c JOIN students s ON s.id=c.student_id`;

router.get('/stats', authenticateToken, requireRole('staff'), async (req, res) => {
  try {
    const department = await staffDepartment(req.user.id);
    const params = department ? [department] : [];
    const filter = department ? ' AND s.department=?' : '';
    const resultFilter = department ? ' AND st.department=?' : '';
    const result = await get(`SELECT
      (SELECT COUNT(*) FROM students s WHERE s.status='active'${filter}) AS active_students,
      (SELECT COUNT(*) FROM enrollments e JOIN students st ON st.id=e.student_id WHERE e.status='enrolled'${resultFilter}) AS pending_results,
      (SELECT COUNT(*) FROM enrollments e JOIN students st ON st.id=e.student_id WHERE e.status='completed' AND e.academic_session=(SELECT MAX(academic_session) FROM enrollments)${resultFilter}) AS published_this_session`, params);
    res.json(result);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load staff statistics' }); }
});

router.get('/student/:studentId', authenticateToken, requireRole('staff'), async (req, res) => {
  try {
    const student = await scopedStudent(req.user.id, req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found or not in your department' });
    const records = await all(recordsQuery + ' WHERE c.student_id=?', [req.params.studentId]);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, 'STUDENT_RECORDS_VIEWED', 'student', req.params.studentId, req.ip]);
    res.json({ student, records });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load student records' }); }
});

router.get('/student/:studentId/transcript', authenticateToken, requireRole('staff'), async (req, res) => {
  try {
    const student = await scopedStudent(req.user.id, req.params.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found or not in your department' });
    const records = await all(recordsQuery + ' WHERE c.student_id=?', [req.params.studentId]);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address) VALUES(?,?,?,?,?)', [req.user.id, 'TRANSCRIPT_GENERATED', 'student', req.params.studentId, req.ip]);
    res.json({ student, records, generatedAt: new Date().toISOString() });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to generate transcript' }); }
});

router.post('/enrollment', authenticateToken, requireRole('staff'), [body('studentId').isInt({ min: 1 }), body('courseId').isInt({ min: 1 }), body('academicSession').trim().notEmpty(), body('semester').trim().notEmpty()], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid enrollment data' });
  const { studentId, courseId, academicSession, semester } = req.body;
  try {
    const student = await scopedStudent(req.user.id, studentId);
    if (!student) return res.status(404).json({ error: 'Student not found or not in your department' });
    const course = await get('SELECT * FROM courses WHERE id=?', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const existing = await get('SELECT * FROM enrollments WHERE student_id=? AND course_id=? AND academic_session=? AND semester=?', [studentId, courseId, academicSession, semester]);
    if (existing) return res.status(409).json({ error: 'Student already enrolled in this course for this session' });
    await run('INSERT INTO enrollments (student_id,course_id,academic_session,semester,status) VALUES(?,?,?,?,\'enrolled\')', [studentId, courseId, academicSession, semester]);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address,details) VALUES(?,?,?,?,?,?)', [req.user.id, 'ENROLLMENT_CREATED', 'enrollment', studentId, req.ip, JSON.stringify({ courseId, academicSession, semester })]);
    res.status(201).json({ message: 'Enrollment created successfully' });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to create enrollment' }); }
});

router.patch('/enrollment/:enrollmentId/grade', authenticateToken, requireRole('staff'), [body('score').isInt({ min: 0, max: 100 })], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Score must be an integer from 0 to 100' });
  const { enrollmentId } = req.params;
  const { score } = req.body;
  try {
    const enrollment = await get('SELECT e.*,s.department FROM enrollments e JOIN students s ON s.id=e.student_id WHERE e.id=?', [enrollmentId]);
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    const department = await staffDepartment(req.user.id);
    if (department && enrollment.department !== department) return res.status(403).json({ error: 'Not authorized to grade this enrollment' });
    const { grade, point } = gradeForScore(score);
    await run('UPDATE enrollments SET score=?,grade=?,final_grade=?,status=\'completed\',updated_at=datetime(\'now\') WHERE id=?', [score, grade, point, enrollmentId]);
    await run('INSERT INTO audit_logs(user_id,action,resource_type,resource_id,ip_address,details) VALUES(?,?,?,?,?,?)', [req.user.id, 'GRADE_SUBMITTED', 'enrollment', enrollmentId, req.ip, JSON.stringify({ score, grade, point })]);
    res.json({ message: 'Grade submitted successfully', score, grade, point });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to submit grade' }); }
});

router.get('/enrollments', authenticateToken, requireRole('staff'), async (req, res) => {
  try {
    const department = await staffDepartment(req.user.id);
    const params = department ? [department] : [];
    const filter = department ? ' AND s.department=?' : '';
    const enrollments = await all(`SELECT e.*,s.student_id,s.first_name,s.last_name,s.program,s.year,c.course_code,c.course_name,c.credits FROM enrollments e JOIN students s ON s.id=e.student_id JOIN courses c ON c.id=e.course_id WHERE 1=1${filter} ORDER BY e.academic_session DESC,e.semester DESC,c.course_code`, params);
    res.json(enrollments);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load enrollments' }); }
});

router.get('/', authenticateToken, requireRole('staff'), async (req, res) => {
  try {
    const department = await staffDepartment(req.user.id);
    const params = department ? [department] : [];
    const filter = department ? ' AND s.department=?' : '';
    const records = await all(recordsQuery + ' WHERE 1=1' + filter + ' ORDER BY c.student_id,c.academic_session,c.semester', params);
    res.json(records);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Unable to load records' }); }
});

module.exports = router;
