import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_LINKS = [
  { label: 'Overview', helper: 'Agents', to: '/home' },
  { label: 'Builder', helper: 'Design & tune', to: '/builder' },
  { label: 'Flow Canvas', helper: 'Visual orchestration', to: '/canvas' },
  { label: 'Templates', helper: 'Starter kits', to: '/templates' },
  { label: 'Testing Lab', helper: 'A/B & QA', to: '/testing' },
  { label: 'Chat', helper: 'Single agent', to: '/chat' },
  { label: 'Multi-Agent', helper: 'Swarm chat', to: '/multi-chat' },
  { label: 'Autonomous', helper: 'Task runner', to: '/autonomous' },
  { label: 'Fusion Lab', helper: 'Experiments', to: '/fusion-lab' },
];

export default function DashboardLayout({ headerContent, actions, children }) {
  const { user, signOut } = useAuth();

  return (
    <div className="workspace-shell">
      <aside className="workspace-nav">
        <div className="nav-brand">
          <div className="brand-mark">NB</div>
          <div>
            <p>Neural Base</p>
            <strong>Command</strong>
          </div>
        </div>
        <nav className="nav-links">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}
            >
              <span className="nav-link-label">{item.label}</span>
              <span className="nav-link-helper">{item.helper}</span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-footer">
          <NavLink to="/profile" className={({ isActive }) => `nav-link slim ${isActive ? 'is-active' : ''}`}>
            Profile & Security
          </NavLink>
          <button type="button" className="ghost-link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="workspace-main">
        <div className="workspace-topbar">
          <div className="topbar-heading">
            {headerContent || (
              <>
                <p className="eyebrow">Neural Command Deck</p>
                <h1>Overview</h1>
              </>
            )}
          </div>
          <div className="topbar-actions">
            {actions && <div className="topbar-actions-extra">{actions}</div>}
            <div className="user-chip">
              <div>
                <span className="chip-label">Signed in</span>
                <p>{user?.email || 'Guest user'}</p>
              </div>
              <button type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="workspace-content">{children}</div>
      </div>
    </div>
  );
}
