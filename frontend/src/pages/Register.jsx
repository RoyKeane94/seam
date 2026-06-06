import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthAside from '../components/AuthAside';
import MarketingFooter from '../components/MarketingFooter';
import MarketingNav from '../components/MarketingNav';
import { api, setToken } from '../api';

export default function Register() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!inviteCode.trim()) {
      setError('Invite code is required.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.register({
        email,
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        invite_code: inviteCode.trim(),
      });
      setToken(data.token);
      navigate('/record');
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <MarketingNav page="register" />
      <main className="auth-split">
        <AuthAside variant="register" />
        <div className="auth-panel">
          <h2 className="auth-panel-title">Create your account</h2>
          <p className="auth-panel-sub">
            Invite only · free for two weeks · from £9/mo after
          </p>

          <div className="auth-callout">
            <span className="auth-callout-icon" aria-hidden="true">✦</span>
            <p>You&apos;ll need an invite code to get in. Enter it at the bottom.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field-row">
              <label className="auth-field">
                <span className="auth-label">First name</span>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Alex"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className="auth-field">
                <span className="auth-label">Last name</span>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Chen"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </label>
            </div>
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
                placeholder="8+ characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </label>
            <label className="auth-field">
              <span className="auth-label">Invite code</span>
              <input
                className="auth-input"
                type="text"
                placeholder="SEAM-XXXX"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoComplete="off"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="auth-submit-outline" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          <p className="auth-panel-footer">
            Already have an account?{' '}
            <Link to="/login" className="auth-link-btn">Sign in →</Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
