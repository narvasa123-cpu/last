import { ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { ProductCard } from '../../components/products/ProductCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useNotifications } from '../../hooks/useNotifications';
import { getProducts, getWishlistIds, toggleWishlistId } from '../../lib/data';
import type { Product } from '../../lib/types';

export function WishlistPage() {
  const { user } = useAuth();
  const { addItem, toggleDrawer } = useCart();
  const { showToast } = useNotifications();
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
  const wishlistUserId = user?.id ?? 'guest';

  const removeFromWishlist = (product: Product) => {
    setWishlistIds(toggleWishlistId(wishlistUserId, product.id));
  };

  const handleMoveToCart = (product: Product) => {
    addItem(product);
    removeFromWishlist(product);
    showToast('Moved to cart', `${product.name} moved from wishlist to cart.`);
    toggleDrawer(true);
  };

  const handleAddAllToCart = () => {
    wishlistProducts.forEach((product) => addItem(product));
    showToast('Wishlist added', `${wishlistProducts.length} saved bouquet(s) added to your cart.`);
    toggleDrawer(true);
  };

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
            {wishlistProducts.length ? (
              <Button onClick={handleAddAllToCart}>
                <ShoppingBag size={18} />
                Add All to Cart
              </Button>
            ) : null}
          </div>
          {loading ? (
            <div className="product-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} style={{ minHeight: '22rem' }} />
              ))}
            </div>
          ) : wishlistProducts.length ? (
            <div className="product-grid">
              {wishlistProducts.map((product) => (
                <div className="section" key={product.id}>
                  <ProductCard
                    product={product}
                    inWishlist={wishlistIds.includes(product.id)}
                    onToggleWishlist={removeFromWishlist}
                  />
                  <Button variant="secondary" onClick={() => handleMoveToCart(product)}>
                    <ShoppingBag size={18} />
                    Move to Cart
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Card className="empty-state">
              <h3>Your wishlist is empty.</h3>
              <p>Save bouquets from the shop and bring them back here when you are ready.</p>
            </Card>
          )}
        </section>
      </div>
    </PageWrapper>
  );
}
