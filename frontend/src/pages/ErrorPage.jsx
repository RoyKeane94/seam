import { Link } from 'react-router-dom';
import MarketingFooter from '../components/MarketingFooter';
import MarketingNav from '../components/MarketingNav';

export default function ErrorPage({ onRetry }) {
  return (
    <div className="error-shell">
      <MarketingNav />
      <main className="error-main">
        <div className="error-panel">
          <p className="error-code">Error</p>
          <h1 className="error-title">Something went wrong</h1>
          <p className="error-lead">
            The app hit an unexpected problem. Try again — we&apos;ve logged the details.
          </p>
          <div className="error-actions">
            {onRetry && (
              <button type="button" className="error-btn error-btn-primary" onClick={onRetry}>
                Try again
              </button>
            )}
            <Link to="/record" className="error-btn error-btn-ghost">
              Open app
            </Link>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
