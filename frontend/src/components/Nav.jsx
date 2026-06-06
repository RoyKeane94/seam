import { Link, useLocation } from 'react-router-dom';
import LogoMark from './LogoMark';
import { logout } from '../api';

export default function Nav() {
  const { pathname } = useLocation();

  return (
    <div className="nav">
      <Link to="/record" className="brand">
        <LogoMark />
        seam
      </Link>
      <div className="nav-right">
        <Link
          to="/record"
          className={`nav-link${pathname === '/record' ? ' active' : ''}`}
        >
          Record
        </Link>
        <Link
          to="/search"
          className={`nav-link${pathname === '/search' ? ' active' : ''}`}
        >
          Search
        </Link>
        <button type="button" className="nav-signout" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
