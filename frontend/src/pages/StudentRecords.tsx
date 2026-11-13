import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { adminService, recordService, staffService } from '../services/api';
import './StudentRecords.css';

const StaffWorkspace = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [registeredCourses, setRegisteredCourses] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [terms, setTerms] = useState<{ sessions: any[]; semesters: any[] }>({ sessions: [], semesters: [] });
  const [selected, setSelected] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ studentId: '', courseId: '', academicSession: '', semester: '', score: '', reason: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState({ studentId: '', courseId: '', sessionId: '', semesterId: '' });
  const refresh = async (q = query) => { const data = await staffService.getStudents(`?q=${encodeURIComponent(q)}`); setStudents(data.students || []); };
  useEffect(() => { Promise.all([staffService.getStudents(), staffService.getCourses(), staffService.getActivity(), staffService.getAcademicTerms()]).then(([list, courseList, logs, termData]) => { setStudents(list.students || []); setCourses(courseList); setActivity(logs); setTerms(termData); setRegistration((current) => ({ ...current, sessionId: termData.sessions[0] ? String(termData.sessions[0].id) : '', semesterId: termData.semesters[0] ? String(termData.semesters[0].id) : '' })); setForm((current) => ({ ...current, academicSession: termData.sessions[0]?.name || current.academicSession, semester: termData.semesters[0]?.name || current.semester })); }).catch((error) => setMessage(error.message)); }, []);
  const showStudent = async (id: number) => { try { const [studentData, enrollments] = await Promise.all([staffService.getStudent(id), staffService.getStudentEnrollments(id)]); setSelected(studentData); setRegisteredCourses(enrollments); setForm((current) => ({ ...current, studentId: String(id), courseId: '', academicSession: '', semester: '', score: '', reason: '' })); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load student registrations'); } };
  const save = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setMessage(''); try { await staffService.saveResult({ ...form, studentId: Number(form.studentId), courseId: Number(form.courseId), score: Number(form.score) }); setMessage('Result saved; GPA and CGPA recalculated.'); setActivity(await staffService.getActivity()); if (selected) await showStudent(Number(form.studentId)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save result'); } finally { setBusy(false); } };
  const register = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setMessage(''); try { await staffService.registerCourse({ ...registration, studentId: Number(registration.studentId), courseId: Number(registration.courseId), sessionId: Number(registration.sessionId), semesterId: Number(registration.semesterId) }); setMessage('Course registered successfully.'); setActivity(await staffService.getActivity()); if (selected && String(selected.student.id) === registration.studentId) await showStudent(Number(registration.studentId)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to register course'); } finally { setBusy(false); } };
  return <div className="student-records"><div className="records-heading"><div><p className="eyebrow">ACADEMIC RECORDS OFFICE</p><h1>Student directory</h1><p className="muted">Search students, review academic history, and submit scored results.</p></div></div>
    {message && <p role="status" className="records-message">{message}</p>}
    <section className="records-card"><label>Search students <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void refresh(); } }} placeholder="Matric number, name or email" /></label> <button type="button" onClick={() => void refresh()}>Search</button><div className="table-wrap"><table><thead><tr><th>Matric number</th><th>Student</th><th>Programme</th><th>Level</th><th>Results</th><th /></tr></thead><tbody>{students.map((s) => <tr key={s.id}><td>{s.student_id}</td><td>{s.first_name} {s.last_name}</td><td>{s.program}</td><td>{s.year * 100}</td><td>{s.result_count}</td><td><button type="button" onClick={() => void showStudent(s.id)}>View profile</button></td></tr>)}</tbody></table>{!students.length && <p className="empty-state">No students match this search.</p>}</div></section>
    {selected && <section className="records-card"><h2>{selected.student.first_name} {selected.student.last_name}</h2><p>{selected.student.student_id} · {selected.student.program} · Level {selected.student.year * 100}</p><p className="muted">Read-only academic profile</p>{selected.records.map((record: any) => <div key={`${record.academic_session}-${record.semester}`} className="record-summary"><div><strong>{record.semester} · {record.academic_session}</strong><p>{record.courses?.map((c: any) => `${c.code}: ${c.grade}`).join(' · ')}</p></div><span>GPA {record.gpa} / CGPA {record.cumulative_gpa}</span></div>)}</section>}
    <section className="records-card result-entry"><h2>Register course for a student</h2><p className="muted">Select from the active catalogue. The system checks the student’s department, programme, level and semester.</p><form onSubmit={register} className="result-form"><label>Student<select required value={registration.studentId} onChange={(e) => setRegistration({ ...registration, studentId: e.target.value })}><option value="">Choose student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.student_id} — {s.first_name} {s.last_name}</option>)}</select></label><label>Course<select required value={registration.courseId} onChange={(e) => { const course = courses.find((item) => String(item.id) === e.target.value); setRegistration({ ...registration, courseId: e.target.value, semesterId: course?.semester_id ? String(course.semester_id) : registration.semesterId }); }}><option value="">Choose course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.course_code} — {c.course_name} · {c.level || 'Any level'} ({c.credits} units)</option>)}</select></label><label>Academic session<select required value={registration.sessionId} onChange={(e) => setRegistration({ ...registration, sessionId: e.target.value })}><option value="">Choose session</option>{terms.sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Semester<select required value={registration.semesterId} onChange={(e) => setRegistration({ ...registration, semesterId: e.target.value })}><option value="">Choose semester</option>{terms.semesters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button disabled={busy || !students.length || !courses.length}>{busy ? 'Saving…' : 'Register course'}</button></form></section>
    <section className="records-card result-entry"><h2>Enter or update a result</h2><p className="muted">Choose a student to see their registered courses. Grades can only be entered for a course registration.</p><form onSubmit={save} className="result-form"><label>Student<select required value={form.studentId} onChange={(e) => { const id = e.target.value; if (id) void showStudent(Number(id)); else { setRegisteredCourses([]); setForm({ ...form, studentId: '', courseId: '', academicSession: '', semester: '' }); } }}><option value="">Choose student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.student_id} — {s.first_name} {s.last_name}</option>)}</select></label><label>Registered course<select required value={form.courseId} disabled={!form.studentId || !registeredCourses.length} onChange={(e) => { const enrollment = registeredCourses.find((item) => String(item.course_id) === e.target.value); setForm({ ...form, courseId: e.target.value, academicSession: enrollment?.academic_session || '', semester: enrollment?.semester || '', score: enrollment?.score == null ? '' : String(enrollment.score), reason: '' }); }}><option value="">{!form.studentId ? 'Choose a student first' : registeredCourses.length ? 'Choose registered course' : 'No courses registered'}</option>{registeredCourses.map((item) => <option key={item.enrollment_id} value={item.course_id}>{item.course_code} — {item.course_name} · {item.credits} units · {item.semester}, {item.academic_session} · {item.status === 'completed' ? `Current grade: ${item.grade}` : 'Awaiting result'}</option>)}</select></label><label>Academic session<input readOnly required value={form.academicSession} placeholder="Set by course registration" /></label><label>Semester<input readOnly required value={form.semester} placeholder="Set by course registration" /></label><label>Score (0–100)<input required type="number" min="0" max="100" step="1" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></label><label>Reason for change (required for edits over 5 points)<input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label><button disabled={busy || !form.courseId}>{busy ? 'Saving…' : 'Save result'}</button></form></section>
    <section className="records-card"><h2>My recent activity</h2><div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody>{activity.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.action}</td><td>{item.details?.studentId ? `Student #${item.details.studentId} · ${item.details.after?.grade || ''}` : item.resource_type}</td></tr>)}</tbody></table>{!activity.length && <p className="empty-state">Your result activity will appear here.</p>}</div></section>
  </div>;
};

