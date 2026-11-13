import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminService, authService, profileService, studentService } from '../services/api';
import AcademicCatalog from './AcademicCatalog';
import './Profile.css';

const Profile = () => {
  const { user } = useAuth();
  const history = useHistory();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [catalogRefs, setCatalogRefs] = useState<{ departments: any[]; programmes: any[] }>({ departments: [], programmes: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [adminView, setAdminView] = useState<'accounts' | 'catalog'>('accounts');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ loginId: '', email: '', role: 'staff', displayName: '', password: '', studentId: '', programmeId: '', year: '1', department: '' });
  useEffect(() => {
    if (user?.role === 'admin') Promise.all([adminService.getUsers(), adminService.getCatalog()]).then(([data, catalog]) => { setUsers(data.users || []); setCatalogRefs(catalog); }).catch((e) => setError(e.message));
    else if (user?.role === 'student') Promise.all([profileService.getStudentProfile(), profileService.getActivity()]).then(([data, logs]) => { setProfile(data); setPhone(data.phone || ''); setActivity(logs); }).catch((e) => setError(e.message));
  }, [user?.role]);
  useEffect(() => { if (user?.role === 'admin' && location.search.includes('view=catalog')) setAdminView('catalog'); }, [location.search, user?.role]);
  const reloadUsers = async (query = userSearch) => { const data = await adminService.getUsers(`?q=${encodeURIComponent(query)}`); setUsers(data.users || []); };
  const verifyAdmin = async () => {
    const password = window.prompt('Re-enter your administrator password');
    if (!password) throw new Error('Verification cancelled');
    await adminService.startStepUp(password);
    const otp = window.prompt('Enter the six-digit code sent to your registered email');
    if (!otp) throw new Error('Verification cancelled');
    const result = await adminService.verifyStepUp(otp);
    return result.stepUpToken as string;
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const stepUpToken = await verifyAdmin();
      if (form.role === 'student') {
        const [firstName, ...last] = form.displayName.trim().split(/\s+/);
        await studentService.createStudent({ firstName, lastName: last.join(' ') || firstName, email: form.email, studentId: form.studentId, programmeId: Number(form.programmeId), year: Number(form.year), loginId: form.loginId, password: form.password }, stepUpToken);
      } else await adminService.createUser(form, stepUpToken);
      setForm({ loginId: '', email: '', role: 'staff', displayName: '', password: '', studentId: '', programmeId: '', year: '1', department: '' });
      await reloadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create account'); }
    finally { setBusy(false); }
  };
  const changeStatus = async (account: any) => {
    const reason = window.prompt(`Reason for ${account.is_active ? 'deactivating' : 'activating'} ${account.login_id} (required)`);
    if (!reason) return;
    try { const token = await verifyAdmin(); await adminService.setUserActive(account.id, !account.is_active, reason, token); await reloadUsers(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update account'); }
  };
  const changeRole = async (account: any, role: string) => {
    if (role === account.role) return;
    const reason = window.prompt(`Reason for changing ${account.login_id} to ${role} (at least 10 characters)`);
    if (!reason) { await reloadUsers(); return; }
    try { const token = await verifyAdmin(); await adminService.setUserRole(account.id, role, reason, token); await reloadUsers(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not change role'); }
  };
  const savePhone = async (event: React.FormEvent) => { event.preventDefault(); setError(''); try { await profileService.updatePhone(phone); setProfile({ ...profile, phone }); setActivity(await profileService.getActivity()); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update phone'); } };
  const savePassword = async (event: React.FormEvent) => { event.preventDefault(); setError(''); try { await profileService.changePassword(currentPassword, newPassword); await authService.logout(); history.replace('/login'); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to change password'); } };

  if (user?.role === 'admin') return <div className="profile admin-users">
    <div className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>{adminView === 'accounts' ? 'User accounts' : 'Academic catalogue'}</h1><p className="muted">Manage account access and the academic structure in dedicated workspaces.</p></div></div>
    <div className="catalog-tabs admin-view-tabs" role="tablist" aria-label="Administration sections"><button type="button" role="tab" aria-selected={adminView==='accounts'} className={adminView==='accounts'?'active':''} onClick={() => setAdminView('accounts')}>User accounts</button><button type="button" role="tab" aria-selected={adminView==='catalog'} className={adminView==='catalog'?'active':''} onClick={() => setAdminView('catalog')}>Academic catalogue</button></div>
    {adminView === 'catalog' ? <AcademicCatalog verifyAdmin={verifyAdmin} /> : <>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="profile-card"><h2>Create account</h2><form className="account-form" onSubmit={create}>
      <label>Full name<input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
      {form.role !== 'student' && <label>Staff/admin login ID<input required value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} /></label>}
      <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="student">Student</option><option value="staff">Staff</option><option value="admin">Administrator</option></select></label>
      {form.role === 'student' && <><label>Matriculation number<input required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value, loginId: e.target.value })} /></label><label>Programme<select required value={form.programmeId} onChange={(e) => setForm({ ...form, programmeId: e.target.value })}><option value="">Select programme</option>{catalogRefs.programmes.filter((p) => p.is_active).map((p) => <option value={p.id} key={p.id}>{p.name} — {p.department}</option>)}</select></label><label>Year of study<input type="number" min="1" max="8" required value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label></>}
      {form.role === 'staff' && <label>Department<select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}><option value="">Select department</option>{catalogRefs.departments.filter((d) => d.is_active).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}</select></label>}
      <label>Temporary password (12+ characters)<input type="password" minLength={12} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      <button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
    </form></section>
    <section className="profile-card"><h2>Accounts</h2><form onSubmit={(e) => { e.preventDefault(); void reloadUsers(); }}><label>Search accounts<input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Login, name or email" /></label><button>Search</button></form><div className="table-wrap"><table><thead><tr><th>LOGIN</th><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>DEPARTMENT</th><th>STATUS</th><th>ACCESS</th></tr></thead><tbody>{users.map((account) => <tr key={account.id}><td>{account.login_id}</td><td>{account.display_name}</td><td>{account.email}</td><td>{account.role === 'student' ? 'Student' : <select aria-label={`Role for ${account.login_id}`} value={account.role} onChange={(e) => changeRole(account, e.target.value)} disabled={account.id === user.id}><option value="staff">Staff</option><option value="admin">Administrator</option></select>}</td><td>{account.department || '—'}</td><td>{account.is_active ? 'Active' : 'Inactive'}</td><td><button className="small-action" onClick={() => changeStatus(account)} disabled={account.id === user.id}>{account.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table>{!users.length && <p className="empty-state">No accounts match this search.</p>}</div></section>
  </>}
  </div>;

  return <div className="profile"><div className="page-heading"><div><p className="eyebrow">ACCOUNT & SECURITY</p><h1>{user?.role === 'student' ? 'Student profile and settings' : 'Staff profile'}</h1><p className="muted">Academic identity is read-only. Manage your phone and password below.</p></div></div>{error && <p className="form-error" role="alert">{error}</p>}<section className="profile-card"><h2>{profile ? `${profile.first_name} ${profile.last_name}` : user?.name}</h2><div className="profile-details"><p><strong>Matriculation number:</strong> {profile?.student_id || user?.username}</p><p><strong>Email:</strong> {profile?.email || '—'}</p><p><strong>Phone:</strong> {profile?.phone || 'Not provided'}</p><p><strong>Department:</strong> {profile?.department || '—'}</p><p><strong>Programme:</strong> {profile?.program || '—'}</p><p><strong>Level:</strong> {profile?.year ? `${profile.year * 100}` : '—'}</p><p><strong>Status:</strong> {profile?.status || 'Active'}</p><p><strong>MFA:</strong> Required at sign-in</p></div><p className="muted">To correct your name, matriculation number, department, programme, or level, contact your academic office.</p></section>{user?.role === 'student' && <><section className="profile-card"><h2>Update phone number</h2><form className="account-form" onSubmit={savePhone}><label>Phone number<input required pattern="[+]?[0-9]{7,15}" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2348012345678" /></label><button>Save phone number</button></form></section><section className="profile-card"><h2>Change password</h2><form className="account-form" onSubmit={savePassword}><label>Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label><label>New password (12+ characters)<input type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label><button>Change password</button></form><p className="muted">Changing your password signs out all active devices; sign in again with email OTP.</p></section><section className="profile-card"><h2>My recent account activity</h2><div className="table-wrap"><table><thead><tr><th>TIME</th><th>ACTION</th><th>DETAIL</th></tr></thead><tbody>{activity.map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString()}</td><td>{entry.action}</td><td>{entry.resource_type || '—'}</td></tr>)}</tbody></table>{!activity.length && <p className="empty-state">No recent account activity.</p>}</div></section></>}</div>;
};
export default Profile;
