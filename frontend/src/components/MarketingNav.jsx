import { Link } from 'react-router-dom';
import LogoMark from './LogoMark';

export default function MarketingNav({ page }) {
  return (
    <nav className="marketing-nav">
      <div className="nav-inner">
        <a href="/" className="brand">
          <LogoMark size={20} />
          seam
        </a>
        <div className="nav-spacer" />
        <div className="nav-r">
          {page === 'login' ? (
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
