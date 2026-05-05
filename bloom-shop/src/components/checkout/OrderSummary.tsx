import type { CartLine } from '../../lib/types';
import { formatPrice } from '../../lib/utils';
import { Card } from '../ui/Card';

interface OrderSummaryProps {
  items: CartLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  pointsToEarn: number;
}

export function OrderSummary({
  items,
  subtotal,
  deliveryFee,
  discount,
  total,
  pointsToEarn,
}: OrderSummaryProps) {
  return (
    <Card className="summary-card order-summary">
      <div className="section" style={{ gap: '0.35rem' }}>
        <strong>Order Summary</strong>
        <p>Review your bouquet bundle before confirming delivery.</p>
      </div>

      <div className="cart-list">
        {items.map((line) => (
          <div className="summary-row" key={line.product.id}>
            <div className="section" style={{ gap: '0.15rem' }}>
              <span>{line.product.name}</span>
              <small className="muted">Qty {line.quantity}</small>
            </div>
            <strong>{formatPrice(line.product.price * line.quantity)}</strong>
          </div>
        ))}
      </div>

      <div className="summary-row">
        <span>Subtotal</span>
        <strong>{formatPrice(subtotal)}</strong>
      </div>
      <div className="summary-row">
        <span>Delivery Fee</span>
        <strong>{deliveryFee ? formatPrice(deliveryFee) : 'Free'}</strong>
      </div>
      <div className="summary-row">
        <span>Discount</span>
        <strong className="rose">-{formatPrice(discount)}</strong>
      </div>
      <div className="summary-row">
        <span>Total</span>
        <strong className="price">{formatPrice(total)}</strong>
      </div>

      <div className="glass-card" style={{ padding: '1rem' }}>
        <strong className="rose">You’ll earn {pointsToEarn} loyalty points</strong>
        <p>Points are credited once your order moves to confirmed.</p>
      </div>
    </Card>
  );
}
