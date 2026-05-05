import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useCart } from '../../hooks/useCart';
import { useNotifications } from '../../hooks/useNotifications';
import type { Product } from '../../lib/types';
import { formatPrice } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StarRating } from '../products/StarRating';

interface FeaturedCarouselProps {
  products: Product[];
}

export function FeaturedCarousel({ products }: FeaturedCarouselProps) {
  const featured = useMemo(() => products.filter((product) => product.is_featured), [products]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useNotifications();

  const scrollToIndex = (index: number) => {
    if (!trackRef.current || !featured.length) return;
    const nextIndex = (index + featured.length) % featured.length;
    const node = trackRef.current.children[nextIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setActiveIndex(nextIndex);
  };

  useEffect(() => {
    if (paused || featured.length <= 1) return;
    const interval = window.setInterval(() => scrollToIndex(activeIndex + 1), 4000);
    return () => window.clearInterval(interval);
  }, [activeIndex, featured.length, paused]);

  if (!featured.length) return null;

  return (
    <section id="featured-bouquets" className="carousel-shell section">
      <div className="carousel-header">
        <div className="section-heading">
          <div className="section">
            <span className="eyebrow">Featured Bouquets</span>
            <h2>Signature wraps with gifting impact.</h2>
            <p>Selected by the florist team for premium composition and strongest review performance.</p>
          </div>
        </div>
        <div className="summary-row">
          <Button variant="secondary" onClick={() => scrollToIndex(activeIndex - 1)} aria-label="Previous bouquet">
            <ArrowLeft size={18} />
          </Button>
          <Button variant="secondary" onClick={() => scrollToIndex(activeIndex + 1)} aria-label="Next bouquet">
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="carousel-track"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {featured.map((product) => (
          <Card className="product-card carousel-item" key={product.id}>
            <div className="product-image-wrap">
              <img className="product-image" src={product.image_url} alt={product.name} />
              <div style={{ position: 'absolute', top: '0.85rem', left: '0.85rem' }}>
                <Badge>{product.category}</Badge>
              </div>
            </div>
            <div className="product-meta">
              <div className="summary-row">
                <h3>{product.name}</h3>
                <span className="price">{formatPrice(product.price)}</span>
              </div>
              <StarRating rating={product.avg_rating} reviewCount={product.review_count} />
              <p className="line-clamp-2">{product.description}</p>
            </div>
            <Button
              onClick={() => {
                addItem(product, 1);
                showToast('Added to cart', `${product.name} is in your cart.`);
              }}
            >
              <ShoppingBag size={18} />
              Add to Cart
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
