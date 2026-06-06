import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import { useAuth } from '../context/AuthContext';

export default function Logout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    signOut().then(() => navigate('/login', { replace: true }));
  }, [signOut, navigate]);

  return (
    <div className="auth-shell">
      <MarketingNav />
      <main className="auth-logout">
        <p>Signing out…</p>
      </main>
    </div>
  );
}
