import { useEffect, useState } from 'react';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { ProductGrid } from '../../components/products/ProductGrid';
import { useAuth } from '../../hooks/useAuth';
import { getProducts, getWishlistIds, toggleWishlistId } from '../../lib/data';
import type { Product } from '../../lib/types';

export function WishlistPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProducts()]).then(([productData]) => {
      setProducts(productData);
      setWishlistIds(getWishlistIds(user?.id ?? 'guest'));
      setLoading(false);
    });
  }, [user?.id]);

  const wishlistProducts = products.filter((product) => wishlistIds.includes(product.id));

  return (
    <PageWrapper>
      <div className="page-shell">
        <section className="section">
          <div className="section-heading">
            <div className="section">
              <span className="eyebrow">Wishlist</span>
              <h2>Saved bouquet ideas.</h2>
              <p>Keep favorite arrangements close while you compare styles and occasions.</p>
            </div>
          </div>
          <ProductGrid
            products={wishlistProducts}
            loading={loading}
            wishlistIds={wishlistIds}
            onToggleWishlist={(product) => setWishlistIds(toggleWishlistId(user?.id ?? 'guest', product.id))}
          />
        </section>
      </div>
    </PageWrapper>
  );
}
