import { Link } from 'react-router-dom';

import { CartItem } from '../../components/cart/CartItem';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useCart } from '../../hooks/useCart';
import { formatPrice } from '../../lib/utils';

export function CartPage() {
  const { items, totals, removeItem, updateQuantity } = useCart();

  return (
    <PageWrapper>
      <div className="page-shell">
        <section className="section">
          <div className="section-heading">
            <div className="section">
              <span className="eyebrow">Your Cart</span>
              <h2>Review your bouquet bundle.</h2>
              <p>Adjust quantities, check delivery savings, and move into checkout when ready.</p>
            </div>
          </div>
        </section>

        <section className="cart-layout">
          <div className="cart-list">
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
                <div className="empty-illustration">🌸</div>
                <h3>Your cart is empty.</h3>
                <p>Add flowers from the shop to build your first Bloom delivery.</p>
                <Link to="/shop">
                  <Button>Browse Bouquets</Button>
                </Link>
              </Card>
            )}
          </div>

          <Card className="summary-card order-summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{formatPrice(totals.subtotal)}</strong>
            </div>
            <div className="summary-row">
              <span>Delivery Fee</span>
              <strong>{totals.deliveryFee ? formatPrice(totals.deliveryFee) : 'Free'}</strong>
            </div>
            <div className="summary-row">
              <span>Discount</span>
              <strong className="rose">-{formatPrice(totals.discount)}</strong>
            </div>
            <div className="summary-row">
              <span>Total</span>
              <strong className="price">{formatPrice(totals.total)}</strong>
            </div>
            <Link to="/customer/checkout">
              <Button fullWidth disabled={!items.length}>
                Continue to Checkout
              </Button>
            </Link>
          </Card>
        </section>
      </div>
    </PageWrapper>
  );
}
