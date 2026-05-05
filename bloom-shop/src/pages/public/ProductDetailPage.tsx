import { useQueryClient } from '@tanstack/react-query';
import { Heart, Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { ProductGrid } from '../../components/products/ProductGrid';
import { StarRating } from '../../components/products/StarRating';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import {
  useProductQuery,
  useProductReviewsQuery,
  useRecommendedProductsQuery,
} from '../../hooks/useAppQueries';
import { useCart } from '../../hooks/useCart';
import { useNotifications } from '../../hooks/useNotifications';
import {
  createReview,
  getWishlistIds,
  toggleWishlistId,
} from '../../lib/data';
import { queryKeys } from '../../lib/queryClient';
import type { Product, Review } from '../../lib/types';
import { formatPrice } from '../../lib/utils';

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addItem } = useCart();
  const { showToast } = useNotifications();
  const { user, profile } = useAuth();
  const productQuery = useProductQuery(id);
  const reviewsQuery = useProductReviewsQuery(id);
  const relatedQuery = useRecommendedProductsQuery(id ? [id] : []);
  const product = productQuery.data ?? null;
  const reviews = reviewsQuery.data ?? [];
  const related = relatedQuery.data.slice(0, 3);
  const loading = productQuery.isLoading || reviewsQuery.isLoading || relatedQuery.isLoading;
  const [quantity, setQuantity] = useState(1);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    setWishlistIds(getWishlistIds(user?.id ?? 'guest'));
  }, [user?.id]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return product?.avg_rating ?? 0;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [product?.avg_rating, reviews]);

  const inWishlist = wishlistIds.includes(product?.id ?? '');

  const handleSubmitReview = async () => {
    if (!user || !profile || !product) {
      navigate('/login');
      return;
    }
    if (!comment.trim()) {
      setReviewError('Please add a short review comment.');
      return;
    }

    const result = await createReview({
      product_id: product.id,
      user_id: user.id,
      rating,
      comment,
      user: { full_name: profile.full_name, avatar_url: profile.avatar_url },
    });

    if (result.data) {
      queryClient.setQueryData<Review[]>(
        queryKeys.productReviews(product.id),
        (current = []) => [
          { ...result.data, user: { full_name: profile.full_name, avatar_url: profile.avatar_url } },
          ...current,
        ],
      );
      setComment('');
      setRating(5);
      setReviewError('');
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="page-shell">
          <Skeleton style={{ minHeight: '32rem' }} />
        </div>
      </PageWrapper>
    );
  }

  if (!product) {
    return (
      <PageWrapper>
        <div className="page-shell">
          <Card className="empty-state">
            <h3>Product not found</h3>
            <p>This bouquet may have sold out or been removed from the collection.</p>
            <Link to="/shop">
              <Button>Back to Shop</Button>
            </Link>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/shop">Shop</Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        <section className="product-detail">
          <Card className="summary-card" style={{ padding: '1rem' }}>
            <img
              src={product.image_url}
              alt={product.name}
              style={{ width: '100%', borderRadius: '1rem', boxShadow: 'var(--shadow-soft)' }}
            />
          </Card>

          <Card className="summary-card">
            <div className="section">
              <span className="eyebrow">{product.category}</span>
              <h2 style={{ fontSize: 'clamp(2rem, 5vw, 2.3rem)' }}>{product.name}</h2>
              <StarRating rating={averageRating} reviewCount={reviews.length || product.review_count} />
              <strong className="price" style={{ fontSize: '1.75rem' }}>
                {formatPrice(product.price)}
              </strong>
              <p>{product.description}</p>
            </div>

            <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
              <div className="quantity-stepper">
                <button onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                  <Minus size={16} />
                </button>
                <strong>{quantity}</strong>
                <button onClick={() => setQuantity((current) => current + 1)}>
                  <Plus size={16} />
                </button>
              </div>
              <span className="muted">{product.stock} available</span>
            </div>

            <div className="action-row action-row-dual">
              <Button
                onClick={() => {
                  addItem(product, quantity);
                  showToast(
                    'Added to cart',
                    `${product.name}${quantity > 1 ? ` x${quantity}` : ''} is in your cart.`,
                  );
                }}
              >
                <ShoppingBag size={18} />
                Add to Cart
              </Button>
              <Button
                variant="secondary"
                onClick={() => setWishlistIds(toggleWishlistId(user?.id ?? 'guest', product.id))}
              >
                <Heart size={18} fill={inWishlist ? 'var(--bloom-rose)' : 'transparent'} />
                Wishlist
              </Button>
            </div>
          </Card>
        </section>

        <section className="section">
          <div className="section-heading">
            <div className="section">
              <span className="eyebrow">Pair It With</span>
              <h2>You Might Also Love</h2>
            </div>
          </div>
          <ProductGrid
            products={related}
            wishlistIds={wishlistIds}
            onToggleWishlist={(entry) => setWishlistIds(toggleWishlistId(user?.id ?? 'guest', entry.id))}
          />
        </section>

        <section className="section">
          <div className="section-heading">
            <div className="section">
              <span className="eyebrow">Reviews</span>
              <h2>What customers said</h2>
              <p>{averageRating.toFixed(1)} average from {reviews.length || product.review_count} reviews.</p>
            </div>
          </div>

          <div className="layout-grid product-reviews-grid">
            <div className="review-list">
              {reviews.map((review) => (
                <Card className="review-card" key={review.id}>
                  <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
                    <img
                      src={review.user?.avatar_url}
                      alt={review.user?.full_name}
                      style={{ width: '3rem', height: '3rem', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div className="section" style={{ gap: '0.15rem' }}>
                      <strong>{review.user?.full_name ?? 'Bloom Customer'}</strong>
                      <StarRating rating={review.rating} />
                    </div>
                  </div>
                  <p>{review.comment}</p>
                </Card>
              ))}
            </div>

            <Card className="summary-card">
              <div className="section" style={{ gap: '0.4rem' }}>
                <strong>Write a Review</strong>
                <p>Share how the arrangement looked and how delivery went.</p>
              </div>
              <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
                {Array.from({ length: 5 }, (_, index) => (
                  <button
                    key={index}
                    className="icon-button"
                    onClick={() => setRating(index + 1)}
                    aria-label={`Rate ${index + 1} stars`}
                  >
                    <Star
                      size={18}
                      fill={index < rating ? 'var(--bloom-rose)' : 'transparent'}
                      color="var(--bloom-rose)"
                    />
                  </button>
                ))}
              </div>
              <Textarea
                label="Your Review"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                error={reviewError}
              />
              <Button onClick={handleSubmitReview}>Submit Review</Button>
            </Card>
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
