import React, { useEffect, useState } from 'react';
import { adminService } from '../services/api';

type CatalogData = { departments: any[]; programmes: any[]; sessions: any[]; semesters: any[]; courses: any[] };
type Props = { verifyAdmin: () => Promise<string> };
const emptyCatalog: CatalogData = { departments: [], programmes: [], sessions: [], semesters: [], courses: [] };

const AcademicCatalog = ({ verifyAdmin }: Props) => {
  const [catalog, setCatalog] = useState<CatalogData>(emptyCatalog);
  const [kind, setKind] = useState('courses');
  const [courseId, setCourseId] = useState('');
  const [form, setForm] = useState<any>({ name: '', departmentId: '', termOrder: '1', courseCode: '', courseName: '', credits: '3', programmeId: '', level: '100', semesterId: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try { setCatalog(await adminService.getCatalog()); }
    finally { setLoading(false); }
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const changeKind = (next: string) => { setKind(next); setCourseId(''); setSearch(''); setMessage(''); setError(''); setForm({ name: '', departmentId: '', termOrder: '1', courseCode: '', courseName: '', credits: '3', programmeId: '', level: '100', semesterId: '' }); };
  const startEdit = (course: any) => {
    setKind('courses'); setCourseId(String(course.id));
    setForm({ courseCode: course.course_code, courseName: course.course_name, credits: String(course.credits), programmeId: String(course.programme_id || ''), level: String(course.level || '100'), semesterId: String(course.semester_id || '') });
    setError(''); setMessage('Editing course details');
    document.getElementById('catalog-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const token = await verifyAdmin();
      if (kind === 'courses') {
        const payload = { courseCode: form.courseCode, courseName: form.courseName, credits: Number(form.credits), programmeId: Number(form.programmeId), level: Number(form.level), semesterId: Number(form.semesterId), isActive: courseId ? catalog.courses.find((c) => String(c.id) === courseId)?.is_active ?? true : true };
        if (courseId) await adminService.updateCourse(courseId, payload, token);
        else await adminService.createCatalogItem(kind, payload, token);
      } else {
        const payload = kind === 'departments' || kind === 'sessions' ? { name: form.name } : kind === 'programmes' ? { name: form.name, departmentId: Number(form.departmentId) } : { name: form.name, termOrder: Number(form.termOrder) };
        await adminService.createCatalogItem(kind, payload, token);
      }
      setMessage(courseId ? 'Course updated.' : `${kind.slice(0, -1)} saved.`);
      setCourseId(''); setForm({ name: '', departmentId: '', termOrder: '1', courseCode: '', courseName: '', credits: '3', programmeId: '', level: '100', semesterId: '' });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save catalogue item'); }
    finally { setBusy(false); }
  };

  const toggleCourse = async (course: any) => {
    setBusy(true); setError('');
    try { const token = await verifyAdmin(); await adminService.updateCourse(course.id, { courseCode: course.course_code, courseName: course.course_name, credits: course.credits, programmeId: course.programme_id, level: course.level, semesterId: course.semester_id, isActive: !course.is_active }, token); setMessage(`Course ${course.is_active ? 'deactivated' : 'activated'}.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to change course status'); }
    finally { setBusy(false); }
  };

  const toggleReference = async (type: string, item: any) => {
    setBusy(true); setError('');
    try { const token = await verifyAdmin(); await adminService.setCatalogStatus(type, item.id, !item.is_active, token); setMessage(`${item.name} ${item.is_active ? 'deactivated' : 'activated'}.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to change status'); }
    finally { setBusy(false); }
  };

  const setCurrentSession = async (session: any) => {
    setBusy(true); setError('');
    try { const token = await verifyAdmin(); await adminService.setCurrentSession(session.id, token); setMessage(`${session.name} is now the current academic session.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to set current session'); }
    finally { setBusy(false); }
  };

  const sections = [['courses','Courses'],['departments','Departments'],['programmes','Programmes'],['sessions','Academic sessions'],['semesters','Semesters']];
  const references = kind === 'departments' ? catalog.departments : kind === 'programmes' ? catalog.programmes : kind === 'sessions' ? catalog.sessions : catalog.semesters;
  const filteredCourses = catalog.courses.filter((course) => `${course.course_code} ${course.course_name} ${course.programme || ''} ${course.department || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredReferences = references.filter((item) => `${item.name} ${item.department || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  return <div className="academic-catalog">
    <section className="profile-card">
      <div className="catalog-title"><div><p className="eyebrow">ACADEMIC STRUCTURE</p><h2>Catalogue management</h2><p className="muted">Maintain the official courses and academic reference data. Changes are recorded in the audit log.</p></div></div>
      <div className="catalog-tabs" role="group" aria-label="Catalogue categories">{sections.map(([key,label]) => <button key={key} type="button" aria-pressed={kind===key} className={kind===key?'active':''} onClick={() => changeKind(key)}>{label}<span>{key==='courses'?catalog.courses.length:key==='departments'?catalog.departments.length:key==='programmes'?catalog.programmes.length:key==='sessions'?catalog.sessions.length:catalog.semesters.length}</span></button>)}</div>
      {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="catalog-message">{message}</p>}
      <form id="catalog-form" className="account-form catalog-form" onSubmit={submit}>
        {kind === 'courses' ? <>
          <label>Course code<input required maxLength={20} value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value.toUpperCase() })} placeholder="CSC 209" /></label>
          <label>Course title<input required maxLength={200} value={form.courseName} onChange={(e) => setForm({ ...form, courseName: e.target.value })} placeholder="System Modeling and Simulation" /></label>
          <label>Credit units<input type="number" min="1" max="6" required value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} /></label>
          <label>Programme<select required value={form.programmeId} onChange={(e) => setForm({ ...form, programmeId: e.target.value })}><option value="">Select programme</option>{catalog.programmes.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.department}</option>)}</select></label>
          <label>Level<select required value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{[100,200,300,400,500,600,700,800].map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
          <label>Semester<select required value={form.semesterId} onChange={(e) => setForm({ ...form, semesterId: e.target.value })}><option value="">Select semester</option>{catalog.semesters.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </> : <>
          <label>{kind === 'departments' ? 'Department name' : kind === 'programmes' ? 'Programme name' : kind === 'sessions' ? 'Academic session' : 'Semester name'}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={kind === 'sessions' ? '2026/2027' : undefined} pattern={kind === 'sessions' ? '\\d{4}/\\d{4}' : undefined} /></label>
          {kind === 'programmes' && <label>Department<select required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}><option value="">Select department</option>{catalog.departments.filter((d) => d.is_active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
          {kind === 'semesters' && <label>Order within academic year<input type="number" min="1" max="10" required value={form.termOrder} onChange={(e) => setForm({ ...form, termOrder: e.target.value })} /></label>}
        </>}
        <button disabled={busy}>{busy ? 'Saving…' : courseId ? 'Save course changes' : `Add ${kind.slice(0,-1)}`}</button>
        {courseId && <button type="button" className="secondary-button" onClick={() => { setCourseId(''); setForm({ name:'',departmentId:'',termOrder:'1',courseCode:'',courseName:'',credits:'3',programmeId:'',level:'100',semesterId:'' }); }}>Cancel edit</button>}
      </form>
    </section>
    {kind === 'courses' ? <section className="profile-card catalog-list-card"><div className="catalog-list-heading"><div><h2>Course catalogue</h2><p className="muted">{filteredCourses.length} of {catalog.courses.length} courses</p></div><label className="catalog-search">Search courses<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Code, title, programme…" /></label></div><div className="table-wrap"><table><thead><tr><th>CODE</th><th>COURSE</th><th>PROGRAMME / DEPARTMENT</th><th>LEVEL</th><th>UNITS</th><th>SEMESTER</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{filteredCourses.map((course) => <tr key={course.id}><td><span className="course-code">{course.course_code}</span></td><td>{course.course_name}</td><td>{course.programme || '—'}<small className="catalog-subtext">{course.department || '—'}</small></td><td>{course.level || '—'}</td><td>{course.credits}</td><td>{course.semester || '—'}</td><td><span className={`catalog-status ${course.is_active?'is-active':'is-inactive'}`}>{course.is_active ? 'Active' : 'Inactive'}</span></td><td><button className="small-action" disabled={busy} onClick={() => startEdit(course)}>Edit</button> <button className="small-action" disabled={busy} onClick={() => void toggleCourse(course)}>{course.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table>{loading ? <p className="empty-state" role="status">Loading catalogue…</p> : !filteredCourses.length && <p className="empty-state">{search ? 'No courses match this search.' : 'No courses configured yet.'}</p>}</div></section> : <section className="profile-card catalog-list-card"><div className="catalog-list-heading"><div><h2>{sections.find(([key]) => key===kind)?.[1]}</h2><p className="muted">{filteredReferences.length} of {references.length} entries</p></div><label className="catalog-search">Search {kind}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name…" /></label></div><div className="table-wrap"><table><thead><tr><th>NAME</th>{kind==='programmes'&&<th>DEPARTMENT</th>}{kind==='semesters'&&<th>ORDER</th>}{kind==='sessions'&&<th>CURRENT</th>}<th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{filteredReferences.map((item) => <tr key={item.id}><td>{item.name}</td>{kind==='programmes'&&<td>{item.department}</td>}{kind==='semesters'&&<td>{item.term_order}</td>}{kind==='sessions'&&<td>{item.is_current?'Current':'—'}</td>}<td><span className={`catalog-status ${item.is_active?'is-active':'is-inactive'}`}>{item.is_active?'Active':'Inactive'}</span></td><td>{kind==='sessions'&&item.is_active&&!item.is_current&&<button className="small-action" disabled={busy} onClick={() => void setCurrentSession(item)}>Set current</button>}<button className="small-action" disabled={busy||(kind==='sessions'&&item.is_current)} onClick={() => void toggleReference(kind,item)}>{item.is_active?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table>{loading ? <p className="empty-state" role="status">Loading catalogue…</p> : !filteredReferences.length&&<p className="empty-state">{search ? 'No entries match this search.' : 'No entries yet.'}</p>}</div></section>}
  </div>;
};

export default AcademicCatalog;
