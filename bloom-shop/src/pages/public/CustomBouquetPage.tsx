import {
  Bot,
  Gift,
  Minus,
  Palette,
  Plus,
  RefreshCw,
  Save,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useCart } from '../../hooks/useCart';
import { useNotifications } from '../../hooks/useNotifications';
import type { CustomBouquetConfig, CustomBouquetFlower, Product } from '../../lib/types';
import { createEmptyFlowerSvg, formatPrice } from '../../lib/utils';

type FlowerOption = Omit<CustomBouquetFlower, 'quantity'> & {
  mood: string;
};

const savedDesignsKey = 'bloom-shop-custom-bouquets';

const flowerOptions: FlowerOption[] = [
  {
    id: 'garden-rose',
    name: 'Garden Rose',
    price: 165,
    color: '#df5a7d',
    mood: 'romantic',
    image_url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'white-tulip',
    name: 'White Tulip',
    price: 120,
    color: '#f4eee5',
    mood: 'minimal',
    image_url: 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    price: 145,
    color: '#f8c643',
    mood: 'bright',
    image_url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'pink-peony',
    name: 'Pink Peony',
    price: 210,
    color: '#f5a3bf',
    mood: 'premium',
    image_url: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'orchid-spray',
    name: 'Orchid Spray',
    price: 235,
    color: '#c9a6dd',
    mood: 'elegant',
    image_url: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'eucalyptus',
    name: 'Eucalyptus',
    price: 85,
    color: '#91a983',
    mood: 'texture',
    image_url: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=900&q=80',
  },
];

const sizeOptions = [
  { id: 'small', label: 'Small', detail: 'Intimate hand-tied style', multiplier: 1 },
  { id: 'medium', label: 'Medium', detail: 'Balanced signature bouquet', multiplier: 1.35 },
  { id: 'large', label: 'Large', detail: 'Full luxury presentation', multiplier: 1.75 },
];

const wrapperOptions = [
  { id: 'kraft', label: 'Kraft', detail: 'Warm artisan paper', color: '#d7b48a' },
  { id: 'pastel', label: 'Pastel', detail: 'Soft blush wrap', color: '#f7c7d9' },
  { id: 'elegant', label: 'Elegant', detail: 'Ivory premium wrap', color: '#f5efe4' },
];

const ribbonOptions = [
  { id: 'rose', label: 'Rose', color: '#e91e63' },
  { id: 'sage', label: 'Sage', color: '#6f9b7a' },
  { id: 'champagne', label: 'Champagne', color: '#d8b36a' },
  { id: 'midnight', label: 'Midnight', color: '#3d1c2e' },
];

const addOnOptions = [
  { id: 'chocolate', label: 'Artisan Chocolate', price: 280 },
  { id: 'teddy', label: 'Keepsake Teddy Bear', price: 420 },
  { id: 'card', label: 'Greeting Card', price: 95 },
];

const presets = [
  {
    id: 'birthday',
    label: 'Birthday',
    description: 'Bright, cheerful, and full of color.',
    flowers: { sunflower: 3, 'pink-peony': 2, eucalyptus: 2 },
    size: 'medium',
    wrapper: 'pastel',
    ribbon: 'champagne',
    addOns: ['card'],
  },
  {
    id: 'anniversary',
    label: 'Anniversary',
    description: 'Romantic roses with a polished finish.',
    flowers: { 'garden-rose': 6, 'orchid-spray': 2, eucalyptus: 2 },
    size: 'large',
    wrapper: 'elegant',
    ribbon: 'rose',
    addOns: ['chocolate', 'card'],
  },
  {
    id: 'sympathy',
    label: 'Sympathy',
    description: 'Quiet whites, greens, and gentle structure.',
    flowers: { 'white-tulip': 5, 'orchid-spray': 2, eucalyptus: 3 },
    size: 'medium',
    wrapper: 'kraft',
    ribbon: 'sage',
    addOns: ['card'],
  },
];

function readSavedDesigns(): CustomBouquetConfig[] {
  try {
    const raw = localStorage.getItem(savedDesignsKey);
    return raw ? (JSON.parse(raw) as CustomBouquetConfig[]) : [];
  } catch {
    return [];
  }
}

