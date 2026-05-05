import { ShoppingBag, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useCart } from '../../hooks/useCart';
import { formatPrice } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CartItem } from './CartItem';

export function CartDrawer() {
  const { isOpen, items, totals, toggleDrawer, removeItem, updateQuantity } = useCart();

  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={() => toggleDrawer(false)} role="presentation" />
      <aside className="cart-drawer" aria-label="Shopping cart">
        <div className="summary-row">
          <div>
            <strong>Your Cart</strong>
            <p>{items.length ? `${totals.count} bouquet items ready to schedule.` : 'No flowers added yet.'}</p>
          </div>
          <button className="icon-button" onClick={() => toggleDrawer(false)} aria-label="Close cart">
            <X size={18} />
          </button>
        </div>

        <div className="cart-list" style={{ flex: 1, overflowY: 'auto' }}>
          {items.length ? (
            items.map((line) => (
              <CartItem
                key={line.product.id}
                line={line}
                onDecrease={() => updateQuantity(line.product.id, line.quantity - 1)}
                onIncrease={() => updateQuantity(line.product.id, line.quantity + 1)}
                onRemove={() => removeItem(line.product.id)}
              />
            ))
          ) : (
            <Card className="empty-state">
              <div className="empty-illustration">
                <ShoppingBag size={34} />
              </div>
              <h3>Your cart is still blooming.</h3>
              <p>Add a bouquet to start building your delivery.</p>
              <Button variant="secondary" onClick={() => toggleDrawer(false)}>
                Keep Shopping
              </Button>
            </Card>
          )}
        </div>

        <Card className="summary-card">
          <div className="summary-row">
            <span>Subtotal</span>
            <strong>{formatPrice(totals.subtotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Delivery</span>
            <strong>{totals.deliveryFee ? formatPrice(totals.deliveryFee) : 'Free'}</strong>
          </div>
          <div className="summary-row">
            <span>Discounts</span>
            <strong className="rose">-{formatPrice(totals.discount)}</strong>
          </div>
          <div className="summary-row">
            <span>Total</span>
            <strong className="price">{formatPrice(totals.total)}</strong>
          </div>
          <div className="action-row">
            <Link to="/customer/cart" onClick={() => toggleDrawer(false)}>
              <Button variant="secondary" fullWidth>
                View Cart
              </Button>
            </Link>
            <Link to="/customer/checkout" onClick={() => toggleDrawer(false)}>
              <Button fullWidth>Checkout</Button>
            </Link>
          </div>
        </Card>
      </aside>
    </>
  );
}
