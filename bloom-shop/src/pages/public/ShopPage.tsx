import { Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageWrapper } from '../../components/layout/PageWrapper';
import {
  ProductFilters,
  ProductFiltersButton,
  type FilterState,
} from '../../components/products/ProductFilters';
import { ProductGrid } from '../../components/products/ProductGrid';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useProductsQuery } from '../../hooks/useAppQueries';
import { getWishlistIds, toggleWishlistId } from '../../lib/data';
import type { Product, ProductCategory } from '../../lib/types';

const defaultFilters: FilterState = {
  categories: [],
  maxPrice: 5000,
  minRating: 0,
  sort: 'popular',
};

export function ShopPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: products = [], isLoading } = useProductsQuery();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 920);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const category = searchParams.get('category') as ProductCategory | null;
    if (category) {
      setFilters((current) => ({
        ...current,
        categories: current.categories.includes(category) ? current.categories : [category],
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    setWishlistIds(getWishlistIds(user?.id ?? 'guest'));
  }, [user?.id]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 920);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        !filters.categories.length || filters.categories.includes(product.category);
      const matchesPrice = product.price <= filters.maxPrice;
      const matchesRating = product.avg_rating >= filters.minRating;
      return matchesSearch && matchesCategory && matchesPrice && matchesRating;
    });

    switch (filters.sort) {
      case 'price-asc':
        return [...filtered].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...filtered].sort((a, b) => b.price - a.price);
      case 'newest':
        return [...filtered].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
      default:
        return [...filtered].sort(
          (a, b) => b.review_count * b.avg_rating - a.review_count * a.avg_rating,
        );
    }
  }, [deferredSearch, filters, products]);

  const handleToggleWishlist = (product: Product) => {
    const next = toggleWishlistId(user?.id ?? 'guest', product.id);
    setWishlistIds(next);
  };

  return (
    <PageWrapper>
      <div className="page-shell">
        <section className="section">
          <div className="section-heading">
            <div className="section">
              <span className="eyebrow">Shop Bouquets</span>
              <h2>Search, refine, and gift with confidence.</h2>
              <p>Instant filtering across curated arrangements, price bands, and rating thresholds.</p>
            </div>
          </div>
          <div className="search-row">
            <Input
              label="Search Bouquets"
              icon={<Search size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search roses, orchids, same-day..."
            />
            {isMobile ? <ProductFiltersButton onClick={() => setShowMobileFilters(true)} /> : null}
          </div>
        </section>

        <section className="filters-layout">
          {!isMobile ? <ProductFilters filters={filters} onChange={setFilters} /> : null}
          <div className="section">
            <div className="summary-row">
              <p>{filteredProducts.length} bouquets matched</p>
              <span className="muted">Instant results update as you type.</span>
            </div>
            <ProductGrid
              products={filteredProducts}
              loading={isLoading}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
            />
          </div>
        </section>
      </div>

      {showMobileFilters ? (
        <ProductFilters
          mobile
          filters={filters}
          onChange={setFilters}
          onClose={() => setShowMobileFilters(false)}
        />
      ) : null}
    </PageWrapper>
  );
}
