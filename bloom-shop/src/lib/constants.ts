import type {
  CategoryTile,
  Coupon,
  DashboardMetric,
  NotificationItem,
  Order,
  OrderStatus,
  Product,
  ProductCategory,
  Review,
  Role,
  Testimonial,
  UserProfile,
} from './types';

export const ROLE_ROUTES: Record<Role, string> = {
  admin: '/admin',
  customer: '/customer',
  rider: '/rider',
  cashier: '/cashier',
};

export const ROLE_ID_TO_NAME: Record<number, Role> = {
  1: 'admin',
  2: 'customer',
  3: 'rider',
  4: 'cashier',
};

export const ROLE_NAME_TO_ID: Record<Role, number> = {
  admin: 1,
  customer: 2,
  rider: 3,
  cashier: 4,
};

export const TIER_THRESHOLDS = {
  Bronze: { min: 0, max: 499 },
  Silver: { min: 500, max: 1499 },
  Gold: { min: 1500, max: Infinity },
} as const;

export const DELIVERY_FEE_THRESHOLD = 1500;
export const DEFAULT_DELIVERY_FEE = 99;
export const POINTS_PER_SPEND = 100;

export const ORDER_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'picked_up',
  'on_the_way',
  'delivered',
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  picked_up: 'Picked Up',
  on_the_way: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const CATEGORY_META: Record<ProductCategory, { label: string; emoji: string }> = {
  roses: { label: 'Roses', emoji: '🌹' },
  tulips: { label: 'Tulips', emoji: '🌷' },
  mixed: { label: 'Mixed', emoji: '💐' },
  sunflowers: { label: 'Sunflowers', emoji: '🌻' },
  orchids: { label: 'Orchids', emoji: '🌸' },
};

export const CATEGORY_TILES: CategoryTile[] = [
  {
    id: 'roses',
    emoji: '🌹',
    name: 'Roses',
    image: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=900&q=80',
    description: 'Classic romance in crimson and blush tones.',
  },
  {
    id: 'tulips',
    emoji: '🌷',
    name: 'Tulips',
    image: 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=900&q=80',
    description: 'Bright, painterly stems for modern gifting.',
  },
  {
    id: 'mixed',
    emoji: '💐',
    name: 'Mixed',
    image: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=900&q=80',
    description: 'Layered bouquet stories with texture and color.',
  },
  {
    id: 'sunflowers',
    emoji: '🌻',
    name: 'Sunflowers',
    image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80',
    description: 'Golden stems designed to feel sunny and bold.',
  },
  {
    id: 'orchids',
    emoji: '🌸',
    name: 'Orchids',
    image: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=900&q=80',
    description: 'Elegant orchid arrangements with sculptural grace.',
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    name: 'Mia Santos',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    quote: 'The bouquet looked editorial, not generic. Delivery updates were precise and the flowers lasted a full week.',
    rating: 5,
  },
  {
    id: 't2',
    name: 'Clara Dizon',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
    quote: 'Bloom Shop made same-day gifting feel luxurious. The checkout was smoother than most food apps.',
    rating: 5,
  },
  {
    id: 't3',
    name: 'Nico Reyes',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    quote: 'I ordered for my mom and the rider updates gave me confidence. The wrapping looked premium in person.',
    rating: 4,
  },
];

export const WHY_CHOOSE_US = [
  { icon: '🚀', title: 'Same-Day Delivery', description: 'Fresh bouquets dispatched within the hour for metro orders.' },
  { icon: '🌿', title: 'Farm Fresh', description: 'Sourced from partner growers with daily quality checks.' },
  { icon: '💝', title: 'Gift Wrapping', description: 'Hand-finished wraps, ribbons, cards, and keepsake notes.' },
  { icon: '⭐', title: '5-Star Rated', description: 'Loved for responsive service and agency-level bouquet styling.' },
];

