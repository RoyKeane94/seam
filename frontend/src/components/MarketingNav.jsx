import { Link } from 'react-router-dom';
import LogoMark from './LogoMark';
import { useAuth } from '../context/AuthContext';

export default function MarketingNav({ page }) {
  const { isAuthenticated, loading } = useAuth();

  return (
    <nav className="marketing-nav">
      <div className="nav-inner">
        <a href="/" className="brand">
          <LogoMark size={20} />
          seam
        </a>
        <div className="nav-spacer" />
        <div className="nav-r">
          {loading ? null : isAuthenticated ? (
            <>
              <Link to="/record" className="nav-text-link">
                Open app
              </Link>
              <Link to="/logout" className="nav-outline-btn">
                Sign out
              </Link>
            </>
          ) : page === 'login' ? (
            <Link to="/register" className="nav-outline-btn">
              Get started
            </Link>
          ) : (
            <Link to="/login" className="nav-outline-btn">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
