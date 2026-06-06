const FEATURES = [
  'Record or type — however it comes out',
  'Daily digest — your day, handed back each evening',
  'Ask anything — retrieve your own words on any topic',
];

export default function AuthAside({ variant = 'register' }) {
  if (variant === 'login') {
    return (
      <aside className="auth-aside">
        <h1 className="auth-aside-title">
          Dump it in.
          <br />
          <em>Find it</em> later.
        </h1>
        <p className="auth-aside-desc">
          Welcome back. Your notes are right where you left them — cleaned up and ready to retrieve.
        </p>
        <ul className="auth-features">
          {FEATURES.map((text) => (
            <li key={text}>
              <span className="auth-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
    );
  }

  return (
    <aside className="auth-aside">
      <div className="auth-badge">
        <span className="auth-badge-dot" />
        Early access
      </div>
      <h1 className="auth-aside-title">
        Your thinking,
        <br />
        <em>findable.</em>
      </h1>
      <p className="auth-aside-desc">
        Talk on a walk, type between meetings. Seam catches everything and brings it back when you need it.
      </p>
      <ul className="auth-features">
        {FEATURES.map((text) => (
          <li key={text}>
            <span className="auth-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
