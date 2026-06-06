import { Link, useLocation } from 'react-router-dom';
import LogoMark from './LogoMark';

export default function Nav() {
  const { pathname } = useLocation();

  return (
    <div className="nav">
      <a href="/" className="brand">
        <LogoMark />
        seam
      </a>
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
        <Link to="/logout" className="nav-signout">
          Sign out
        </Link>
      </div>
    </div>
  );
}
