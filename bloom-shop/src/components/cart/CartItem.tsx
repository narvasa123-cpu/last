import { Minus, Plus, Trash2 } from 'lucide-react';

import type { CartLine } from '../../lib/types';
import { formatPrice } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface CartItemProps {
  line: CartLine;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}

export function CartItem({ line, onDecrease, onIncrease, onRemove }: CartItemProps) {
  return (
    <Card className="cart-item">
      <img
        src={line.product.image_url}
        alt={line.product.name}
        style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '1rem' }}
      />
      <div className="section" style={{ justifyContent: 'space-between' }}>
        <div className="section" style={{ gap: '0.4rem' }}>
          <div className="summary-row">
            <div>
              <h3>{line.product.name}</h3>
              <p>{line.product.category}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${line.product.name}`}>
              <Trash2 size={16} />
            </Button>
          </div>
          <p className="line-clamp-2">{line.product.description}</p>
        </div>
        <div className="summary-row">
          <div className="quantity-stepper">
            <button onClick={onDecrease} aria-label="Decrease quantity">
              <Minus size={16} />
            </button>
            <strong>{line.quantity}</strong>
            <button onClick={onIncrease} aria-label="Increase quantity">
              <Plus size={16} />
            </button>
          </div>
          <strong className="price">{formatPrice(line.product.price * line.quantity)}</strong>
        </div>
      </div>
    </Card>
  );
}