function writeSavedDesigns(designs: CustomBouquetConfig[]) {
  localStorage.setItem(savedDesignsKey, JSON.stringify(designs.slice(0, 6)));
}

export function CustomBouquetPage() {
  const [searchParams] = useSearchParams();
  const { addItem, toggleDrawer } = useCart();
  const { showToast } = useNotifications();
  const [selectedFlowers, setSelectedFlowers] = useState<CustomBouquetFlower[]>([]);
  const [size, setSize] = useState(sizeOptions[1].id);
  const [wrapper, setWrapper] = useState(wrapperOptions[1].id);
  const [ribbon, setRibbon] = useState(ribbonOptions[0].id);
  const [addOns, setAddOns] = useState<string[]>(['card']);
  const [message, setMessage] = useState('');
  const [savedDesigns, setSavedDesigns] = useState<CustomBouquetConfig[]>(() => readSavedDesigns());
  const designToLoad = searchParams.get('design');

  const selectedSize = sizeOptions.find((option) => option.id === size) ?? sizeOptions[1];
  const selectedWrapper = wrapperOptions.find((option) => option.id === wrapper) ?? wrapperOptions[1];
  const selectedRibbon = ribbonOptions.find((option) => option.id === ribbon) ?? ribbonOptions[0];
  const selectedAddOns = addOnOptions.filter((option) => addOns.includes(option.id));

  const pricing = useMemo(() => {
    const flowerSubtotal = selectedFlowers.reduce((sum, flower) => sum + flower.price * flower.quantity, 0);
    const subtotal = Math.round(flowerSubtotal * selectedSize.multiplier);
    const addOnsCost = selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
    return {
      flowerSubtotal,
      subtotal,
      addOnsCost,
      total: subtotal + addOnsCost,
    };
  }, [selectedAddOns, selectedFlowers, selectedSize.multiplier]);

  const currentConfig = (): CustomBouquetConfig => ({
    id: `custom-bouquet-${Date.now()}`,
    flowers: selectedFlowers,
    size,
    sizeLabel: selectedSize.label,
    sizeMultiplier: selectedSize.multiplier,
    wrapper,
    wrapperLabel: selectedWrapper.label,
    ribbon,
    ribbonLabel: selectedRibbon.label,
    addOns: selectedAddOns,
    message: addOns.includes('card') ? message.trim() : '',
    subtotal: pricing.subtotal,
    addOnsCost: pricing.addOnsCost,
    total: pricing.total,
    created_at: new Date().toISOString(),
  });

  const addFlower = (flower: FlowerOption) => {
    setSelectedFlowers((current) => {
      const existing = current.find((item) => item.id === flower.id);
      if (existing) {
        return current.map((item) =>
          item.id === flower.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { ...flower, quantity: 1 }];
    });
  };

  const updateFlowerQuantity = (flowerId: string, quantity: number) => {
    setSelectedFlowers((current) =>
      quantity <= 0
        ? current.filter((item) => item.id !== flowerId)
        : current.map((item) => (item.id === flowerId ? { ...item, quantity } : item)),
    );
  };

  const toggleAddOn = (addOnId: string) => {
    setAddOns((current) =>
      current.includes(addOnId) ? current.filter((item) => item !== addOnId) : [...current, addOnId],
    );
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;

    setSelectedFlowers(
      Object.entries(preset.flowers)
        .map(([flowerId, quantity]) => {
          const flower = flowerOptions.find((option) => option.id === flowerId);
          return flower ? { ...flower, quantity } : null;
        })
        .filter(Boolean) as CustomBouquetFlower[],
    );
    setSize(preset.size);
    setWrapper(preset.wrapper);
    setRibbon(preset.ribbon);
    setAddOns(preset.addOns);
    showToast('Preset applied', `${preset.label} bouquet is ready to refine.`);
  };

  const applyAiSuggestion = () => {
    const selectedMoods = selectedFlowers.map(
      (flower) => flowerOptions.find((option) => option.id === flower.id)?.mood ?? '',
    );
    const hasPremium = selectedMoods.some((mood) => mood === 'premium' || mood === 'elegant');
    const hasBright = selectedMoods.includes('bright');

    if (!selectedFlowers.length) {
      applyPreset('birthday');
      showToast('AI suggestion added', 'A bright balanced bouquet has been drafted for you.');
      return;
    }

    if (!selectedFlowers.some((flower) => flower.id === 'eucalyptus')) {
      addFlower(flowerOptions.find((flower) => flower.id === 'eucalyptus') ?? flowerOptions[0]);
    }
    setWrapper(hasPremium ? 'elegant' : hasBright ? 'kraft' : 'pastel');
    setRibbon(hasBright ? 'champagne' : hasPremium ? 'midnight' : 'rose');
    setSize(selectedFlowers.length >= 3 ? 'large' : 'medium');
    showToast('AI suggestion applied', 'The wrap, ribbon, and greenery were tuned for balance.');
  };

  const resetBuilder = () => {
    setSelectedFlowers([]);
    setSize(sizeOptions[1].id);
    setWrapper(wrapperOptions[1].id);
    setRibbon(ribbonOptions[0].id);
    setAddOns(['card']);
    setMessage('');
  };

  const saveDesign = () => {
    if (!selectedFlowers.length) {
      showToast('Choose flowers first', 'Add at least one flower before saving this bouquet.');
      return;
    }
    const design = currentConfig();
    const nextDesigns = [design, ...savedDesigns.filter((item) => item.id !== design.id)].slice(0, 6);
    setSavedDesigns(nextDesigns);
    writeSavedDesigns(nextDesigns);
    showToast('Design saved', 'You can reload this bouquet from the saved designs panel.');
  };

  const loadDesign = (design: CustomBouquetConfig) => {
    setSelectedFlowers(design.flowers);
    setSize(design.size);
    setWrapper(design.wrapper);
    setRibbon(design.ribbon);
    setAddOns(design.addOns.map((item) => item.id));
    setMessage(design.message ?? '');
    showToast('Design loaded', 'Your saved bouquet is back on the design table.');
  };

  useEffect(() => {
    if (!designToLoad) return;
    const design = savedDesigns.find((item) => item.id === designToLoad);
    if (!design) return;
    setSelectedFlowers(design.flowers);
    setSize(design.size);
    setWrapper(design.wrapper);
    setRibbon(design.ribbon);
    setAddOns(design.addOns.map((item) => item.id));
    setMessage(design.message ?? '');
  }, [designToLoad, savedDesigns]);

  const handleAddToCart = () => {
    if (!selectedFlowers.length) {
      showToast('Your bouquet needs flowers', 'Select at least one flower to add a custom bouquet.');
      return;
    }

    const config = currentConfig();
    const product: Product = {
      id: config.id,
      name: `${config.sizeLabel} Custom Bouquet`,
      description: [
        config.flowers.map((flower) => `${flower.quantity} ${flower.name}`).join(', '),
        `${config.wrapperLabel} wrap`,
        `${config.ribbonLabel} ribbon`,
        config.addOns.length ? `Add-ons: ${config.addOns.map((item) => item.label).join(', ')}` : '',
        config.message ? `Card: "${config.message}"` : '',
      ]
        .filter(Boolean)
        .join(' | '),
      category: 'mixed',
      price: config.total,
      image_url: createEmptyFlowerSvg('Custom'),
      stock: 99,
      is_featured: false,
      avg_rating: 5,
      review_count: 0,
      custom_bouquet: config,
    };

    addItem(product, 1);
    const nextDesigns = [config, ...savedDesigns].slice(0, 6);
    setSavedDesigns(nextDesigns);
    writeSavedDesigns(nextDesigns);
    toggleDrawer(true);
    showToast('Custom bouquet added', 'Your full bouquet configuration is saved in the cart.');
  };

  return (
    <PageWrapper>
      <div className="page-shell bouquet-page">
        <section className="bouquet-hero">
          <div className="section">
            <span className="eyebrow">
              <Sparkles size={16} />
              Bespoke Studio
            </span>
            <h2>Build a bouquet that feels personal before it reaches the ribbon.</h2>
            <p>
              Mix stems, set the presentation style, add a keepsake, and watch the total update as
              the arrangement takes shape.
            </p>
          </div>
          <div className="bouquet-hero-actions">
            <Button onClick={applyAiSuggestion}>
              <Bot size={18} />
              Suggest a Design
            </Button>
            <Button variant="secondary" onClick={resetBuilder}>
              <RefreshCw size={18} />
              Reset
            </Button>
          </div>
        </section>

        <section className="preset-strip">
          {presets.map((preset) => (
            <button
              key={preset.id}
              className="preset-card glass-card"
              onClick={() => applyPreset(preset.id)}
              type="button"
            >
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </section>

        <section className="bouquet-builder-layout">
          <div className="section">
            <Card className="builder-panel">
              <div className="summary-row">
                <div>
                  <span className="eyebrow">Flowers</span>
                  <h3>Select stems</h3>
                </div>
                <span className="badge badge-neutral">Drag or add</span>
              </div>

              <div className="flower-selection-grid">
                {flowerOptions.map((flower) => {
                  const selected = selectedFlowers.find((item) => item.id === flower.id);
                  return (
                    <article
                      className="flower-builder-card"
                      draggable
                      key={flower.id}
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', flower.id)}
                    >
                      <img src={flower.image_url} alt={flower.name} />
                      <div className="flower-builder-body">
                        <div>
                          <h4>{flower.name}</h4>
                          <p>{formatPrice(flower.price)} per stem</p>
                        </div>
                        {selected ? (
                          <div className="quantity-stepper">
                            <button
                              onClick={() => updateFlowerQuantity(flower.id, selected.quantity - 1)}
                              aria-label={`Decrease ${flower.name}`}
                            >
                              <Minus size={15} />
                            </button>
                            <strong>{selected.quantity}</strong>
                            <button
                              onClick={() => updateFlowerQuantity(flower.id, selected.quantity + 1)}
                              aria-label={`Increase ${flower.name}`}
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => addFlower(flower)}>
                            <Plus size={15} />
                            Add
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </Card>

            <Card className="builder-panel">
              <div className="summary-row">
                <div>
                  <span className="eyebrow">Customize</span>
                  <h3>Finish the presentation</h3>
                </div>
                <Palette size={22} className="rose" />
              </div>

              <div className="builder-option-group">
                <strong>Bouquet size</strong>
                <div className="segmented-grid">
                  {sizeOptions.map((option) => (
                    <button
                      className={option.id === size ? 'option-tile active' : 'option-tile'}
                      key={option.id}
                      onClick={() => setSize(option.id)}
                      type="button"
                    >
                      <strong>{option.label}</strong>
                      <span>{option.detail}</span>
                      <small>{option.multiplier}x stems</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="builder-option-group">
                <strong>Wrapper selection</strong>
                <div className="segmented-grid">
                  {wrapperOptions.map((option) => (
                    <button
                      className={option.id === wrapper ? 'option-tile active' : 'option-tile'}
                      key={option.id}
                      onClick={() => setWrapper(option.id)}
                      type="button"
                    >
                      <span className="swatch" style={{ background: option.color }} />
                      <strong>{option.label}</strong>
                      <span>{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="builder-option-group">
                <strong>Ribbon color</strong>
                <div className="ribbon-grid">
                  {ribbonOptions.map((option) => (
                    <button
                      className={option.id === ribbon ? 'ribbon-option active' : 'ribbon-option'}
                      key={option.id}
                      onClick={() => setRibbon(option.id)}
                      type="button"
                      aria-label={`${option.label} ribbon`}
                    >
                      <span style={{ background: option.color }} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="builder-option-group">
                <strong>Add-ons</strong>
                <div className="addon-grid">
                  {addOnOptions.map((option) => (
                    <label className={addOns.includes(option.id) ? 'addon-card active' : 'addon-card'} key={option.id}>
                      <input
                        type="checkbox"
                        checked={addOns.includes(option.id)}
                        onChange={() => toggleAddOn(option.id)}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{formatPrice(option.price)}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {addOns.includes('card') ? (
                  <div className="textarea-shell">
                    <textarea
                      maxLength={180}
                      placeholder="Write a short message for the greeting card..."
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <aside className="section bouquet-sidebar">
            <Card
              className="bouquet-preview-card"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const flower = flowerOptions.find((option) => option.id === event.dataTransfer.getData('text/plain'));
                if (flower) addFlower(flower);
              }}
            >
              <div className="summary-row">
                <div>
                  <span className="eyebrow">Live Preview</span>
                  <h3>Your bouquet</h3>
                </div>
                <Gift className="rose" size={22} />
              </div>

              <div className="visual-bouquet" style={{ ['--wrap-color' as string]: selectedWrapper.color }}>
                <div className="stem-cluster">
                  {selectedFlowers.length ? (
                    selectedFlowers.flatMap((flower) =>
                      Array.from({ length: Math.min(flower.quantity, 6) }).map((_, index) => (
                        <span
                          className="preview-bloom"
                          key={`${flower.id}-${index}`}
                          style={{
                            background: flower.color,
                            left: `${22 + ((index * 11 + flower.id.length * 7) % 54)}%`,
                            top: `${10 + ((index * 13 + flower.name.length * 5) % 34)}%`,
                            transform: `rotate(${index * 18 - 30}deg)`,
                          }}
                        />
                      )),
                    )
                  ) : (
                    <p>Drop flowers here or tap Add to begin.</p>
                  )}
                </div>
                <div className="paper-wrap" />
                <div className="ribbon-band" style={{ background: selectedRibbon.color }} />
              </div>

              <div className="summary-list">
                {selectedFlowers.length ? (
                  selectedFlowers.map((flower) => (
                    <div className="summary-row" key={flower.id}>
                      <span>
                        {flower.name} x {flower.quantity}
                      </span>
                      <strong>{formatPrice(flower.price * flower.quantity)}</strong>
                    </div>
                  ))
                ) : (
                  <p>No flowers selected yet.</p>
                )}
              </div>

              <div className="summary-list">
                <div className="summary-row">
                  <span>Flower subtotal</span>
                  <strong>{formatPrice(pricing.flowerSubtotal)}</strong>
                </div>
                <div className="summary-row">
                  <span>{selectedSize.label} size multiplier</span>
                  <strong>{formatPrice(pricing.subtotal)}</strong>
                </div>
                <div className="summary-row">
                  <span>Add-ons</span>
                  <strong>{formatPrice(pricing.addOnsCost)}</strong>
                </div>
                <div className="summary-row total-row">
                  <span>Total</span>
                  <strong>{formatPrice(pricing.total)}</strong>
                </div>
              </div>

              <div className="action-row action-row-dual action-row-full">
                <Button variant="secondary" onClick={saveDesign} disabled={!selectedFlowers.length}>
                  <Save size={18} />
                  Save
                </Button>
                <Button onClick={handleAddToCart} disabled={!selectedFlowers.length}>
                  <ShoppingBag size={18} />
                  Add to Cart
                </Button>
              </div>
            </Card>

            <Card className="builder-panel">
              <div className="summary-row">
                <div>
                  <span className="eyebrow">Saved</span>
                  <h3>Previous designs</h3>
                </div>
                <Link to="/customer/cart" className="rose">
                  Cart
                </Link>
              </div>
              <div className="saved-design-list">
                {savedDesigns.length ? (
                  savedDesigns.map((design) => (
                    <button className="saved-design-card" key={design.id} onClick={() => loadDesign(design)} type="button">
                      <span>{design.sizeLabel} bouquet</span>
                      <strong>{formatPrice(design.total)}</strong>
                      <small>{design.flowers.map((flower) => flower.name).join(', ')}</small>
                    </button>
                  ))
                ) : (
                  <p>Saved designs will appear here for fast edits before checkout.</p>
                )}
              </div>
            </Card>
          </aside>
        </section>
      </div>
    </PageWrapper>
  );
}
