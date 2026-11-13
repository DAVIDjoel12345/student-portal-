import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminService, profileService, recordService, staffService } from '../services/api';
import './Dashboard.css';

type RoleDashboardProps = { role: 'staff' | 'admin' };

const RoleDashboard = ({ role }: RoleDashboardProps) => {
  const staff = role === 'staff';
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (staff) staffService.getStats().then(setData).catch((requestError) => setError(requestError.message));
    else Promise.all([adminService.getStats(), adminService.getAuditLogs('?limit=8')])
      .then(([stats, events]) => { setData(stats); setRecentEvents(events); })
      .catch((requestError) => setError(requestError.message));
  }, [staff]);

  const stats = staff
    ? [
        ['Active students', data?.active_students],
        ['Pending results', data?.pending_results],
        ['Published this session', data?.published_this_session],
      ]
    : [
        ['Total students', data?.students],
        ['Total staff', data?.staff],
        ['Active accounts', data?.active_users],
        ['Inactive accounts', data?.inactive_users],
        ['Total courses', data?.total_courses],
        ['Departments / programmes', `${data?.total_departments ?? '—'} / ${data?.total_programmes ?? '—'}`],
        ['Current academic session', data?.current_academic_session || 'Not set'],
      ];
  const actions = staff
      ? [
        ['Enter semester results', '/records'],
        ['Search student directory', '/records'],
        ['Review my activity', '/records'],
      ]
    : [
        ['Manage user accounts', '/profile'],
        ['Academic catalogue', '/profile?view=catalog'],
        ['View audit logs', '/records'],
        ['Read-only results review', '/records'],
      ];

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SECURE WORKSPACE</p>
          <h1>{staff ? 'Staff dashboard' : 'Administration dashboard'}</h1>
          <p className="muted">
            {staff
              ? 'Manage authorised student records and semester results.'
              : 'Manage accounts and monitor system activity.'}
          </p>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!staff && <section className="admin-welcome">
        <div><span className="admin-welcome-kicker">PORTAL CONTROL CENTRE</span><h2>Good to see you, {user?.name?.split(' ')[0] || 'Administrator'}</h2><p>Account access and academic structure, in one secure workspace.</p></div>
        <div className="admin-welcome-session"><span>Current academic session</span><strong>{data?.current_academic_session || 'Not configured'}</strong><Link to="/profile?view=catalog">Manage academic catalogue <span aria-hidden="true">→</span></Link></div>
      </section>}
      <div className={`stats-grid${staff ? '' : ' admin-stats-grid'}`}>
        {stats.map(([label, value]) => (
          <div className="metric-card" key={label}>
            <div className="metric-top"><span>{label}</span></div>
            <strong>{value ?? '—'}</strong>
            <small>{data ? 'Live system data' : 'Loading system data'}</small>
          </div>
        ))}
      </div>
      <section className="panel role-actions">
        <div className="panel-heading">
          <div>
            <h3>Quick actions</h3>
            <p className="muted">Available actions for your role</p>
          </div>
        </div>
        <div className="role-action-grid">{actions.map(([label, path]) => (
          <Link className="outline-button role-action" to={path} key={label}>
            <span>{label}</span><b aria-hidden="true">→</b>
          </Link>
        ))}</div>
      </section>
      {!staff && (
        <>
        <section className="panel admin-activity-panel">
          <div className="panel-heading"><div><h3>Recent system activity</h3><p className="muted">Latest authentication and administrative events</p></div><Link to="/records">Open audit logs →</Link></div>
          {recentEvents.length ? <div className="table-wrap"><table className="results-table"><thead><tr><th>TIME</th><th>USER</th><th>ROLE</th><th>ACTION</th><th>RESOURCE</th></tr></thead><tbody>{recentEvents.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString()}</td><td>{event.login_id || 'System'}</td><td>{event.role || '—'}</td><td>{event.action}</td><td>{event.resource_type || '—'} {event.resource_id || ''}</td></tr>)}</tbody></table></div> : <p className="empty-state">No recent system activity.</p>}
        </section>
        <p className="permission-note">
          Grade records and audit logs are protected. Administrators cannot alter grades or modify audit history.
        </p>
        </>
      )}
    </div>
  );
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [summary, setSummary] = useState<any>({ courses_in_progress: 0 });
  const [registeredCourses, setRegisteredCourses] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([recordService.getRecords(), profileService.getStudentProfile(), profileService.getStudentSummary(), profileService.getStudentCourses()])
      .then(([academicRecords, studentProfile, studentSummary, courses]) => { setRecords(academicRecords); setProfile(studentProfile); setSummary(studentSummary); setRegisteredCourses(courses); })
      .catch((requestError) => setError(requestError.message));
  }, []);

  const latest = records[0];
  const cgpa = latest?.cumulative_gpa;
  const gpa = latest?.gpa;
  const credits = records.reduce((sum, record) => sum + Number(record.credits_earned || 0), 0);
  const completedCourses = records.reduce((sum, record) => sum + (record.courses || []).filter((course: any) => Number(course.point) > 0).length, 0);
  const trend = [...records].reverse();
  const points = trend.map((record, index) => `${trend.length < 2 ? 300 : 30 + (index * 540) / (trend.length - 1)},${155 - (Number(record.gpa || 0) / 5) * 125}`).join(' ');
  const date = new Intl.DateTimeFormat('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{date.toUpperCase()}</p>
          <h1>Welcome back, {profile?.first_name || user?.name.split(' ')[0]}</h1>
          <p className="muted">{profile ? `${profile.student_id} · Level ${profile.year * 100} · ${profile.department || profile.program}` : 'Your academic overview from the student records system.'}</p>
        </div>
        <Link className="outline-button" to="/records">View full transcript <span>↗</span></Link>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="hero-card">
        <div>
          <span className="status-pill">ACADEMIC SUMMARY</span>
          <h2>{latest?.academic_session || 'Academic record'}</h2>
          <p>
            {latest
              ? `${latest.semester} results are available in your transcript.`
              : 'Your published results and GPA will appear here when available.'}
          </p>
          <Link to="/records" className="hero-link">View academic records <span>→</span></Link>
        </div>
        <div className="hero-graphic">
          <div className="ring ring-one" />
          <div className="ring ring-two" />
          <strong>{cgpa == null ? '—' : Number(cgpa).toFixed(2)}</strong>
          <small>CGPA</small>
        </div>
      </section>
      <div className="stats-grid">
        <div className="metric-card">
          <div className="metric-top"><span>Latest semester GPA</span></div>
          <strong>{gpa == null ? '—' : Number(gpa).toFixed(2)}</strong>
          <small>{latest?.semester || 'No published results yet'}</small>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span>Credits earned</span></div>
          <strong>{records.length ? credits : '—'}</strong>
          <small>{records.length ? `${completedCourses} courses passed across ${records.length} semesters` : 'No results available yet'}</small>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span>Academic standing</span></div>
          <strong className="standing">{records.length ? `${summary.courses_in_progress || 0}` : '—'}</strong>
          <small>{records.length ? 'Courses currently in progress' : 'No active registration data'}</small>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading"><div><h3>Registered courses</h3><p className="muted">Your active and completed course registrations</p></div><Link to="/records">Academic history →</Link></div>
        {registeredCourses.length ? <div className="table-wrap"><table className="results-table"><thead><tr><th>COURSE</th><th>PROGRAMME / LEVEL</th><th>UNITS</th><th>TERM</th><th>STATUS</th><th>GRADE</th></tr></thead><tbody>{registeredCourses.map((course) => <tr key={course.enrollment_id}><td><strong>{course.course_code}</strong><small>{course.course_name}</small></td><td>{course.programme || course.department || '—'}<small>Level {course.level || '—'}</small></td><td>{course.credits}</td><td>{course.semester}<small>{course.academic_session}</small></td><td>{course.status === 'completed' ? 'Completed' : course.status[0].toUpperCase()+course.status.slice(1)}</td><td>{course.grade || 'Pending'}</td></tr>)}</tbody></table></div> : <p className="empty-state">No courses have been registered to your account yet.</p>}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Latest results</h3>
            <p className="muted">Your most recent course grades</p>
          </div>
          <Link to="/records">See transcript →</Link>
        </div>
        <div className="table-wrap">
          <table className="results-table">
            <thead><tr><th>COURSE</th><th>UNITS</th><th>GRADE</th><th>POINT</th></tr></thead>
            <tbody>
              {(latest?.courses || []).map((course: any) => (
                <tr key={course.code}>
                  <td><strong>{course.code}</strong><small>{course.name}</small></td>
                  <td>{course.credits}</td><td>{course.grade}</td><td>{course.point}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {latest && !latest.courses?.length && (
            <p className="empty-state">No course details have been published for this semester.</p>
          )}
        </div>
      </section>
      {records.length ? <>
        <section className="panel">
          <div className="panel-heading"><div><h3>GPA trend</h3><p className="muted">Semester GPA across completed semesters</p></div><Link to="/records">Full academic history →</Link></div>
          <div className="student-chart"><svg viewBox="0 0 600 190" role="img" aria-label="Semester GPA trend from zero to five"><line x1="30" y1="155" x2="570" y2="155" /><line x1="30" y1="30" x2="30" y2="155" /><text x="4" y="35">5.0</text><text x="8" y="160">0</text>{trend.length > 1 && <polyline points={points} />}{trend.map((record,index) => <circle key={`${record.academic_session}-${record.semester}`} cx={trend.length < 2 ? 300 : 30+(index*540)/(trend.length-1)} cy={155-(Number(record.gpa||0)/5)*125} r="4"><title>{record.academic_session} {record.semester}: GPA {Number(record.gpa).toFixed(2)}</title></circle>)}</svg><div className="student-chart-labels">{trend.map((record) => <span key={`${record.academic_session}-${record.semester}`}>{record.semester}<small>{record.academic_session}</small></span>)}</div></div>
        </section>
        <section className="panel"><div className="panel-heading"><div><h3>Semester summary</h3><p className="muted">Live values from your academic record</p></div></div><div className="table-wrap"><table><thead><tr><th>SESSION</th><th>SEMESTER</th><th>COURSES</th><th>CREDITS EARNED</th><th>GPA</th><th>CGPA</th></tr></thead><tbody>{records.map((record,index)=><tr key={`${record.academic_session}-${record.semester}-${index}`}><td>{record.academic_session}</td><td>{record.semester}</td><td>{record.courses?.length||0}</td><td>{record.credits_earned}</td><td>{Number(record.gpa).toFixed(2)}</td><td>{Number(record.cumulative_gpa).toFixed(2)}</td></tr>)}</tbody></table></div></section>
      </> : <section className="panel student-empty"><h3>Your academic results will appear here</h3><p className="muted">Your results will appear after they are entered by your department. Contact your academic officer if you believe this is an error.</p><Link className="outline-button" to="/profile">Review account settings</Link></section>}
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  return user?.role === 'student' || !user
    ? <StudentDashboard />
    : <RoleDashboard role={user.role} />;
};

export default Dashboard;
