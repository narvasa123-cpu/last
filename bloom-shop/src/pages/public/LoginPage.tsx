import { Lock, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_ROUTES } from '../../lib/constants';
import { isDemoMode } from '../../lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, role, signIn, demoCredentials } = useAuth();
  const [email, setEmail] = useState('customer@bloom.shop');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(ROLE_ROUTES[role]);
    }
  }, [navigate, role, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
  };

  return (
    <PageWrapper>
      <div className="auth-shell">
        <Card className="auth-card">
          <div className="auth-aside">
            <span className="eyebrow">Bloom Access</span>
            <h2>Sign in to manage orders, rewards, and delivery.</h2>
            <p>
              {isDemoMode
                ? 'Demo mode is enabled. Use the seeded role accounts below to open any dashboard immediately.'
                : 'Live Supabase auth is enabled. Use the seeded starter accounts below, or sign in with any real account from your project.'}
            </p>
            <div className="section">
              {demoCredentials.map((credential) => (
                <button
                  key={credential.email}
                  className="payment-card"
                  onClick={() => {
                    setEmail(credential.email);
                    setPassword(credential.password);
                  }}
                  type="button"
                >
                  <div className="section" style={{ gap: '0.2rem', textAlign: 'left' }}>
                    <strong>{credential.label}</strong>
                    <p>
                      {credential.email} / {credential.password}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="section">
              <span className="eyebrow">Welcome Back</span>
              <h2>Login</h2>
              <p>
                {isDemoMode
                  ? 'Continue with the local seeded demo accounts.'
                  : 'Continue to your live Bloom Shop experience with real Supabase Auth.'}
              </p>
            </div>
            <Input
              label="Email"
              type="email"
              icon={<Mail size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={error}
            />
            <Input
              label="Password"
              type="password"
              icon={<Lock size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <p>
              No account yet?{' '}
              <Link className="rose" to="/register">
                Create one here
              </Link>
              .
            </p>
          </form>
        </Card>
      </div>
    </PageWrapper>
  );
}
