import { TESTIMONIALS } from '../../lib/constants';
import { Card } from '../ui/Card';
import { StarRating } from '../products/StarRating';

export function TestimonialsSection() {
  return (
    <section className="section">
      <div className="section-heading">
        <div className="section">
          <span className="eyebrow">Testimonials</span>
          <h2>Customers noticed the difference.</h2>
          <p>Agency-level presentation means the gifting experience feels polished from order to arrival.</p>
        </div>
      </div>
      <div className="product-grid">
        {TESTIMONIALS.map((testimonial) => (
          <Card className="testimonial-card" key={testimonial.id}>
            <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
              <img
                src={testimonial.avatar}
                alt={testimonial.name}
                style={{ width: '3rem', height: '3rem', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div className="section" style={{ gap: '0.15rem' }}>
                <strong>{testimonial.name}</strong>
                <StarRating rating={testimonial.rating} />
              </div>
            </div>
            <p>"{testimonial.quote}"</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
