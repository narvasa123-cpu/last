import { Printer, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { MOCK_PRODUCTS } from '../../lib/constants';
import type { Product } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

function buildQrDataUrl(orderId: string) {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
        <rect width="160" height="160" rx="24" fill="#fff5f7"/>
        <rect x="20" y="20" width="120" height="120" rx="14" fill="#ffffff"/>
        <path d="M32 32h30v30H32zM98 32h30v30H98zM32 98h30v30H32zM80 80h18v18H80zM104 80h14v14h-14zM80 104h14v14H80zM118 98h10v30h-10zM98 118h14v10H98z" fill="#e91e63"/>
      </svg>`));
}

export function WalkInOrder() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Array<{ product: Product; quantity: number }>>([]);
  const [cashTendered, setCashTendered] = useState('5000');
  const [orderId] = useState(() => crypto.randomUUID().slice(0, 8).toUpperCase());

  const filtered = useMemo(
    () =>
      MOCK_PRODUCTS.filter((product) => {
        const normalized = query.toLowerCase();
        return !normalized || product.name.toLowerCase().includes(normalized);
      }),
    [query],
  );

  const addProduct = (product: Product) => {
    setSelected((current) => {
      const existing = current.find((entry) => entry.product.id === product.id);
      if (existing) {
        return current.map((entry) =>
          entry.product.id === product.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const total = selected.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
  const change = Number(cashTendered || 0) - total;

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
                  <p>Search products, build the cart, collect cash, and print a receipt.</p>
                </div>
              </div>
              <Input
                label="Product Search"
                icon={<Search size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="product-grid">
                {filtered.slice(0, 6).map((product) => (
                  <Card className="product-card" key={product.id}>
                    <img className="product-image" src={product.image_url} alt={product.name} />
                    <h3>{product.name}</h3>
                    <p>{formatPrice(product.price)}</p>
                    <Button onClick={() => addProduct(product)}>Add</Button>
                  </Card>
                ))}
              </div>
            </Card>

            <section className="cart-layout">
              <Card className="summary-card">
                <div className="section" style={{ gap: '0.5rem' }}>
                  <strong>Selected Items</strong>
                  {selected.map((entry) => (
                    <div className="summary-row" key={entry.product.id}>
                      <span>
                        {entry.product.name} x{entry.quantity}
                      </span>
                      <strong>{formatPrice(entry.product.price * entry.quantity)}</strong>
                    </div>
                  ))}
                </div>
                <Input
                  label="Cash Received"
                  value={cashTendered}
                  onChange={(event) => setCashTendered(event.target.value)}
                />
                <div className="summary-row">
                  <span>Total</span>
                  <strong className="price">{formatPrice(total)}</strong>
                </div>
                <div className="summary-row">
                  <span>Change</span>
                  <strong className={change >= 0 ? 'success' : 'rose'}>{formatPrice(change)}</strong>
                </div>
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer size={18} />
                  Print Receipt
                </Button>
              </Card>

              <Card className="receipt-card">
                <div className="receipt-preview">
                  <div className="summary-row">
                    <strong>Bloom Shop</strong>
                    <span>Receipt #{orderId}</span>
                  </div>
                  <p>Flower Delivery and Walk-In Floral Orders</p>
                  {selected.map((entry) => (
                    <div className="summary-row" key={entry.product.id}>
                      <span>
                        {entry.product.name} x{entry.quantity}
                      </span>
                      <span>{formatPrice(entry.product.price * entry.quantity)}</span>
                    </div>
                  ))}
                  <div className="summary-row">
                    <strong>Total</strong>
                    <strong>{formatPrice(total)}</strong>
                  </div>
                  <img src={buildQrDataUrl(orderId)} alt="Order QR code" style={{ width: '7rem', alignSelf: 'center' }} />
                </div>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