export const MOCK_USERS: UserProfile[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    role_id: 2,
    role: 'customer',
    full_name: 'Elena Cruz',
    phone: '+63 917 555 0199',
    address: '12 Sampaguita St, Makati City',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    points: 742,
    tier: 'Silver',
    is_active: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    role_id: 1,
    role: 'admin',
    full_name: 'Andrea Flores',
    phone: '+63 917 555 0101',
    address: 'Bloom HQ, BGC, Taguig',
    avatar_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=200&q=80',
    points: 0,
    tier: 'Bronze',
    is_active: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    role_id: 3,
    role: 'rider',
    full_name: 'Paolo Ramos',
    phone: '+63 917 555 0102',
    address: 'Pasig Dispatch Hub',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    points: 0,
    tier: 'Bronze',
    is_active: true,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    role_id: 4,
    role: 'cashier',
    full_name: 'Sofia Lim',
    phone: '+63 917 555 0103',
    address: 'Bloom Shop Flagship',
    avatar_url: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&w=200&q=80',
    points: 0,
    tier: 'Bronze',
    is_active: true,
  },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p-rose-sonata',
    name: 'Rose Sonata',
    description: 'A lush blend of garden roses, ranunculus, and soft eucalyptus in a wrapped signature bundle.',
    category: 'roses',
    price: 1890,
    image_url: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=1200&q=80',
    stock: 18,
    is_featured: true,
    avg_rating: 4.9,
    review_count: 128,
  },
  {
    id: 'p-blush-cloud',
    name: 'Blush Cloud',
    description: 'Peonies, lisianthus, and blush spray roses arranged with a gallery-like color balance.',
    category: 'mixed',
    price: 2450,
    image_url: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=1200&q=80',
    stock: 11,
    is_featured: true,
    avg_rating: 4.8,
    review_count: 92,
  },
  {
    id: 'p-tulip-letter',
    name: 'Tulip Letter',
    description: 'Minimal tulip arrangement with layered wrapping for a crisp, editorial silhouette.',
    category: 'tulips',
    price: 1590,
    image_url: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=1200&q=80',
    stock: 26,
    is_featured: true,
    avg_rating: 4.7,
    review_count: 61,
  },
  {
    id: 'p-sunlit-bloom',
    name: 'Sunlit Bloom',
    description: 'Sunflowers, yellow roses, and chamomile for bright celebration energy.',
    category: 'sunflowers',
    price: 1490,
    image_url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80',
    stock: 34,
    is_featured: false,
    avg_rating: 4.6,
    review_count: 49,
  },
  {
    id: 'p-orchid-whisper',
    name: 'Orchid Whisper',
    description: 'Phalaenopsis stems with layered neutral wrapping and pearl accents.',
    category: 'orchids',
    price: 2890,
    image_url: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=1200&q=80',
    stock: 7,
    is_featured: true,
    avg_rating: 5,
    review_count: 84,
  },
  {
    id: 'p-velvet-vow',
    name: 'Velvet Vow',
    description: 'Long-stem premium roses in deep magenta with satin ribbon detailing.',
    category: 'roses',
    price: 3290,
    image_url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1200&q=80',
    stock: 5,
    is_featured: false,
    avg_rating: 4.9,
    review_count: 144,
  },
  {
    id: 'p-dawn-tulips',
    name: 'Dawn Tulips',
    description: 'Pastel tulips in layered tones with soft blush wrap and note card.',
    category: 'tulips',
    price: 1720,
    image_url: 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?auto=format&fit=crop&w=1200&q=80',
    stock: 16,
    is_featured: false,
    avg_rating: 4.5,
    review_count: 37,
  },
  {
    id: 'p-golden-hour',
    name: 'Golden Hour',
    description: 'Sunflowers, peach carnations, and soft greenery in a warm palette.',
    category: 'sunflowers',
    price: 1360,
    image_url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80',
    stock: 24,
    is_featured: false,
    avg_rating: 4.4,
    review_count: 28,
  },
  {
    id: 'p-garden-story',
    name: 'Garden Story',
    description: 'A mixed bouquet with hydrangeas, roses, tulips, and premium foliage.',
    category: 'mixed',
    price: 2150,
    image_url: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80',
    stock: 12,
    is_featured: true,
    avg_rating: 4.8,
    review_count: 76,
  },
];

