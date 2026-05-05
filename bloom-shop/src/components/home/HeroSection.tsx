import { ArrowDown, ArrowRight, Flower2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Card } from '../ui/Card';

export function HeroSection() {
  return (
    <section className="hero">
      <img
        className="hero-flower"
        src="https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1200&q=80"
        alt=""
      />
      <div className="hero-inner">
        <div className="hero-content">
          <span className="eyebrow">
            <Sparkles size={14} />
            Bloom Shop Signature
          </span>
          <h2 className="hero-title">Where Every Petal Tells a Story</h2>
          <p className="hero-copy">
            Same rose palette, cleaner ordering journey. Discover florist-led bouquets, schedule delivery
            in minutes, and track every stem from studio to doorstep.
          </p>
          <div className="hero-actions">
            <Link className="button-base button-primary" to="/shop">
              Shop Now
              <ArrowRight size={18} />
            </Link>
            <a className="button-base button-ghost" href="#our-story">
              Our Story
            </a>
          </div>
          <div className="summary-row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <span className="badge badge-success">Same-day in Metro Manila</span>
            <span className="badge badge-primary">Free delivery over ₱1,500</span>
            <span className="badge badge-neutral">Trusted by 12k+ gift senders</span>
          </div>
        </div>

        <div className="hero-highlight">
          <Card className="hero-highlight-card">
            <div className="summary-row">
              <div className="timeline-icon">
                <Flower2 size={18} />
              </div>
              <span className="badge badge-primary">Editorial bouquets</span>
            </div>
            <h3>Florist composition, not generic catalog filler.</h3>
            <p>Each arrangement is balanced for shape, texture, and color continuity before dispatch.</p>
          </Card>
          <Card className="hero-highlight-card">
            <div className="summary-row">
              <strong>Order in 3 steps</strong>
              <span className="rose">01</span>
            </div>
            <p>Browse featured stems, schedule the drop-off, and follow rider movement in real time.</p>
          </Card>
          <Card className="hero-highlight-card">
            <div className="summary-row">
              <strong>Loyalty built-in</strong>
              <span className="rose">02</span>
            </div>
            <p>Earn 1 point per ₱100 spent and unlock Silver and Gold tier gifting perks as you return.</p>
          </Card>
        </div>
      </div>

      <a className="scroll-indicator" href="#featured-bouquets">
        <span>Scroll to explore</span>
        <ArrowDown size={18} />
      </a>
    </section>
  );
}
