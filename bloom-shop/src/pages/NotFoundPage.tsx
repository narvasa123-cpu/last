import { Flower2, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <Card className="not-found-card">
        <div className="empty-illustration">
          <Flower2 size={36} />
        </div>
        <span className="eyebrow">404</span>
        <h2>This bouquet path does not exist.</h2>
        <p>The page may have wilted, moved, or never bloomed in the first place.</p>
        <Link to="/">
          <Button>
            <Home size={18} />
            Back to Bloom Shop
          </Button>
        </Link>
      </Card>
    </div>
  );
}