export const MOCK_REVIEWS: Review[] = [
  {
    id: 'r1',
    product_id: 'p-rose-sonata',
    user_id: MOCK_USERS[0].id,
    rating: 5,
    comment: 'The wrapping looked bespoke and the stems arrived fully hydrated.',
    created_at: '2026-04-20T09:30:00.000Z',
    user: { full_name: 'Elena Cruz', avatar_url: MOCK_USERS[0].avatar_url },
  },
  {
    id: 'r2',
    product_id: 'p-rose-sonata',
    user_id: 'user-2',
    rating: 5,
    comment: 'Exactly matched the product photography. Romantic without feeling overdone.',
    created_at: '2026-04-18T13:20:00.000Z',
    user: {
      full_name: 'Marie Co',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    },
  },
  {
    id: 'r3',
    product_id: 'p-orchid-whisper',
    user_id: 'user-3',
    rating: 4,
    comment: 'The orchids were pristine and the card printing was a nice touch.',
    created_at: '2026-04-15T17:15:00.000Z',
    user: {
      full_name: 'Lara Yu',
      avatar_url: 'https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=200&q=80',
    },
  },
];

export const MOCK_COUPONS: Coupon[] = [
  {
    id: 'c1',
    code: 'BLOOM10',
    discount_type: 'percent',
    discount_value: 10,
    min_order: 1000,
    max_uses: 500,
    used_count: 141,
    expires_at: '2026-05-31T23:59:59.000Z',
    is_active: true,
  },
  {
    id: 'c2',
    code: 'FREESHIP',
    discount_type: 'fixed',
    discount_value: 99,
    min_order: 1200,
    max_uses: 300,
    used_count: 188,
    expires_at: '2026-06-15T23:59:59.000Z',
    is_active: true,
  },
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    user_id: MOCK_USERS[0].id,
    title: 'Bouquet is preparing',
    message: 'Your Rose Sonata order is now being wrapped by our florist team.',
    type: 'order',
    is_read: false,
    created_at: '2026-04-26T02:10:00.000Z',
  },
  {
    id: 'n2',
    user_id: MOCK_USERS[0].id,
    title: 'Silver tier unlocked',
    message: 'You now earn bonus perks on selected featured bouquets.',
    type: 'promo',
    is_read: false,
    created_at: '2026-04-25T16:00:00.000Z',
  },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: 'o1',
    customer_id: MOCK_USERS[0].id,
    rider_id: MOCK_USERS[2].id,
    cashier_id: MOCK_USERS[3].id,
    status: 'on_the_way',
    total_amount: 1989,
    delivery_fee: 99,
    discount_amount: 0,
    payment_method: 'gcash',
    payment_status: 'verified',
    delivery_address: '12 Sampaguita St, Makati City',
    delivery_date: '2026-04-26',
    delivery_time: 'Afternoon (12-5)',
    notes: 'Please call on arrival.',
    created_at: '2026-04-26T00:40:00.000Z',
    updated_at: '2026-04-26T03:20:00.000Z',
    customer: MOCK_USERS[0],
    rider: MOCK_USERS[2],
    cashier: MOCK_USERS[3],
    items: [
      {
        id: 'oi1',
        product_id: 'p-rose-sonata',
        quantity: 1,
        unit_price: 1890,
        subtotal: 1890,
        product: MOCK_PRODUCTS[0],
      },
    ],
  },
  {
    id: 'o2',
    customer_id: MOCK_USERS[0].id,
    rider_id: MOCK_USERS[2].id,
    cashier_id: MOCK_USERS[3].id,
    status: 'delivered',
    total_amount: 2550,
    delivery_fee: 0,
    discount_amount: 140,
    payment_method: 'card',
    payment_status: 'paid',
    delivery_address: '12 Sampaguita St, Makati City',
    delivery_date: '2026-04-19',
    delivery_time: 'Morning (8-12)',
    notes: 'Anniversary bouquet.',
    created_at: '2026-04-18T02:40:00.000Z',
    updated_at: '2026-04-19T05:20:00.000Z',
    customer: MOCK_USERS[0],
    rider: MOCK_USERS[2],
    cashier: MOCK_USERS[3],
    items: [
      {
        id: 'oi2',
        product_id: 'p-orchid-whisper',
        quantity: 1,
        unit_price: 2890,
        subtotal: 2890,
        product: MOCK_PRODUCTS[4],
      },
    ],
  },
  {
    id: 'o3',
    customer_id: MOCK_USERS[0].id,
    rider_id: null,
    cashier_id: MOCK_USERS[3].id,
    status: 'pending',
    total_amount: 3094,
    delivery_fee: 99,
    discount_amount: 99,
    payment_method: 'cod',
    payment_status: 'unpaid',
    delivery_address: '58 Dahlia Ave, Pasig City',
    delivery_date: '2026-04-27',
    delivery_time: 'Evening (5-8)',
    notes: 'Birthday surprise.',
    created_at: '2026-04-26T04:15:00.000Z',
    updated_at: '2026-04-26T04:15:00.000Z',
    customer: MOCK_USERS[0],
    cashier: MOCK_USERS[3],
    items: [
      {
        id: 'oi3',
        product_id: null,
        quantity: 1,
        unit_price: 3094,
        subtotal: 3094,
        custom_bouquet: {
          id: 'custom-bouquet-demo-birthday',
          size: 'medium',
          sizeLabel: 'Medium',
          sizeMultiplier: 1.35,
          wrapper: 'pastel',
          wrapperLabel: 'Pastel',
          ribbon: 'champagne',
          ribbonLabel: 'Champagne',
          subtotal: 2719,
          addOnsCost: 375,
          total: 3094,
          created_at: '2026-04-26T04:10:00.000Z',
          message: 'Happy birthday! Wishing you a day full of light.',
          addOns: [
            { id: 'card', label: 'Greeting Card', price: 95 },
            { id: 'chocolate', label: 'Artisan Chocolate', price: 280 },
          ],
          flowers: [
            {
              id: 'sunflower',
              name: 'Sunflower',
              price: 145,
              quantity: 3,
              image_url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80',
              color: '#f8c643',
            },
            {
              id: 'pink-peony',
              name: 'Pink Peony',
              price: 210,
              quantity: 4,
              image_url: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=900&q=80',
              color: '#f5a3bf',
            },
            {
              id: 'eucalyptus',
              name: 'Eucalyptus',
              price: 85,
              quantity: 3,
              image_url: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?auto=format&fit=crop&w=900&q=80',
              color: '#91a983',
            },
          ],
        },
        product: {
          id: 'custom-bouquet-demo-birthday',
          name: 'Medium Custom Bouquet',
          description: 'Sunflowers, pink peonies, eucalyptus, pastel wrap, champagne ribbon, greeting card, and artisan chocolate.',
          category: 'mixed',
          price: 3094,
          image_url: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80',
          stock: 99,
          is_featured: false,
          avg_rating: 5,
          review_count: 0,
        },
      },
    ],
  },
];

