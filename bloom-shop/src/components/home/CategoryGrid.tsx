import { useNavigate } from 'react-router-dom';

import { CATEGORY_TILES } from '../../lib/constants';

export function CategoryGrid() {
  const navigate = useNavigate();

  return (
    <section className="section">
      <div className="section-heading">
        <div className="section">
          <span className="eyebrow">Categories</span>
          <h2>Choose the mood, then the bouquet.</h2>
          <p>Browse by flower family to narrow the shop in one tap.</p>
        </div>
      </div>
      <div className="category-grid">
        {CATEGORY_TILES.map((category) => (
          <button
            key={category.id}
            className="category-tile"
            style={{
              backgroundImage: `url(${category.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: 'none',
            }}
            onClick={() => navigate(`/shop?category=${category.id}`)}
          >
            <div className="section" style={{ gap: '0.35rem', textAlign: 'left' }}>
              <strong style={{ fontSize: '1.25rem' }}>
                {category.emoji} {category.name}
              </strong>
              <span>{category.description}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
