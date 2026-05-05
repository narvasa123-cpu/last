import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
}

export function StarRating({ rating, reviewCount }: StarRatingProps) {
  return (
    <div className="rating-row" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        return (
          <span key={index} style={{ position: 'relative', display: 'inline-flex' }}>
            <Star size={16} color="rgba(233,30,99,0.2)" fill="rgba(233,30,99,0.08)" />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                width: `${fill * 100}%`,
                overflow: 'hidden',
              }}
            >
              <Star size={16} color="var(--bloom-rose)" fill="var(--bloom-rose)" />
            </span>
          </span>
        );
      })}
      <span className="muted">
        {rating.toFixed(1)}
        {typeof reviewCount === 'number' ? ` (${reviewCount})` : ''}
      </span>
    </div>
  );
}
