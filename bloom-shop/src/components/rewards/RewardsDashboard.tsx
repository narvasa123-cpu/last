import { Gift, TicketPercent } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useRewards } from '../../hooks/useRewards';
import { formatDateTime, formatPrice } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { PointsBar } from './PointsBar';
import { TierBadge } from './TierBadge';

export function RewardsDashboard() {
  const { points, tier, progress, history, coupons, loading } = useRewards();
  const [animatedPoints, setAnimatedPoints] = useState(0);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(0);

  useEffect(() => {
    let current = 0;
    const interval = window.setInterval(() => {
      current += Math.ceil(points / 20) || 1;
      if (current >= points) {
        current = points;
        window.clearInterval(interval);
      }
      setAnimatedPoints(current);
    }, 40);

    return () => window.clearInterval(interval);
  }, [points]);

  return (
    <>
      <div className="rewards-layout">
        <Card className="reward-card">
          <div className="summary-row">
            <div className="section" style={{ gap: '0.3rem' }}>
              <span className="eyebrow">Loyalty Rewards</span>
              <h2>{tier} Status</h2>
              <p>
                {progress.next
                  ? `${Math.max(0, (progress.next === 'Silver' ? 500 : 1500) - points)} points until ${progress.next}`
                  : 'You are at the highest Bloom tier.'}
              </p>
            </div>
            <TierBadge tier={tier} />
          </div>
          <div className="section">
            <span className="count-up">{animatedPoints.toLocaleString('en-PH')}</span>
            <PointsBar value={progress.progress} />
            <div className="summary-row">
              <span>Bronze: 0-499 pts</span>
              <span>Silver: 500-1499 pts</span>
              <span>Gold: 1500+ pts</span>
            </div>
          </div>
          <Button onClick={() => setRedeemOpen(true)}>
            <Gift size={18} />
            Redeem Points
          </Button>
        </Card>

        <Card className="reward-card">
          <div className="summary-row">
            <div className="section" style={{ gap: '0.25rem' }}>
              <strong>Points History</strong>
              <p>Recent reward earnings and redemptions.</p>
            </div>
          </div>
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>Points</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4}>Loading rewards history...</td>
                  </tr>
                ) : (
                  history.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.created_at)}</td>
                      <td>{entry.order_id ? `#${entry.order_id}` : '-'}</td>
                      <td className={entry.points >= 0 ? 'success' : 'rose'}>
                        {entry.points >= 0 ? '+' : ''}
                        {entry.points}
                      </td>
                      <td>{entry.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="coupon-grid">
          {coupons.map((coupon) => (
            <Card className="coupon-card" key={coupon.id}>
              <div className="summary-row">
                <span className="badge badge-primary">{coupon.code}</span>
                <TicketPercent size={18} color="var(--bloom-rose)" />
              </div>
              <h3>
                {coupon.discount_type === 'percent'
                  ? `${coupon.discount_value}% off`
                  : `${formatPrice(coupon.discount_value)} off`}
              </h3>
              <p>Min. order {formatPrice(coupon.min_order)}</p>
            </Card>
          ))}
        </div>
      </div>

      <Modal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        title="Redeem Points"
        description="Choose how many points to convert into an order discount."
      >
        <div className="section">
          <strong>{redeemAmount} points</strong>
          <input
            type="range"
            min={0}
            max={points}
            step={10}
            value={redeemAmount}
            onChange={(event) => setRedeemAmount(Number(event.target.value))}
          />
          <p>Discount value: {formatPrice(redeemAmount)}</p>
          <Button onClick={() => setRedeemOpen(false)}>Apply in Checkout</Button>
        </div>
      </Modal>
    </>
  );
}
