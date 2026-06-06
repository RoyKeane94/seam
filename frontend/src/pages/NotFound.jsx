import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';

export default function NotFound() {
  return (
    <div className="error-shell">
      <MarketingNav />
      <main className="error-main">
        <div className="error-panel">
          <p className="error-code">404</p>
          <h1 className="error-title">Page not found</h1>
          <p className="error-lead">
            That page doesn&apos;t exist. Check the URL or head back to your notes.
          </p>
          <div className="error-actions">
            <Link to="/record" className="error-btn error-btn-primary">
              Open app
            </Link>
            <Link to="/" className="error-btn error-btn-ghost">
              Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
