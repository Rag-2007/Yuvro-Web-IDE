import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister } from '../api';

export default function LoginPage() {
  const { login } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setEmail(''); setPassword(''); setConfirmPassword(''); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Email and password are required.'); return; }
    if (tab === 'register' && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (tab === 'register' && password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const res = tab === 'login' ? await apiLogin(email, password) : await apiRegister(email, password);
      login(res.user, res.token);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || (tab === 'login' ? 'Invalid email or password.' : 'Registration failed.')));
    }
    setLoading(false);
  };

  return (
    <div className="auth-root">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <img src="/yuvro.png" alt="Yuvro" className="auth-logo" />
          <div className="auth-brand-text">
            <span className="auth-brand-name">Yuvro</span>
            <span className="auth-brand-product">Web-IDE</span>
          </div>
        </div>

        <p className="auth-tagline">Browser-based development environment</p>

        <div className="auth-tabs">
          <button
            id="auth-tab-login"
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); reset(); }}
          >
            Sign In
          </button>
          <button
            id="auth-tab-register"
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => { setTab('register'); reset(); }}
          >
            Create Account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="input"
              placeholder={tab === 'register' ? 'Min 6 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {tab === 'register' && (
            <div className="auth-field">
              <label htmlFor="auth-confirm">Confirm Password</label>
              <input
                id="auth-confirm"
                type="password"
                className="input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          {error && (
            <div className="auth-error" role="alert">{error}</div>
          )}

          <button
            id="auth-submit"
            type="submit"
            className="button auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 14, height: 14 }} /> {tab === 'login' ? 'Signing in…' : 'Creating account…'}</>
            ) : (
              tab === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          </span>
          <button
            className="auth-switch-link"
            onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); reset(); }}
          >
            {tab === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
