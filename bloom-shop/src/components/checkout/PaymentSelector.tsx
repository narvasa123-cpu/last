import { CreditCard, Landmark, QrCode, Wallet } from 'lucide-react';

import type { Coupon, PaymentMethod } from '../../lib/types';
import { formatPrice } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface CardFormState {
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardholder: string;
}

interface PaymentSelectorProps {
  method: CheckoutPaymentMethod;
  onMethodChange: (method: CheckoutPaymentMethod) => void;
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  onApplyCoupon: () => void;
  appliedCoupon: Coupon | null;
  availablePoints: number;
  rewardPointsApplied: number;
  onRewardPointsApplied: (points: number) => void;
  gcashReference: string;
  onGcashReferenceChange: (value: string) => void;
  cardState: CardFormState;
  onCardStateChange: (state: CardFormState) => void;
}

const methods = [
  { id: 'cod' as const, label: 'Cash on Delivery', icon: <Wallet size={18} />, copy: 'Pay the rider upon arrival.' },
  { id: 'gcash' as const, label: 'GCash', icon: <QrCode size={18} />, copy: 'Scan the code and submit your reference number.' },
  { id: 'card' as const, label: 'Card', icon: <CreditCard size={18} />, copy: 'Use the secure card simulator for testing.' },
];

const qrDataUrl =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="24" fill="#fff5f7"/>
    <rect x="24" y="24" width="152" height="152" rx="16" fill="#ffffff"/>
    <path d="M42 42h40v40H42zM118 42h40v40h-40zM42 118h40v40H42zM100 100h18v18h-18zM124 100h16v16h-16zM100 124h16v16h-16zM144 118h14v40h-14zM118 144h16v14h-16zM42 90h16v16H42zM64 90h18v16H64z" fill="#e91e63"/>
    <text x="100" y="186" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" fill="#9e7d8a">Bloom Shop GCash</text>
  </svg>`);

export function PaymentSelector({
  method,
  onMethodChange,
  couponCode,
  onCouponCodeChange,
  onApplyCoupon,
  appliedCoupon,
  availablePoints,
  rewardPointsApplied,
  onRewardPointsApplied,
  gcashReference,
  onGcashReferenceChange,
  cardState,
  onCardStateChange,
}: PaymentSelectorProps) {
  return (
    <div className="section">
      <div className="payment-method-grid">
        {methods.map((item) => (
          <button
            key={item.id}
            className={method === item.id ? 'payment-card active' : 'payment-card'}
            onClick={() => onMethodChange(item.id)}
            type="button"
          >
            <div className="section" style={{ gap: '0.4rem', textAlign: 'left' }}>
              <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
                <span className="timeline-icon" style={{ width: '2.4rem', height: '2.4rem' }}>
                  {item.icon}
                </span>
                <strong>{item.label}</strong>
              </div>
              <p>{item.copy}</p>
            </div>
          </button>
        ))}
      </div>

      {method === 'gcash' ? (
        <div className="search-row">
          <div className="glass-card center" style={{ padding: '1rem' }}>
            <img src={qrDataUrl} alt="GCash QR Code" style={{ width: '100%', maxWidth: '200px' }} />
            <p>Account Name: Bloom Shop Floral Studio</p>
          </div>
          <Input
            label="GCash Reference Number"
            id="gcash-ref"
            icon={<Landmark size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
            value={gcashReference}
            onChange={(event) => onGcashReferenceChange(event.target.value)}
            hint="Use the transaction reference after payment."
          />
        </div>
      ) : null}

      {method === 'card' ? (
        <div className="section">
          <div
            className="glass-card"
            style={{
              padding: '1.35rem',
              background: 'linear-gradient(135deg, rgba(233,30,99,0.92), rgba(240,98,146,0.84))',
              color: 'var(--bloom-white)',
            }}
          >
            <div className="section" style={{ gap: '1.5rem' }}>
              <div className="summary-row">
                <span>Bloom Card</span>
                <CreditCard size={18} />
              </div>
              <strong style={{ fontSize: '1.35rem', letterSpacing: '0.12em' }}>
                {cardState.cardNumber || '•••• •••• •••• ••••'}
              </strong>
              <div className="summary-row">
                <div className="section" style={{ gap: '0.15rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.72)' }}>Cardholder</span>
                  <strong>{cardState.cardholder || 'Bloom Customer'}</strong>
                </div>
                <div className="section" style={{ gap: '0.15rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.72)' }}>Expires</span>
                  <strong>{cardState.expiry || 'MM/YY'}</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="search-row">
            <Input
              label="Card Number"
              value={cardState.cardNumber}
              onChange={(event) => onCardStateChange({ ...cardState, cardNumber: event.target.value })}
            />
            <Input
              label="Cardholder"
              value={cardState.cardholder}
              onChange={(event) => onCardStateChange({ ...cardState, cardholder: event.target.value })}
            />
          </div>
          <div className="search-row">
            <Input
              label="Expiry"
              placeholder="MM/YY"
              value={cardState.expiry}
              onChange={(event) => onCardStateChange({ ...cardState, expiry: event.target.value })}
            />
            <Input
              label="CVV"
              placeholder="123"
              value={cardState.cvv}
              onChange={(event) => onCardStateChange({ ...cardState, cvv: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      <div className="search-row">
        <Input
          label="Coupon Code"
          value={couponCode}
          onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
          hint={appliedCoupon ? `Applied: ${appliedCoupon.code}` : 'Try BLOOM10 or FREESHIP'}
        />
        <Button variant="secondary" onClick={onApplyCoupon}>
          Apply Coupon
        </Button>
      </div>

      <div className="glass-card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div className="summary-row">
          <div>
            <strong>Redeem Points</strong>
            <p>{availablePoints} available points</p>
          </div>
          <strong className="rose">{formatPrice(rewardPointsApplied)}</strong>
        </div>
        <input
          type="range"
          min={0}
          max={availablePoints}
          step={10}
          value={rewardPointsApplied}
          onChange={(event) => onRewardPointsApplied(Number(event.target.value))}
        />
        <p>1 point = ₱1 discount for this demo checkout flow.</p>
      </div>
    </div>
  );
}
type CheckoutPaymentMethod = Exclude<PaymentMethod, 'cash'>;
