import { Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useNotifications } from '../../hooks/useNotifications';
import {
  createAdminCoupon,
  deleteAdminCoupon,
  getAdminCoupons,
  subscribeToAdminTable,
  updateAdminCoupon,
  updateCouponState,
} from '../../lib/admin';
import { Modal } from '../../components/ui/Modal';
import type { Coupon } from '../../lib/types';
import { formatDate, formatPrice } from '../../lib/utils';

type CouponFormState = {
  code: string;
  discountType: Coupon['discount_type'];
  discountValue: string;
  minOrder: string;
  maxUses: string;
  expiresAt: string;
  isActive: boolean;
};

type CouponFormErrors = Partial<Record<'code' | 'discountValue' | 'minOrder' | 'maxUses' | 'expiresAt' | 'general', string>>;

const emptyCouponForm: CouponFormState = {
  code: '',
  discountType: 'percent',
  discountValue: '15',
  minOrder: '1200',
  maxUses: '200',
  expiresAt: '',
  isActive: true,
};

function validateCouponForm(form: CouponFormState): CouponFormErrors {
  const errors: CouponFormErrors = {};

  if (!form.code.trim()) {
    errors.code = 'Coupon code is required.';
  }

  if (!form.discountValue.trim()) {
    errors.discountValue = 'Enter a discount value.';
  } else {
    const discountValue = Number(form.discountValue);

    if (!Number.isFinite(discountValue)) {
      errors.discountValue = 'Enter a valid discount value.';
    } else if (form.discountType === 'percent' && (discountValue <= 0 || discountValue > 100)) {
      errors.discountValue = 'Percent discounts must be between 1 and 100.';
    } else if (form.discountType === 'fixed' && discountValue <= 0) {
      errors.discountValue = 'Fixed discounts must be greater than zero.';
    }
  }

  if (!form.minOrder.trim()) {
    errors.minOrder = 'Enter a minimum order value.';
  } else {
    const minOrder = Number(form.minOrder);
    if (!Number.isFinite(minOrder) || minOrder < 0) {
      errors.minOrder = 'Minimum order cannot be negative.';
    }
  }

  if (!form.maxUses.trim()) {
    errors.maxUses = 'Enter how many times this coupon can be used.';
  } else {
    const maxUses = Number(form.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      errors.maxUses = 'Max uses must be a whole number of at least 1.';
    }
  }

  if (form.expiresAt) {
    const expiry = new Date(`${form.expiresAt}T23:59:59`);
    if (Number.isNaN(expiry.getTime())) {
      errors.expiresAt = 'Choose a valid expiration date.';
    }
  }

  return errors;
}

