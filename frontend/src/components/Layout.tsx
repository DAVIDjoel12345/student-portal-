import React, { useEffect, useState } from 'react';
import { NavLink, useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

const NavIcon = ({ name }: { name: 'dashboard' | 'records' | 'profile' }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    records: <><path d="M7 3.75h8l4 4V20a1.25 1.25 0 0 1-1.25 1.25h-11.5A1.25 1.25 0 0 1 5 20V5a1.25 1.25 0 0 1 1.25-1.25Z" /><path d="M15 4v4h4M8.5 12h7M8.5 16h7" /></>,
    profile: <><circle cx="12" cy="8" r="3.25" /><path d="M5 20c.75-3.3 3.15-5 7-5s6.25 1.7 7 5" /></>,
  };
  return <svg className="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  const history = useHistory();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = user?.role || 'student';
  const roleLabel = role === 'student' ? 'Student portal' : role === 'staff' ? 'Records office' : 'Administration';
  const pageLabel = location.pathname === '/profile'
    ? role === 'admin' ? location.search.includes('view=catalog') ? 'Academic catalogue' : 'User accounts' : 'My profile'
    : location.pathname === '/records'
      ? role === 'student' ? 'Academic records' : role === 'staff' ? 'Manage records' : 'Audit logs'
      : 'Dashboard';
  const initials = (user?.name || 'User').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    history.replace('/login');
  };

  return (
    <div className="app-shell">
      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />}
      <aside id="portal-navigation" className={`sidebar${menuOpen ? ' sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span>ACADEMIC<br /><b>PORTAL</b></span>
        </div>
        <div className="sidebar-label">{role === 'student' ? 'Workspace' : role === 'staff' ? 'Records office' : 'Administration'}</div>
        <nav aria-label="Main navigation">
          <NavLink exact to="/" activeClassName="active"><NavIcon name="dashboard" />Dashboard</NavLink>
          <NavLink to="/records" activeClassName="active"><NavIcon name="records" />{role === 'student' ? 'Academic records' : role === 'staff' ? 'Manage records' : 'Audit logs'}</NavLink>
          <NavLink to="/profile" activeClassName="active"><NavIcon name="profile" />{role === 'admin' ? 'User accounts' : 'My profile'}</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="secure-chip"><span className="secure-dot" aria-hidden="true" /><div><strong>Secure access</strong><small>Multi-factor enabled</small></div></div>
          <button className="signout" onClick={handleLogout}><span aria-hidden="true">↪</span><span>Sign out</span></button>
        </div>
      </aside>
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-context">
              <button className="menu-toggle" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-controls="portal-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              <span /><span /><span />
            </button>
            <div className="breadcrumb"><span>{roleLabel}</span><span className="breadcrumb-separator">/</span><strong>{pageLabel}</strong></div>
          </div>
          <div className="user-menu">
            <div className="avatar" aria-hidden="true">{initials}</div>
            <div className="user-details"><strong>{user?.name || 'User'}</strong><small>{user?.username}</small></div>
            <span className="role-chip">{role}</span>
          </div>
        </header>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <main id="main-content" className="page-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
};

export default Layout;
