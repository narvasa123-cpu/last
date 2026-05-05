import { Bell, X } from 'lucide-react';

import { useNotifications } from '../../hooks/useNotifications';
import { Button } from './Button';
import { Card } from './Card';

export function ToastViewport() {
  const { toasts, dismissToast } = useNotifications();

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <Card className="toast" key={toast.id}>
          <div className="info-row" style={{ alignItems: 'flex-start' }}>
            <div className="timeline-icon" style={{ width: '2.3rem', height: '2.3rem' }}>
              <Bell size={16} />
            </div>
            <div className="section" style={{ gap: '0.25rem' }}>
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
            <X size={16} />
          </Button>
        </Card>
      ))}
    </div>
  );
}
