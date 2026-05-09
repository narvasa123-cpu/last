import { ArrowRight, CalendarDays, MapPin, PackageCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { STATUS_LABELS } from '../../lib/constants';
import type { Order } from '../../lib/types';
import { formatDate, formatPrice } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface OrderCardProps {
  order: Order;
}

export function OrderCard({ order }: OrderCardProps) {
  const itemCount = order.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <Card className="order-card">
      <div className="summary-row">
        <div className="section" style={{ gap: '0.25rem' }}>
          <strong>Order #{order.id.slice(0, 8)}</strong>
          <p>{STATUS_LABELS[order.status]}</p>
        </div>
        <Badge variant={order.status === 'delivered' ? 'success' : 'primary'}>{order.status}</Badge>
      </div>
      <div className="search-row">
        <div className="info-row" style={{ justifyContent: 'flex-start' }}>
          <CalendarDays size={16} color="var(--bloom-rose)" />
          <span>{formatDate(order.delivery_date)}</span>
        </div>
        <div className="info-row" style={{ justifyContent: 'flex-start' }}>
          <MapPin size={16} color="var(--bloom-rose)" />
          <span>{order.delivery_address}</span>
        </div>
      </div>
      <div className="summary-row">
        <div className="info-row" style={{ justifyContent: 'flex-start' }}>
          <PackageCheck size={16} color="var(--bloom-rose)" />
          <span>{itemCount} item(s)</span>
        </div>
        <strong className="price">{formatPrice(order.total_amount)}</strong>
      </div>
      {order.delivery_photos?.[0] ? (
        <div className="section" style={{ gap: '0.35rem' }}>
          <strong>Proof of delivery</strong>
          <img
            src={order.delivery_photos[0].image_url}
            alt={`Delivered bouquet for order ${order.id.slice(0, 8)}`}
            style={{ borderRadius: '0.5rem', maxHeight: '14rem', objectFit: 'cover', width: '100%' }}
          />
        </div>
      ) : null}
      <Link to={`/customer/orders/${order.id}`}>
        <Button variant="secondary">
          View Details
          <ArrowRight size={18} />
        </Button>
      </Link>
    </Card>
  );
}