export const ADMIN_METRICS: DashboardMetric[] = [
  { label: 'Total Sales Today', value: '₱54,320', trend: '+12.4%', accent: 'primary' },
  { label: 'Orders Today', value: '38', trend: '+8 vs yesterday', accent: 'neutral' },
  { label: 'New Customers', value: '14', trend: '+21%', accent: 'success' },
  { label: 'Pending Deliveries', value: '9', trend: '3 urgent', accent: 'primary' },
];

export const RIDER_METRICS: DashboardMetric[] = [
  { label: 'Earnings Today', value: '₱1,280', trend: '6 deliveries', accent: 'success' },
  { label: 'Assigned Route', value: '12.4 km', trend: 'Optimized', accent: 'primary' },
  { label: 'On-Time Rate', value: '98%', trend: 'This month', accent: 'neutral' },
  { label: 'Pending Offers', value: '4', trend: '2 nearby', accent: 'primary' },
];

export const CASHIER_METRICS: DashboardMetric[] = [
  { label: 'Pending Confirmations', value: '7', trend: 'Needs review', accent: 'primary' },
  { label: 'Verified Today', value: '24', trend: '+5 this hour', accent: 'success' },
  { label: 'Walk-In Revenue', value: '₱12,430', trend: '4 receipts', accent: 'neutral' },
  { label: 'Average Ticket', value: '₱1,553', trend: '+9%', accent: 'primary' },
];

export const SALES_SERIES = {
  '7d': [8200, 9500, 10220, 11890, 12350, 13400, 15420],
  '30d': [9800, 10300, 12110, 12400, 11780, 13600, 14120, 15450, 15010, 16240],
  '90d': [7800, 8300, 9200, 10400, 11500, 13200, 14400, 15200, 16800, 17900],
};

export const TOP_PRODUCT_REVENUE = [
  { label: 'Velvet Vow', value: 48200 },
  { label: 'Rose Sonata', value: 45120 },
  { label: 'Orchid Whisper', value: 43880 },
  { label: 'Garden Story', value: 39920 },
  { label: 'Blush Cloud', value: 38440 },
];

export const LOW_STOCK_PRODUCTS = MOCK_PRODUCTS.filter((product) => product.stock <= 12);
