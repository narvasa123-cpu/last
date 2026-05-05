import { Card } from './Card';

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function FullPageSpinner() {
  return (
    <div className="auth-shell">
      <Card className="auth-form center" style={{ maxWidth: '22rem' }}>
        <Spinner />
        <h3>Preparing Bloom Shop</h3>
        <p>Loading your bouquets, account, and delivery state.</p>
      </Card>
    </div>
  );
}
