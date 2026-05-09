import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Sidebar } from '../../components/layout/Sidebar';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useNotifications } from '../../hooks/useNotifications';
import { getAdminReviewsPage, updateReviewVisibility } from '../../lib/admin';
import type { Review } from '../../lib/types';
import { formatDateTime } from '../../lib/utils';

export function ReviewsPage() {
  const { showToast } = useNotifications();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [visibility, setVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    async function loadReviews() {
      setLoading(true);
      const result = await getAdminReviewsPage({ page, pageSize, search, rating, visibility });
      setReviews(result.data);
      setTotal(result.total);
      setLoading(false);
    }

    void loadReviews();
  }, [page, rating, search, visibility]);

  const toggleVisibility = async (review: Review) => {
    const { data, error } = await updateReviewVisibility(review.id, !review.is_hidden);
    if (error || !data) {
      showToast('Review update failed', error ?? 'Unable to update the review.');
      return;
    }
    setReviews((current) => current.map((entry) => (entry.id === data.id ? data : entry)));
    showToast('Review updated', `Review is now ${data.is_hidden ? 'hidden' : 'visible'}.`);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <div className="dashboard-layout">
          <Sidebar role="admin" />
          <Card className="summary-card">
            <div className="section-heading">
              <div className="section">
                <span className="eyebrow">Reviews</span>
                <h2>Review moderation</h2>
                <p>Filter product reviews, hide problematic entries, and jump to product pages.</p>
              </div>
            </div>
            <div className="search-row">
              <Input
                label="Search comments"
                icon={<Search size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <div className="select-shell">
                <select value={rating} onChange={(event) => { setRating(event.target.value as typeof rating); setPage(1); }}>
                  <option value="all">All stars</option>
                  <option value="5">5 stars</option>
                  <option value="4">4 stars</option>
                  <option value="3">3 stars</option>
                  <option value="2">2 stars</option>
                  <option value="1">1 star</option>
                </select>
              </div>
              <div className="select-shell">
                <select value={visibility} onChange={(event) => { setVisibility(event.target.value as typeof visibility); setPage(1); }}>
                  <option value="all">All visibility</option>
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
            <div className="table-shell">
              <table className="table">
                <thead><tr><th>Review</th><th>Rating</th><th>Product</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6}>Loading reviews...</td></tr>
                  ) : reviews.length ? (
                    reviews.map((review) => (
                      <tr key={review.id}>
                        <td>{review.comment || 'No comment'}</td>
                        <td>{review.rating} / 5</td>
                        <td>
                          {review.product?.id ? <Link to={`/product/${review.product.id}`}>{review.product.name}</Link> : review.product_id}
                        </td>
                        <td><Badge variant={review.is_hidden ? 'neutral' : 'success'}>{review.is_hidden ? 'Hidden' : 'Visible'}</Badge></td>
                        <td>{formatDateTime(review.created_at)}</td>
                        <td><Button size="sm" variant="secondary" onClick={() => toggleVisibility(review)}>{review.is_hidden ? 'Unhide' : 'Hide'}</Button></td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6}>No reviews matched those filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <span>Page {page} of {totalPages} - {total} reviews</span>
              <div className="summary-row">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
