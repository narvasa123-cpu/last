import { Heart, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useCart } from '../../hooks/useCart';
import { useNotifications } from '../../hooks/useNotifications';
import type { Product } from '../../lib/types';
import { cn, formatPrice } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StarRating } from './StarRating';

interface ProductCardProps {
  product: Product;
  inWishlist?: boolean;
  onToggleWishlist?: (product: Product) => void;
}

export function ProductCard({ product, inWishlist, onToggleWishlist }: ProductCardProps) {
  const { addItem } = useCart();
  const { showToast } = useNotifications();
  const [isBouncing, setIsBouncing] = useState(false);

  const handleAddToCart = () => {
    addItem(product);
    showToast('Added to cart', `${product.name} is in your cart.`);
    setIsBouncing(true);
    window.setTimeout(() => setIsBouncing(false), 320);
  };

  return (
    <Card className="product-card">
      <div className="product-image-wrap">
        <Link to={`/product/${product.id}`}>
          <img className="product-image" src={product.image_url} alt={product.name} />
        </Link>
        <div style={{ position: 'absolute', top: '0.85rem', left: '0.85rem' }}>
          <Badge variant={product.stock <= 12 ? 'success' : 'primary'}>{product.category}</Badge>
        </div>
        <button
          className="icon-button"
          style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}
          onClick={() => onToggleWishlist?.(product)}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart size={18} fill={inWishlist ? 'var(--bloom-rose)' : 'transparent'} color="var(--bloom-rose)" />
        </button>
      </div>

      <div className="product-meta">
        <div className="section" style={{ gap: '0.35rem' }}>
          <Link to={`/product/${product.id}`}>
            <h3>{product.name}</h3>
          </Link>
          <StarRating rating={product.avg_rating} reviewCount={product.review_count} />
        </div>
        <p className="line-clamp-2">{product.description}</p>
        <div className="summary-row">
          <span className="price">{formatPrice(product.price)}</span>
          <span className="muted">{product.stock} stems left</span>
        </div>
      </div>

      <Button
        onClick={handleAddToCart}
        style={{
          transform: isBouncing ? 'scale(1.03)' : undefined,
        }}
      >
        <ShoppingBag size={18} />
        Add to Cart
      </Button>
    </Card>
  );
}
