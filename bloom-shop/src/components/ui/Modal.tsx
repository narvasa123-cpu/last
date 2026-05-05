import { X } from 'lucide-react';
import { useEffect, type PropsWithChildren } from 'react';

import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Card } from './Card';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  className,
  children,
}: PropsWithChildren<ModalProps>) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <Card
        className={cn('modal-panel', className)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="summary-row">
          <div className="section">
            <h3 id="modal-title">{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
}
