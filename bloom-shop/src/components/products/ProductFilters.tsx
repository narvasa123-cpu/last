import { SlidersHorizontal } from 'lucide-react';

import { CATEGORY_META } from '../../lib/constants';
import type { ProductCategory } from '../../lib/types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface FilterState {
  categories: ProductCategory[];
  maxPrice: number;
  minRating: number;
  sort: 'price-asc' | 'price-desc' | 'popular' | 'newest';
}

interface ProductFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  mobile?: boolean;
  onClose?: () => void;
}

export function ProductFilters({ filters, onChange, mobile, onClose }: ProductFiltersProps) {
  const panel = (
    <Card className="filters-panel">
      <div className="summary-row">
        <div className="section" style={{ gap: '0.25rem' }}>
          <strong>Filter bouquets</strong>
          <p>Refine by flower, budget, rating, or sort order.</p>
        </div>
        {mobile ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>

      <div className="filter-group">
        <strong>Categories</strong>
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const category = key as ProductCategory;
          const checked = filters.categories.includes(category);
          return (
            <label className="checkbox-option" key={category}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange({
                    ...filters,
                    categories: checked
                      ? filters.categories.filter((item) => item !== category)
                      : [...filters.categories, category],
                  })
                }
              />
              <span>
                {meta.emoji} {meta.label}
              </span>
            </label>
          );
        })}
      </div>

      <div className="filter-group">
        <strong>Price Range</strong>
        <input
          type="range"
          min={0}
          max={5000}
          step={100}
          value={filters.maxPrice}
          onChange={(event) => onChange({ ...filters, maxPrice: Number(event.target.value) })}
        />
        <p>Up to ₱{filters.maxPrice.toLocaleString('en-PH')}</p>
      </div>

      <div className="filter-group">
        <strong>Minimum Rating</strong>
        {[0, 4, 4.5].map((rating) => (
          <label className="radio-option" key={rating}>
            <input
              type="radio"
              name="min-rating"
              checked={filters.minRating === rating}
              onChange={() => onChange({ ...filters, minRating: rating })}
            />
            <span>{rating === 0 ? 'All ratings' : `${rating}★ and up`}</span>
          </label>
        ))}
      </div>

      <div className="filter-group">
        <strong>Sort</strong>
        <div className="select-shell">
          <select
            value={filters.sort}
            onChange={(event) =>
              onChange({
                ...filters,
                sort: event.target.value as FilterState['sort'],
              })
            }
          >
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="popular">Popularity</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <Button
        variant="secondary"
        onClick={() =>
          onChange({
            categories: [],
            maxPrice: 5000,
            minRating: 0,
            sort: 'popular',
          })
        }
      >
        Reset Filters
      </Button>
    </Card>
  );

  if (mobile) {
    return (
      <>
        <div className="sheet-overlay" onClick={onClose} role="presentation" />
        <div className="sheet">
          <div className="sheet-panel">{panel}</div>
        </div>
      </>
    );
  }

  return panel;
}

export function ProductFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      <SlidersHorizontal size={18} />
      Filters
    </Button>
  );
}
