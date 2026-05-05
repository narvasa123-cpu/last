import type { Product } from '../../lib/types';
import { ProductCard } from './ProductCard';
import { Skeleton } from '../ui/Skeleton';
import { Card } from '../ui/Card';
import { Flower2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  wishlistIds?: string[];
  onToggleWishlist?: (product: Product) => void;
}

export function ProductGrid({
  products,
  loading,
  wishlistIds = [],
  onToggleWishlist,
}: ProductGridProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="product-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} style={{ minHeight: '22rem' }} />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <Card className="empty-state">
        <div className="empty-illustration">
          <Flower2 size={34} />
        </div>
        <h3>No bouquets match those filters.</h3>
        <p>Try widening your budget or switching to a different flower family.</p>
        <Button variant="secondary" onClick={() => navigate('/shop')}>
          Reset Shop View
        </Button>
      </Card>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          inWishlist={wishlistIds.includes(product.id)}
          onToggleWishlist={onToggleWishlist}
        />
      ))}
    </div>
  );
}
