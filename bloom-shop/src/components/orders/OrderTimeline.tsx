import { CheckCircle2, Circle, Package, Truck, MapPin } from 'lucide-react';

import { ORDER_FLOW, STATUS_LABELS } from '../../lib/constants';
import type { OrderStatus } from '../../lib/types';
import { cn, formatDateTime } from '../../lib/utils';
import { Card } from '../ui/Card';

interface TimelinePoint {
  status: OrderStatus;
  timestamp?: string;
}

interface OrderTimelineProps {
  currentStatus: OrderStatus;
  timeline?: TimelinePoint[];
}

const iconMap = {
  pending: Circle,
  confirmed: CheckCircle2,
  preparing: Package,
  picked_up: Truck,
  on_the_way: MapPin,
  delivered: CheckCircle2,
  cancelled: Circle,
};

export function OrderTimeline({ currentStatus, timeline = [] }: OrderTimelineProps) {
  const currentIndex = ORDER_FLOW.indexOf(currentStatus);

  return (
    <Card className="timeline-card">
      <div className="section" style={{ gap: '0.35rem' }}>
        <strong>Order Status Timeline</strong>
        <p>Follow each handoff from confirmation to doorstep delivery.</p>
      </div>

      <div className="timeline">
        {ORDER_FLOW.map((status, index) => {
          const Icon = iconMap[status];
          const point = timeline.find((entry) => entry.status === status);
          return (
            <div
              className={cn(
                'timeline-step glass-card',
                index < currentIndex && 'complete',
                index === currentIndex && 'active',
              )}
              key={status}
            >
              <div className="timeline-icon">
                <Icon size={16} />
              </div>
              <div className="section" style={{ gap: '0.2rem' }}>
                <strong>{STATUS_LABELS[status]}</strong>
                <p>{point?.timestamp ? formatDateTime(point.timestamp) : 'Awaiting update'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