const RecordsView = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [adminTab, setAdminTab] = useState('audit');
  const [adminSearch, setAdminSearch] = useState('');
  const [form, setForm] = useState({
    studentId: '', courseId: '', academicSession: '2025/2026',
    semester: 'First Semester', grade: 'A', gradePoint: '5',
  });

  useEffect(() => {
    if (user?.role === 'admin') {
      adminService.getAuditLogs().then(setLogs).catch((error) => setMessage(error.message));
      return;
    }
    if (user?.role === 'staff') {
      Promise.all([staffService.getStudents(), staffService.getCourses(), recordService.getRecords()])
        .then(([studentList, courseList, academicRecords]) => {
          setStudents(studentList);
          setCourses(courseList);
          setRecords(academicRecords);
          if (studentList[0] && courseList[0]) {
            setForm((current) => ({
              ...current,
              studentId: String(studentList[0].id),
              courseId: String(courseList[0].id),
            }));
          }
        })
        .catch((error) => setMessage(error.message));
      return;
    }
    recordService.getRecords().then(setRecords).catch((error) => setMessage(error.message));
  }, [user?.role]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await staffService.saveResult({
        ...form,
        studentId: Number(form.studentId),
        courseId: Number(form.courseId),
        gradePoint: Number(form.gradePoint),
      });
      setMessage('Result saved and GPA recalculated.');
      setRecords(await recordService.getRecords());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save result');
    } finally {
      setBusy(false);
    }
  };

  const loadAdminTab = async (tab = adminTab, q = adminSearch) => {
    setAdminTab(tab); setMessage('');
    try {
      const query = `?q=${encodeURIComponent(q)}`;
      if (tab === 'audit') setLogs(await adminService.getAuditLogs(`${query}&limit=100`));
      else if (tab === 'students') setStudents(await adminService.getStudents(query));
      else if (tab === 'results') setRecords(await adminService.getResults(query));
      else setLogs(await adminService.getMyActivity());
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load administrator data'); }
  };

  if (user?.role === 'admin') {
    return (
      <div className="student-records">
        <div className="records-heading">
          <div>
            <p className="eyebrow">IMMUTABLE SYSTEM HISTORY</p>
            <h1>Audit logs</h1>
            <p className="muted">Read-only security events. Administrators cannot edit grades or audit history.</p>
          </div>
        </div>
        {message && <p role="alert" className="form-error">{message}</p>}
        <div className="records-card">
          <p className="permission-note">Read-only oversight. Administrator routes do not provide grade or audit mutation actions.</p>
          <div className="admin-tabs">{[['audit','Audit logs'],['students','Students'],['results','Results'],['activity','My activity']].map(([key,label]) => <button key={key} type="button" className={adminTab===key?'active':''} onClick={() => void loadAdminTab(key)}>{label}</button>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); void loadAdminTab(); }}><label>Search<input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Search visible records" /></label><button>Search</button>{adminTab==='audit' && <button type="button" onClick={() => adminService.exportAuditLogs(`?q=${encodeURIComponent(adminSearch)}`).catch((error) => setMessage(error.message))}>Export filtered audit CSV</button>}</form>
        </div>
        <section className="records-card">
          <div className="table-wrap">
            {adminTab === 'students' ? <table><thead><tr><th>MATRIC</th><th>NAME</th><th>PROGRAMME</th><th>DEPARTMENT</th><th>RESULTS</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.student_id}</td><td>{student.first_name} {student.last_name}</td><td>{student.program}</td><td>{student.department || '—'}</td><td>{student.results}</td></tr>)}</tbody></table> : adminTab === 'results' ? <table><thead><tr><th>STUDENT</th><th>COURSE</th><th>TERM</th><th>SCORE</th><th>GRADE</th><th>ENTERED BY</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id || index}><td>{record.student_id} · {record.first_name} {record.last_name}</td><td>{record.course_code} {record.course_name}</td><td>{record.semester} · {record.academic_session}</td><td>{record.score ?? '—'}</td><td>{record.grade}</td><td>{record.entered_by || '—'}</td></tr>)}</tbody></table> : <table>
              <thead>
                <tr><th>TIME</th><th>USER</th><th>ROLE</th><th>ACTION</th><th>RESOURCE</th><th>IP ADDRESS</th></tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.login_id || 'System'}</td>
                    <td>{log.role || '—'}</td>
                    <td>{log.action}</td>
                    <td>{log.resource_type || '—'} {log.resource_id || ''}</td>
                    <td>{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>}
            {!logs.length && <p className="empty-state">No audit events available.</p>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="student-records">
      <div className="records-heading">
        <div>
          <p className="eyebrow">{user?.role === 'staff' ? 'ACADEMIC RECORDS OFFICE' : 'ACADEMIC HISTORY'}</p>
          <h1>{user?.role === 'staff' ? 'Manage academic records' : 'Academic records'}</h1>
          <p className="muted">
            {user?.role === 'staff'
              ? 'Enter or update authorised results. GPA values are recalculated from credit units.'
              : 'Semester results, GPA and CGPA from your academic record.'}
          </p>
        </div>
      </div>
      {message && <p role="status" className="records-message">{message}</p>}
      {user?.role === 'staff' && (
        <section className="records-card result-entry">
          <h2>Enter semester result</h2>
          <form onSubmit={save} className="result-form">
            <label>Student
              <select required value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
                <option value="">Select student</option>
                {students.map((student) => (
                  <option value={student.id} key={student.id}>
                    {student.student_id} — {student.first_name} {student.last_name}
                  </option>
                ))}
              </select>
            </label>
            <label>Course
              <select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option value={course.id} key={course.id}>
                    {course.course_code} — {course.course_name} ({course.credits} units)
                  </option>
                ))}
              </select>
            </label>
            <label>Academic session
              <input required value={form.academicSession} onChange={(event) => setForm({ ...form, academicSession: event.target.value })} />
            </label>
            <label>Semester
              <select value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })}>
                <option>First Semester</option><option>Second Semester</option><option>Summer</option>
              </select>
            </label>
            <label>Grade
              <select
                value={form.grade}
                onChange={(event) => setForm({
                  ...form,
                  grade: event.target.value,
                  gradePoint: ({ A: '5', B: '4', C: '3', D: '2', E: '1', F: '0' } as Record<string, string>)[event.target.value],
                })}
              >
                <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                <option value="D">D</option><option value="E">E</option><option value="F">F</option>
              </select>
            </label>
            <label>Grade point
              <input
                type="number" min="0" max="5" step="0.5" required value={form.gradePoint}
                onChange={(event) => setForm({ ...form, gradePoint: event.target.value })}
              />
            </label>
            <button disabled={busy || !students.length || !courses.length}>
              {busy ? 'Saving…' : 'Save result'}
            </button>
          </form>
        </section>
      )}
      {records.map((record, index) => (
        <section className="records-card" key={record.id || index}>
          <div className="record-summary">
            <div>
              <h2>{record.semester} · {record.academic_session}</h2>
              <span>
                {record.courses?.length || 0} courses · {record.credits_earned || 0} credits earned
                {record.matriculation_number
                  ? ` · ${record.matriculation_number} ${record.first_name} ${record.last_name}`
                  : ''}
              </span>
            </div>
            <div className="gpa-block"><small>SEMESTER GPA</small><strong>{Number(record.gpa || 0).toFixed(2)}</strong></div>
            <div className="gpa-block"><small>CGPA</small><strong>{Number(record.cumulative_gpa || 0).toFixed(2)}</strong></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>COURSE</th><th>COURSE TITLE</th><th>UNITS</th><th>GRADE</th><th>POINT</th></tr></thead>
              <tbody>
                {(record.courses || []).map((course: any) => (
                  <tr key={course.code}>
                    <td><strong>{course.code}</strong></td><td>{course.name}</td><td>{course.credits}</td>
                    <td><span className="grade-badge">{course.grade}</span></td><td>{course.point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!records.length && <p className="empty-state">No academic records are available for this account.</p>}
    </div>
  );
};

const StudentRecords = () => {
  const { user } = useAuth();
  return user?.role === 'staff' ? <StaffWorkspace /> : <RecordsView />;
};

export default StudentRecords;
