import { useEffect, useRef, useState } from 'react';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { TierBadge } from '../../components/rewards/TierBadge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { uploadAvatarImage } from '../../lib/admin';
import { deleteCustomerAddress, getCustomerAddresses, saveCustomerAddress } from '../../lib/data';
import type { DeliveryAddress } from '../../lib/types';

const emptyAddressForm = {
  label: 'Home',
  recipient_name: '',
  phone: '',
  address: '',
  delivery_notes: '',
  is_default: false,
};

export function ProfilePage() {
  const { user, profile, saveProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const displayAvatar = previewUrl || avatarUrl || null;
  const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0];

  useEffect(() => {
    if (!user?.id) return;
    getCustomerAddresses(user.id, profile).then(setAddresses);
  }, [profile?.address, profile?.full_name, profile?.phone, user?.id]);

  useEffect(() => {
    if (!selectedImageFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImageFile);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImageFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedImageFile(file);
    setMessage('');
  };

  const clearImage = () => {
    setSelectedImageFile(null);
    setPreviewUrl(null);
    setAvatarUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!user) {
      setMessage('You must be signed in to update your profile.');
      return;
    }

    setSaving(true);
    setMessage('');

    let finalAvatarUrl = avatarUrl.trim();

    if (selectedImageFile) {
      const upload = await uploadAvatarImage(selectedImageFile, user.id);
      if (upload.error || !upload.data) {
        setSaving(false);
        setMessage(upload.error ?? 'Unable to upload the photo.');
        return;
      }
      finalAvatarUrl = upload.data;
    }

    const result = await saveProfile({
      full_name: fullName,
      phone,
      address: defaultAddress?.address ?? profile?.address ?? '',
      avatar_url: finalAvatarUrl,
    });

    setSaving(false);
    setSelectedImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!result.error) {
      setAvatarUrl(finalAvatarUrl);
    }

    setMessage(result.error ?? 'Profile updated.');
  };

  const openAddressModal = (address?: DeliveryAddress) => {
    setEditingAddressId(address?.id ?? null);
    setAddressForm(
      address
        ? {
            label: address.label,
            recipient_name: address.recipient_name,
            phone: address.phone,
            address: address.address,
            delivery_notes: address.delivery_notes ?? '',
            is_default: address.is_default,
          }
        : {
            ...emptyAddressForm,
            recipient_name: fullName || profile?.full_name || '',
            phone: phone || profile?.phone || '',
            is_default: !addresses.length,
          },
    );
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!user?.id || !addressForm.address.trim()) {
      setMessage('A delivery address is required.');
      return;
    }

    setSaving(true);
    setMessage('');

    const result = await saveCustomerAddress({
      id: editingAddressId ?? crypto.randomUUID(),
      user_id: user.id,
      label: addressForm.label.trim() || 'Delivery address',
      recipient_name: addressForm.recipient_name.trim() || fullName || profile?.full_name || 'Bloom customer',
      phone: addressForm.phone.trim() || phone || profile?.phone || '',
      address: addressForm.address.trim(),
      delivery_notes: addressForm.delivery_notes.trim() || null,
      is_default: addressForm.is_default || !addresses.length,
    });

    if (!result.error) {
      const nextAddresses = await getCustomerAddresses(user.id, profile);
      setAddresses(nextAddresses);
      const nextDefault = nextAddresses.find((entry) => entry.is_default) ?? result.data;
      if (nextDefault) {
        await saveProfile({ address: nextDefault.address });
      }
      setAddressModalOpen(false);
      setMessage('Address book updated.');
    } else {
      setMessage(result.error);
    }

    setSaving(false);
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user?.id) return;
    setSaving(true);
    const result = await deleteCustomerAddress(user.id, addressId);
    if (!result.error) {
      const nextAddresses = await getCustomerAddresses(user.id, profile);
      setAddresses(nextAddresses);
      await saveProfile({ address: nextAddresses.find((entry) => entry.is_default)?.address ?? nextAddresses[0]?.address ?? '' });
      setMessage('Address deleted.');
    } else {
      setMessage(result.error);
    }
    setSaving(false);
  };

  const handleSetDefaultAddress = async (address: DeliveryAddress) => {
    await saveCustomerAddress({ ...address, is_default: true });
    if (user?.id) {
      setAddresses(await getCustomerAddresses(user.id, profile));
    }
    await saveProfile({ address: address.address });
    setMessage('Default delivery address updated.');
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
                <p>{defaultAddress?.address ?? profile?.address}</p>
              </div>
              {profile ? <TierBadge tier={profile.tier} /> : null}
            </div>
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={profile?.full_name ?? 'Profile'}
                style={{ width: '7rem', height: '7rem', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '7rem',
                  height: '7rem',
                  borderRadius: '50%',
                  background: 'var(--glass)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '1.5rem',
                  color: 'var(--bloom-rose)',
                }}
              >
                {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <p>{profile?.points} points available</p>
          </Card>

          <Card className="summary-card">
            <div className="section">
              <Input label="Full Name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              <Input label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />

              <div className="field-stack">
                <label htmlFor="profile-photo-upload">Profile Photo</label>
                <Card className="summary-card" style={{ padding: '1rem' }}>
                  <div className="section" style={{ gap: '0.85rem' }}>
                    <input
                      ref={fileInputRef}
                      id="profile-photo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                    />
                    <div className="summary-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="muted">
                        {selectedImageFile
                          ? `${selectedImageFile.name} (${Math.max(1, Math.round(selectedImageFile.size / 1024))} KB)`
                          : avatarUrl
                            ? 'Using your saved profile photo.'
                            : 'Upload a profile photo from your device.'}
                      </span>
                      {(selectedImageFile || avatarUrl) && (
                        <Button type="button" size="sm" variant="ghost" onClick={clearImage}>
                          {selectedImageFile ? 'Clear Upload' : 'Remove Photo'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
                <span className="muted">JPG, PNG, or WEBP up to 2 MB.</span>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
              {message ? (
                <p className={message === 'Profile updated.' ? 'success' : 'rose'}>{message}</p>
              ) : null}
            </div>
          </Card>

          <Card className="summary-card">
            <div className="summary-row">
              <div className="section" style={{ gap: '0.25rem' }}>
                <span className="eyebrow">Address Book</span>
                <h2>Delivery addresses</h2>
                <p>Use one default at checkout and switch addresses per order.</p>
              </div>
              <Button type="button" onClick={() => openAddressModal()}>
                Add Address
              </Button>
            </div>

            <div className="section">
              {addresses.map((address) => (
                <Card className="summary-card" style={{ padding: '1rem' }} key={address.id}>
                  <div className="summary-row">
                    <div className="section" style={{ gap: '0.2rem' }}>
                      <strong>{address.label}</strong>
                      <p>{address.address}</p>
                      <span className="muted">
                        {address.recipient_name} · {address.phone || 'No phone'}
                      </span>
                    </div>
                    {address.is_default ? <span className="badge badge-success">Default</span> : null}
                  </div>
                  {address.delivery_notes ? <p>{address.delivery_notes}</p> : null}
                  <div className="action-row">
                    {!address.is_default ? (
                      <Button variant="secondary" size="sm" onClick={() => handleSetDefaultAddress(address)}>
                        Set default
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => openAddressModal(address)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteAddress(address.id)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
              {!addresses.length ? <p className="muted">Add an address to speed up checkout.</p> : null}
            </div>
          </Card>
        </section>
      </div>

      <Modal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        title={editingAddressId ? 'Edit Address' : 'Add Address'}
        description="Save delivery details for faster checkout."
      >
        <div className="section">
          <Input
            label="Label"
            value={addressForm.label}
            onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })}
          />
          <div className="search-row">
            <Input
              label="Recipient"
              value={addressForm.recipient_name}
              onChange={(event) => setAddressForm({ ...addressForm, recipient_name: event.target.value })}
            />
            <Input
              label="Phone"
              value={addressForm.phone}
              onChange={(event) => setAddressForm({ ...addressForm, phone: event.target.value })}
            />
          </div>
          <Textarea
            label="Delivery Address"
            value={addressForm.address}
            onChange={(event) => setAddressForm({ ...addressForm, address: event.target.value })}
          />
          <Textarea
            label="Delivery Notes"
            value={addressForm.delivery_notes}
            onChange={(event) => setAddressForm({ ...addressForm, delivery_notes: event.target.value })}
          />
          <label className="summary-row" style={{ justifyContent: 'flex-start' }}>
            <input
              type="checkbox"
              checked={addressForm.is_default}
              onChange={(event) => setAddressForm({ ...addressForm, is_default: event.target.checked })}
            />
            <span>Use as default delivery address</span>
          </label>
          <div className="action-row">
            <Button variant="secondary" onClick={() => setAddressModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAddress} disabled={saving}>
              {saving ? 'Saving...' : 'Save Address'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