export function ManageCoupons() {
  const { showToast } = useNotifications();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCouponId, setPendingCouponId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<CouponFormState>(emptyCouponForm);
  const [formErrors, setFormErrors] = useState<CouponFormErrors>({});

  useEffect(() => {
    let active = true;

    async function syncCoupons(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }

      const nextCoupons = await getAdminCoupons();

      if (!active) {
        return;
      }

      setCoupons(nextCoupons);

      if (showLoading) {
        setLoading(false);
      }
    }

    void syncCoupons(true);

    const unsubscribe = subscribeToAdminTable('coupons', () => {
      void syncCoupons();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const openCreate = () => {
    setEditingCouponId(null);
    setForm(emptyCouponForm);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCouponId(coupon.id);
    setForm({
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value),
      minOrder: String(coupon.min_order),
      maxUses: String(coupon.max_uses),
      expiresAt: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
      isActive: coupon.is_active,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setEditingCouponId(null);
    setForm(emptyCouponForm);
    setFormErrors({});
    setIsModalOpen(false);
  };

  const handleSubmit = async () => {
    const validationErrors = validateCouponForm(form);

    if (Object.keys(validationErrors).length) {
      setFormErrors(validationErrors);
      return;
    }

    const payload = {
      code: form.code,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrder: Number(form.minOrder),
      maxUses: Number(form.maxUses),
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      isActive: form.isActive,
    };

    setSubmitting(true);
    setFormErrors({});

    const result = editingCouponId
      ? await updateAdminCoupon(editingCouponId, payload)
      : await createAdminCoupon(payload);

    setSubmitting(false);

    if (result.error || !result.data) {
      const errorMessage = result.error ?? 'Unable to save the coupon.';
      const normalizedError = errorMessage.toLowerCase();

      if (normalizedError.includes('duplicate') || normalizedError.includes('code')) {
        setFormErrors({ code: 'Coupon code must be unique.' });
      } else {
        setFormErrors({ general: errorMessage });
      }

      return;
    }

    const savedCoupon = result.data;
    setCoupons((current) =>
      editingCouponId
        ? current.map((entry) => (entry.id === savedCoupon.id ? savedCoupon : entry))
        : [savedCoupon, ...current],
    );
    closeModal();
    showToast(
      editingCouponId ? 'Coupon updated' : 'Coupon created',
      `${savedCoupon.code} is now saved in promo inventory.`,
    );
  };

  const toggleCoupon = async (coupon: Coupon) => {
    setPendingCouponId(coupon.id);
    const { data, error } = await updateCouponState(coupon.id, !coupon.is_active);
    setPendingCouponId(null);

    if (error || !data) {
      showToast('Coupon update failed', error ?? 'Unable to update the coupon status.');
      return;
    }

    setCoupons((current) => current.map((entry) => (entry.id === data.id ? data : entry)));
    showToast('Coupon updated', `${data.code} is now ${data.is_active ? 'active' : 'inactive'}.`);
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) {
      return;
    }

    setPendingCouponId(coupon.id);
    const { error } = await deleteAdminCoupon(coupon.id);
    setPendingCouponId(null);

    if (error) {
      showToast('Coupon delete failed', error);
      return;
    }

    setCoupons((current) => current.filter((entry) => entry.id !== coupon.id));
    showToast('Coupon deleted', `${coupon.code} has been removed from promo inventory.`);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Manage Coupons</span>
                <h2>Promo inventory</h2>
                <p>Create quick campaign codes and review existing discount rules.</p>
              </div>
              <Button onClick={openCreate}>
                <Plus size={18} />
                New Coupon
              </Button>
            </div>
            <div className="coupon-grid">
              {loading ? (
                <Card className="coupon-card">Loading coupons...</Card>
              ) : coupons.length ? (
                coupons.map((coupon) => (
                  <Card className="coupon-card" key={coupon.id}>
                    <div className="summary-row">
                      <strong>{coupon.code}</strong>
                      <TicketPercent size={18} color="var(--bloom-rose)" />
                    </div>
                    <p>
                      {coupon.discount_type === 'percent'
                        ? `${coupon.discount_value}% off`
                        : formatPrice(coupon.discount_value)}
                    </p>
                    <p>Min. order {formatPrice(coupon.min_order)}</p>
                    <p>
                      {coupon.used_count} / {coupon.max_uses} used
                    </p>
                    <p>{coupon.expires_at ? `Expires ${formatDate(coupon.expires_at)}` : 'No expiry set'}</p>
                    <div className="summary-row">
                      <span className={coupon.is_active ? 'badge badge-success' : 'badge badge-neutral'}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="summary-row">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(coupon)}>
                        <Pencil size={16} />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendingCouponId === coupon.id}
                        onClick={() => handleDelete(coupon)}
                      >
                        <Trash2 size={16} />
                        Delete
                      </Button>
                    </div>
                    <div className="summary-row">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pendingCouponId === coupon.id}
                        onClick={() => toggleCoupon(coupon)}
                      >
                        {coupon.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="coupon-card">No coupons found.</Card>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingCouponId ? 'Edit Coupon' : 'Create Coupon'}
        description="Control discount type, order threshold, usage limits, and active state."
        className="summary-card"
      >
        <div className="section">
          <div className="search-row">
            <Input
              label="Coupon Code"
              value={form.code}
              error={formErrors.code}
              onChange={(event) => {
                setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }));
                setFormErrors((current) => ({ ...current, code: undefined, general: undefined }));
              }}
            />
            <div className="field-stack">
              <label htmlFor="coupon-discount-type">Discount Type</label>
              <div className="select-shell">
                <select
                  id="coupon-discount-type"
                  value={form.discountType}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      discountType: event.target.value as Coupon['discount_type'],
                    }));
                    setFormErrors((current) => ({ ...current, discountValue: undefined, general: undefined }));
                  }}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="coupon-grid">
            <Input
              label={form.discountType === 'percent' ? 'Discount %' : 'Discount Amount'}
              type="number"
              min="0"
              step={form.discountType === 'percent' ? '1' : '0.01'}
              value={form.discountValue}
              error={formErrors.discountValue}
              hint={form.discountType === 'percent' ? 'Allowed range: 1 to 100.' : 'Use the fixed amount to deduct at checkout.'}
              onChange={(event) => {
                setForm((current) => ({ ...current, discountValue: event.target.value }));
                setFormErrors((current) => ({ ...current, discountValue: undefined, general: undefined }));
              }}
            />
            <Input
              label="Minimum Order"
              type="number"
              min="0"
              step="0.01"
              value={form.minOrder}
              error={formErrors.minOrder}
              onChange={(event) => {
                setForm((current) => ({ ...current, minOrder: event.target.value }));
                setFormErrors((current) => ({ ...current, minOrder: undefined, general: undefined }));
              }}
            />
            <Input
              label="Max Uses"
              type="number"
              min="1"
              step="1"
              value={form.maxUses}
              error={formErrors.maxUses}
              onChange={(event) => {
                setForm((current) => ({ ...current, maxUses: event.target.value }));
                setFormErrors((current) => ({ ...current, maxUses: undefined, general: undefined }));
              }}
            />
            <Input
              label="Expires On"
              type="date"
              value={form.expiresAt}
              error={formErrors.expiresAt}
              onChange={(event) => {
                setForm((current) => ({ ...current, expiresAt: event.target.value }));
                setFormErrors((current) => ({ ...current, expiresAt: undefined, general: undefined }));
              }}
            />
          </div>

          <label className="checkbox-option">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => {
                setForm((current) => ({ ...current, isActive: event.target.checked }));
                setFormErrors((current) => ({ ...current, general: undefined }));
              }}
            />
            Coupon is active and available at checkout
          </label>

          {formErrors.general ? <span className="field-error">{formErrors.general}</span> : null}

          <div className="summary-row">
            <Button type="button" variant="secondary" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editingCouponId ? 'Save Changes' : 'Create Coupon'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
