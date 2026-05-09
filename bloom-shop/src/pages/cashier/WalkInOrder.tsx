import { Minus, Plus, Printer, Search, ShoppingBag, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useCashierTodayOrdersQuery, useProductsQuery } from '../../hooks/useAppQueries';
import { useNotifications } from '../../hooks/useNotifications';
import { getAdminCoupons } from '../../lib/admin';
import { createWalkInOrder } from '../../lib/orders';
import type { CartLine, Coupon, Order, Product } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

type ManualDiscountType = 'percent' | 'fixed';

function getDiscountFromCoupon(coupon: Coupon, subtotal: number) {
  if (coupon.discount_type === 'percent') {
    return Math.min(subtotal, subtotal * (coupon.discount_value / 100));
  }

  return Math.min(subtotal, coupon.discount_value);
}

function validateCoupon(coupon: Coupon, subtotal: number) {
  if (!coupon.is_active) return `${coupon.code} is inactive.`;
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) return `${coupon.code} has reached its usage limit.`;
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) return `${coupon.code} has expired.`;
  if (subtotal < coupon.min_order) return `${coupon.code} requires a minimum order of ${formatPrice(coupon.min_order)}.`;
  return null;
}

export function WalkInOrder() {
  const { user, profile } = useAuth();
  const { showToast } = useNotifications();
  const productsQuery = useProductsQuery();
  const todayOrdersQuery = useCashierTodayOrdersQuery(user?.id);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CartLine[]>([]);
  const [cashTendered, setCashTendered] = useState('5000');
  const [couponCode, setCouponCode] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [manualDiscountType, setManualDiscountType] = useState<ManualDiscountType>('percent');
  const [manualDiscountValue, setManualDiscountValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const products = productsQuery.data ?? [];
  const todayOrders = todayOrdersQuery.data ?? [];

  useEffect(() => {
    getAdminCoupons().then((coupons) => setAvailableCoupons(coupons.filter((coupon) => coupon.is_active)));
  }, []);

  useEffect(() => {
    const orderId = lastOrder?.id ?? 'draft';
    const trackingUrl = `${window.location.origin}/customer/track-order/${orderId}`;

    QRCode.toDataURL(trackingUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: '#e91e63',
        light: '#ffffff',
      },
    }).then(setQrDataUrl);
  }, [lastOrder?.id]);

  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const normalized = query.toLowerCase();
        return !normalized || product.name.toLowerCase().includes(normalized);
      }),
    [products, query],
  );

  const subtotal = selected.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
  const couponDiscount = appliedCoupon ? getDiscountFromCoupon(appliedCoupon, subtotal) : 0;
  const manualDiscountRaw = Number(manualDiscountValue || 0);
  const manualDiscount =
    manualDiscountType === 'percent'
      ? Math.min(subtotal - couponDiscount, (subtotal - couponDiscount) * (manualDiscountRaw / 100))
      : Math.min(subtotal - couponDiscount, manualDiscountRaw);
  const discount = Math.max(0, couponDiscount + manualDiscount);
  const total = Math.max(0, subtotal - discount);
  const change = Number(cashTendered || 0) - total;
  const cashierName = profile?.full_name ?? 'Cashier';
  const receiptOrderId = lastOrder?.id ?? 'Draft';
  const receiptTime = lastOrder?.created_at ? new Date(lastOrder.created_at) : new Date();
  const receiptItems: CartLine[] = selected.length
    ? selected
    : (lastOrder?.items ?? [])
        .filter((item) => item.product)
        .map((item) => ({
          product: item.product!,
          quantity: item.quantity,
        }));

  const addProduct = (product: Product) => {
    setSelected((current) => {
      const existing = current.find((entry) => entry.product.id === product.id);
      if (existing) {
        return current.map((entry) =>
          entry.product.id === product.id
            ? { ...entry, quantity: Math.min(product.stock, entry.quantity + 1) }
            : entry,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setSelected((current) =>
      current
        .map((entry) =>
          entry.product.id === productId
            ? { ...entry, quantity: Math.min(entry.product.stock, Math.max(0, entry.quantity + delta)) }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  };

  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    const coupon = availableCoupons.find((entry) => entry.code === code);

    if (!coupon) {
      setAppliedCoupon(null);
      showToast('Coupon not found', 'Use an active coupon from the coupons table.');
      return;
    }

    const validation = validateCoupon(coupon, subtotal);
    if (validation) {
      setAppliedCoupon(null);
      showToast('Coupon unavailable', validation);
      return;
    }

    setAppliedCoupon(coupon);
    showToast('Coupon applied', `${coupon.code} discounted this walk-in order.`);
  };

  const completeSale = async () => {
    if (!profile || !user?.id) return;
    if (!selected.length) {
      showToast('Cart is empty', 'Add products before completing the sale.');
      return;
    }
    if (change < 0) {
      showToast('Cash is short', 'Cash received must cover the total.');
      return;
    }

    setSaving(true);
    const { data, error } = await createWalkInOrder({
      cashier: profile,
      items: selected,
      subtotal,
      discountAmount: discount,
      totalAmount: total,
      couponId: appliedCoupon?.id ?? null,
      notes: appliedCoupon
        ? `Walk-in coupon ${appliedCoupon.code}`
        : manualDiscount
          ? `Walk-in manual ${manualDiscountType} discount`
          : undefined,
    });

    setSaving(false);

    if (error || !data) {
      showToast('Sale was not saved', error ?? 'Unable to complete this sale.');
      return;
    }

    setLastOrder(data);
    setSelected([]);
    setAppliedCoupon(null);
    setCouponCode('');
    setManualDiscountValue('');
    setCashTendered('5000');
    await Promise.all([productsQuery.refetch(), todayOrdersQuery.refetch()]);
    showToast('Sale complete', `Walk-in order #${data.id.slice(0, 8)} was saved and stock was deducted.`);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="cashier" />
          <div className="section">
            <Card className="summary-card">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Walk-In Order</span>
                  <h2>Counter checkout</h2>
                  <p>Search products, build the cart, collect cash, save the sale, and print the receipt.</p>
                </div>
              </div>
              <Input
                label="Product Search"
                icon={<Search size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="product-grid">
                {productsQuery.isLoading ? (
                  <Card className="product-card">Loading products...</Card>
                ) : (
                  filtered.slice(0, 6).map((product) => (
                    <Card className="product-card" key={product.id}>
                      <img className="product-image" src={product.image_url} alt={product.name} />
                      <h3>{product.name}</h3>
                      <p>{formatPrice(product.price)}</p>
                      <Badge variant={product.stock > 0 ? 'success' : 'neutral'}>{product.stock} in stock</Badge>
                      <Button onClick={() => addProduct(product)} disabled={product.stock <= 0}>
                        Add
                      </Button>
                    </Card>
                  ))
                )}
              </div>
            </Card>

            <section className="cart-layout">
              <Card className="summary-card">
                <div className="section" style={{ gap: '0.5rem' }}>
                  <strong>Selected Items</strong>
                  {selected.length ? (
                    selected.map((entry) => (
                      <div className="summary-row" key={entry.product.id}>
                        <span>{entry.product.name}</span>
                        <div className="action-row" style={{ gridTemplateColumns: 'auto auto auto auto', alignItems: 'center' }}>
                          <Button size="sm" variant="ghost" onClick={() => updateQuantity(entry.product.id, -1)}>
                            <Minus size={16} />
                          </Button>
                          <strong>{entry.quantity}</strong>
                          <Button size="sm" variant="ghost" onClick={() => updateQuantity(entry.product.id, 1)}>
                            <Plus size={16} />
                          </Button>
                          <strong>{formatPrice(entry.product.price * entry.quantity)}</strong>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No items added yet.</p>
                  )}
                </div>

                <div className="action-row action-row-dual">
                  <Input
                    label="Coupon Code"
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  />
                  <Button variant="secondary" onClick={applyCoupon} disabled={!subtotal}>
                    Apply Coupon
                  </Button>
                </div>
                {appliedCoupon ? (
                  <div className="summary-row">
                    <span>Coupon</span>
                    <Badge variant="success">{appliedCoupon.code}</Badge>
                  </div>
                ) : null}

                <div className="action-row action-row-dual">
                  <div className="field-stack">
                    <label htmlFor="manual-discount-type">Manual Discount</label>
                    <div className="select-shell">
                      <select
                        id="manual-discount-type"
                        value={manualDiscountType}
                        onChange={(event) => setManualDiscountType(event.target.value as ManualDiscountType)}
                      >
                        <option value="percent">Percent</option>
                        <option value="fixed">Fixed amount</option>
                      </select>
                    </div>
                  </div>
                  <Input
                    label={manualDiscountType === 'percent' ? 'Discount %' : 'Discount Amount'}
                    type="number"
                    min="0"
                    value={manualDiscountValue}
                    onChange={(event) => setManualDiscountValue(event.target.value)}
                  />
                </div>

                <Input
                  label="Cash Received"
                  type="number"
                  min="0"
                  value={cashTendered}
                  onChange={(event) => setCashTendered(event.target.value)}
                />
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>
                <div className="summary-row">
                  <span>Discounts</span>
                  <strong className="success">-{formatPrice(discount)}</strong>
                </div>
                <div className="summary-row">
                  <span>Total</span>
                  <strong className="price">{formatPrice(total)}</strong>
                </div>
                <div className="summary-row">
                  <span>Change</span>
                  <strong className={change >= 0 ? 'success' : 'rose'}>{formatPrice(change)}</strong>
                </div>
                <div className="action-row action-row-dual">
                  <Button onClick={completeSale} disabled={saving || !selected.length}>
                    <ShoppingBag size={18} />
                    {saving ? 'Saving...' : 'Complete Sale'}
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()}>
                    <Printer size={18} />
                    Print Receipt
                  </Button>
                </div>
              </Card>

              <Card className="receipt-card">
                <div className="receipt-preview">
                  <div className="receipt-brand">
                    <strong>Bloom Shop</strong>
                    <span>Flower Delivery and Walk-In Floral Orders</span>
                    <span>Receipt #{receiptOrderId.slice(0, 8)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Date/Time</span>
                    <strong>{receiptTime.toLocaleString()}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Cashier</span>
                    <strong>{cashierName}</strong>
                  </div>
                  {receiptItems.map((entry) => (
                    <div className="summary-row" key={entry.product.id}>
                      <span>
                        {entry.product.name} x{entry.quantity}
                      </span>
                      <span>{formatPrice(entry.product.price * entry.quantity)}</span>
                    </div>
                  ))}
                  <div className="summary-row">
                    <span>Discounts</span>
                    <strong>-{formatPrice(discount || lastOrder?.discount_amount || 0)}</strong>
                  </div>
                  <div className="summary-row">
                    <strong>Total Paid</strong>
                    <strong>{formatPrice(selected.length ? total : lastOrder?.total_amount ?? 0)}</strong>
                  </div>
                  {qrDataUrl ? <img src={qrDataUrl} alt="Order QR code" className="receipt-qr" /> : null}
                </div>
              </Card>
            </section>

            <Card className="summary-card">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Today</span>
                  <h2>Walk-in sales history</h2>
                </div>
                <strong className="price">
                  {formatPrice(
                    todayOrders
                      .filter((order) => order.is_walk_in)
                      .reduce((sum, order) => sum + order.total_amount, 0),
                  )}
                </strong>
              </div>
              <div className="history-list">
                {todayOrdersQuery.isLoading ? (
                  <Card className="delivery-card">Loading today&apos;s sales...</Card>
                ) : todayOrders.filter((order) => order.is_walk_in).length ? (
                  todayOrders
                    .filter((order) => order.is_walk_in)
                    .map((order) => (
                      <Card className="delivery-card" key={order.id}>
                        <div className="summary-row">
                          <div>
                            <strong>#{order.id.slice(0, 8)}</strong>
                            <p>{new Date(order.created_at).toLocaleTimeString()}</p>
                          </div>
                          <strong>{formatPrice(order.total_amount)}</strong>
                        </div>
                      </Card>
                    ))
                ) : (
                  <Card className="delivery-card">No walk-in sales completed today.</Card>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
