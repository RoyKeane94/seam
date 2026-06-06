import { Link } from 'react-router-dom';
import LogoMark from '../components/LogoMark';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="app-layout settings-layout">
      <header className="topbar">
        <a href="/" className="brand">
          <LogoMark size={22} />
          seam
        </a>
        <div className="topbar-spacer" />
        <div className="topbar-right">
          <Link to="/record" className="topbar-retrieve">
            Record
          </Link>
        </div>
      </header>

      <main className="settings-main">
        <h1 className="settings-title">Settings</h1>

        <section className="settings-section">
          <h2 className="settings-label">Account</h2>
          <div className="settings-card">
            <div className="settings-row">
              <span className="settings-row-label">Email</span>
              <span className="settings-row-value">{user?.email || '—'}</span>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <Link to="/logout" className="settings-signout">
            Sign out
          </Link>
        </section>
      </main>
    </div>
  );
}
