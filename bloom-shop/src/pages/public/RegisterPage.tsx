import { Lock, Mail, Phone, UserCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_ROUTES } from '../../lib/constants';
import { isDemoMode } from '../../lib/supabase';

export function RegisterPage() {
  const navigate = useNavigate();
  const { user, role, signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(ROLE_ROUTES[role]);
    }
  }, [navigate, role, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fullName || !email || !password) {
      setError('Full name, email, and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await signUp({
      fullName,
      email,
      password,
      phone,
      address,
    });
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
            <span className="eyebrow">New Bloom Account</span>
            <h2>Create your account and step into the full delivery flow.</h2>
            <p>
              {isDemoMode
                ? 'Demo mode is enabled, so registration creates a local seeded session and lands you in the matching dashboard.'
                : 'Live Supabase auth is enabled, so registration creates a real account in your project.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="section">
              <span className="eyebrow">Register</span>
              <h2>Join Bloom Shop</h2>
              <p>
                {isDemoMode
                  ? 'Create a local demo account for any role and open the system immediately.'
                  : 'Set up your live account and start ordering, dispatching, or managing sales.'}
              </p>
            </div>
            <Input
              label="Full Name"
              icon={<UserCircle2 size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              error={error}
            />
            <Input
              label="Email"
              type="email"
              icon={<Mail size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label="Phone"
              icon={<Phone size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
            <Input
              label="Password"
              type="password"
              icon={<Lock size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Input
              label="Confirm Password"
              type="password"
              icon={<Lock size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
            <p>
              Already have an account?{' '}
              <Link className="rose" to="/login">
                Sign in
              </Link>
              .
            </p>
          </form>
        </Card>
      </div>
    </PageWrapper>
  );
}
