import { CategoryGrid } from '../../components/home/CategoryGrid';
import { FeaturedCarousel } from '../../components/home/FeaturedCarousel';
import { HeroSection } from '../../components/home/HeroSection';
import { TestimonialsSection } from '../../components/home/TestimonialsSection';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useProductsQuery } from '../../hooks/useAppQueries';
import { WHY_CHOOSE_US } from '../../lib/constants';

export function HomePage() {
  const { data: products = [], isLoading } = useProductsQuery();

  return (
    <PageWrapper>
      <div className="page-shell" style={{ paddingTop: '1rem' }}>
        <HeroSection />

        {isLoading ? (
          <div className="product-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} style={{ minHeight: '24rem' }} />
            ))}
          </div>
        ) : (
          <FeaturedCarousel products={products} />
        )}

        <CategoryGrid />

        <section id="our-story" className="section">
          <div className="section-heading">
            <div className="section">
              <span className="eyebrow">Why Choose Us</span>
              <h2>Elegant flowers, disciplined fulfillment.</h2>
              <p>Every layer of Bloom Shop is tuned for premium gifting without extra friction.</p>
            </div>
          </div>
          <div className="feature-strip">
            {WHY_CHOOSE_US.map((feature) => (
              <Card className="feature-card" key={feature.title}>
                <span style={{ fontSize: '2rem' }}>{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <TestimonialsSection />
      </div>
    </PageWrapper>
  );
}
