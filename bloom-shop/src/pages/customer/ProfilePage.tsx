import { useState } from 'react';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { TierBadge } from '../../components/rewards/TierBadge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';

export function ProfilePage() {
  const { profile, saveProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    const result = await saveProfile({
      full_name: fullName,
      phone,
      address,
      avatar_url: avatarUrl,
    });
    setMessage(result.error ?? 'Profile updated.');
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <section className="cart-layout">
          <Card className="summary-card">
            <div className="summary-row">
              <div className="section" style={{ gap: '0.25rem' }}>
                <span className="eyebrow">Profile</span>
                <h2>{profile?.full_name}</h2>
                <p>{profile?.address}</p>
              </div>
              {profile ? <TierBadge tier={profile.tier} /> : null}
            </div>
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                style={{ width: '7rem', height: '7rem', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : null}
            <p>{profile?.points} points available</p>
          </Card>

          <Card className="summary-card">
            <div className="section">
              <Input label="Full Name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              <Input label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <Input label="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
              <Input label="Avatar URL" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
              <Button onClick={handleSave}>Save Profile</Button>
              {message ? <p className={message === 'Profile updated.' ? 'success' : 'rose'}>{message}</p> : null}
            </div>
          </Card>
        </section>
      </div>
    </PageWrapper>
  );
}
