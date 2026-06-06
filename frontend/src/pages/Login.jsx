import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthAside from '../components/AuthAside';
import MarketingFooter from '../components/MarketingFooter';
import MarketingNav from '../components/MarketingNav';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      signIn(data.token, data.user);
      navigate('/record');
    } catch (err) {
      setError(err.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <MarketingNav page="login" />
      <main className="auth-split">
        <AuthAside variant="login" />
        <div className="auth-panel">
          <h2 className="auth-panel-title">Sign in</h2>
          <p className="auth-panel-sub">Welcome back to your notes.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">Email</span>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="auth-field">
              <span className="auth-label">Password</span>
              <input
                className="auth-input"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="auth-submit-outline" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p className="auth-panel-footer">
            No account?{' '}
            <Link to="/register" className="auth-link-btn">Get started →</Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
