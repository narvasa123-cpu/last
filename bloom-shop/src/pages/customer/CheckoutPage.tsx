import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CheckoutStepper } from '../../components/checkout/CheckoutStepper';
import { DeliveryScheduler, type DeliveryFormState } from '../../components/checkout/DeliveryScheduler';
import { OrderSummary } from '../../components/checkout/OrderSummary';
import { PaymentSelector, type CardFormState } from '../../components/checkout/PaymentSelector';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useNotifications } from '../../hooks/useNotifications';
import { MOCK_COUPONS } from '../../lib/constants';
import { getCustomerAddresses } from '../../lib/data';
import { createDemoOrderFromCart } from '../../lib/orders';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { DeliveryAddress } from '../../lib/types';
import { calcPoints, getTodayISO } from '../../lib/utils';

type DeliveryErrors = Partial<Record<keyof DeliveryFormState, string>>;

export function CheckoutPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useNotifications();
  const {
    items,
    coupon,
    rewardPointsApplied,
    totals,
    clearCart,
    setCoupon,
    setRewardPointsApplied,
  } = useCart();

  const [step, setStep] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState('');
  const [delivery, setDelivery] = useState<DeliveryFormState>({
    address: profile?.address ?? '',
    deliveryDate: getTodayISO(),
    deliveryTime: 'Afternoon (12-5)',
    notes: '',
  });
  const [errors, setErrors] = useState<DeliveryErrors>({});
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'gcash' | 'card'>('cod');
  const [couponCode, setCouponCode] = useState(coupon?.code ?? '');
  const [gcashReference, setGcashReference] = useState('');
  const [cardState, setCardState] = useState<CardFormState>({
    cardNumber: '',
    expiry: '',
    cvv: '',
    cardholder: profile?.full_name ?? '',
  });
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');

  const pointsPreview = useMemo(() => calcPoints(totals.total), [totals.total]);

  useEffect(() => {
    if (!user?.id) return;
    getCustomerAddresses(user.id, profile).then((nextAddresses) => {
      setAddresses(nextAddresses);
      const defaultAddress = nextAddresses.find((address) => address.is_default) ?? nextAddresses[0];
      if (defaultAddress && !selectedAddressId) {
        setSelectedAddressId(defaultAddress.id);
        setDelivery((current) => ({
          ...current,
          address: defaultAddress.address,
          notes: current.notes || defaultAddress.delivery_notes || '',
        }));
      }
    });
  }, [profile?.address, user?.id]);

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    const selected = addresses.find((address) => address.id === addressId);
    if (!selected) return;
    setDelivery((current) => ({
      ...current,
      address: selected.address,
      notes: current.notes || selected.delivery_notes || '',
    }));
  };

  const validateStep = () => {
    if (step === 0) {
      const nextErrors: DeliveryErrors = {};
      if (!delivery.address.trim()) nextErrors.address = 'Delivery address is required.';
      if (!delivery.deliveryDate) nextErrors.deliveryDate = 'Please choose a delivery date.';
      if (!delivery.deliveryTime) nextErrors.deliveryTime = 'Please select a time slot.';
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    }

    if (step === 1) {
      if (paymentMethod === 'gcash' && !gcashReference.trim()) {
        showToast('Reference required', 'Please add your GCash reference number before continuing.');
        return false;
      }
      if (
        paymentMethod === 'card' &&
        (!cardState.cardNumber.trim() || !cardState.expiry.trim() || !cardState.cvv.trim())
      ) {
        showToast('Card details incomplete', 'Fill in the card number, expiry, and CVV fields.');
        return false;
      }
    }

    return true;
  };

  const handleApplyCoupon = () => {
    const matched = MOCK_COUPONS.find((entry) => entry.code === couponCode.trim().toUpperCase());
    if (!matched) {
      setCoupon(null);
      showToast('Coupon not found', 'Try BLOOM10 or FREESHIP for the demo checkout.');
      return;
    }
    setCoupon(matched);
    showToast('Coupon applied', `${matched.code} is now active on this checkout.`);
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((current) => Math.min(2, current + 1));
  };

  const handleBack = () => setStep((current) => Math.max(0, current - 1));

  const handlePlaceOrder = async () => {
    if (!user || !profile || !items.length) return;

    setPlacing(true);

    const status = paymentMethod === 'cod' ? 'pending' : 'confirmed';
    const paymentStatus = paymentMethod === 'cod' ? 'unpaid' : 'pending';
    const generatedOrderId = crypto.randomUUID();
    const saveFallbackOrder = () =>
      createDemoOrderFromCart({
        id: generatedOrderId,
        customer: profile,
        items,
        totalAmount: totals.total,
        deliveryFee: totals.deliveryFee,
        discountAmount: totals.discount,
        couponId: coupon?.id ?? null,
        paymentMethod,
        deliveryAddress: delivery.address,
        deliveryDate: delivery.deliveryDate,
        deliveryTime: delivery.deliveryTime,
        notes: delivery.notes,
        gcashReference,
      });

    if (isSupabaseConfigured) {
      try {
        const { data: insertedOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            id: generatedOrderId,
            customer_id: user.id,
            status,
            total_amount: totals.total,
            delivery_fee: totals.deliveryFee,
            discount_amount: totals.discount,
            coupon_id: coupon?.id ?? null,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            delivery_address: delivery.address,
            delivery_date: delivery.deliveryDate,
            delivery_time: delivery.deliveryTime,
            notes: delivery.notes,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const orderItemsWithBouquetData = items.map((line) => ({
          order_id: insertedOrder.id,
          product_id: line.product.custom_bouquet ? null : line.product.id,
          quantity: line.quantity,
          unit_price: line.product.price,
          subtotal: line.product.price * line.quantity,
          custom_bouquet: line.product.custom_bouquet ?? null,
        }));

        const { error: itemInsertError } = await supabase.from('order_items').insert(orderItemsWithBouquetData);

        if (itemInsertError) {
          const errorMessage = String(itemInsertError.message ?? itemInsertError).toLowerCase();
          const isMissingCustomBouquetColumn =
            errorMessage.includes('custom_bouquet') ||
            errorMessage.includes('column') ||
            errorMessage.includes('does not exist');

          if (!isMissingCustomBouquetColumn) {
            throw itemInsertError;
          }

          const fallbackItems = await Promise.all(
            items.map(async (line) => {
              let productId = line.product.id;

              if (line.product.custom_bouquet) {
                const { data: customProduct, error: customProductError } = await supabase
                  .from('products')
                  .insert({
                    name: line.product.name,
                    description: line.product.description,
                    category: line.product.category,
                    price: line.product.price,
                    image_url: line.product.image_url,
                    stock: 999,
                    is_featured: false,
                  })
                  .select('id')
                  .single();

                if (customProductError) {
                  const isForbidden =
                    (customProductError as { code?: string; statusCode?: number }).statusCode === 403 ||
                    (customProductError as { code?: string }).code === '42501' ||
                    String(customProductError.message ?? customProductError).toLowerCase().includes('policy');
                  if (isForbidden) {
                    throw new Error(
                      'Custom bouquet checkout requires the latest database migration (007_custom_bouquet_order_items). Please apply migrations and try again.',
                    );
                  }
                  throw customProductError ?? new Error('Unable to create custom bouquet product.');
                }

                if (!customProduct) {
                  throw new Error('Unable to create custom bouquet product.');
                }

                productId = customProduct.id;
              }

              return {
                order_id: insertedOrder.id,
                product_id: productId,
                quantity: line.quantity,
                unit_price: line.product.price,
                subtotal: line.product.price * line.quantity,
              };
            }),
          );

          const { error: fallbackItemInsertError } = await supabase.from('order_items').insert(fallbackItems);
          if (fallbackItemInsertError) throw fallbackItemInsertError;
        }

        await supabase.from('payments').insert({
          order_id: insertedOrder.id,
          amount: totals.total,
          method: paymentMethod,
          reference_no: paymentMethod === 'gcash' ? gcashReference : null,
          status: 'pending',
        });

        if (status === 'confirmed') {
          const pointsEarned = calcPoints(totals.total);
          await supabase
            .from('users')
            .update({ points: (profile.points ?? 0) + pointsEarned - rewardPointsApplied })
            .eq('id', user.id);
          await supabase.from('rewards_log').insert({
            user_id: user.id,
            order_id: insertedOrder.id,
            points: pointsEarned,
            description: 'Points earned from confirmed order',
          });
        }

        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Order placed successfully',
          message: `Your order #${insertedOrder.id.slice(0, 8)} is now in the ${status} stage.`,
          type: 'order',
        });

        await refreshProfile(user.id);
        setSuccessOrderId(insertedOrder.id);
      } catch {
        saveFallbackOrder();
        setSuccessOrderId(generatedOrderId);
      }
    } else {
      saveFallbackOrder();
      setSuccessOrderId(generatedOrderId);
    }

    clearCart();
    setPlacing(false);
    setSuccess(true);
    showToast('Order placed', 'Your bouquet order has been created successfully.');
  };

  if (!items.length && !success) {
    return (
      <PageWrapper>
        <div className="page-shell">
          <Card className="empty-state">
            <div className="empty-illustration">🌷</div>
            <h3>Your checkout is empty.</h3>
            <p>Add bouquets to your cart before scheduling a delivery.</p>
            <Link to="/shop">
              <Button>Browse Bouquets</Button>
            </Link>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="page-shell" style={{ position: 'relative' }}>
        {success ? (
          <Card className="summary-card center" style={{ minHeight: '28rem', gap: '1rem', position: 'relative' }}>
            <div className="confetti-burst">
              {Array.from({ length: 18 }).map((_, index) => (
                <span
                  key={index}
                  className="confetti-piece"
                  style={{
                    left: `${(index + 1) * 5}%`,
                    animationDelay: `${index * 0.08}s`,
                    ['--fall' as string]: `${2.6 + index * 0.04}s`,
                  }}
                />
              ))}
            </div>
            <span className="eyebrow">Success</span>
            <h2>Your order is blooming.</h2>
            <p>
              Order #{successOrderId.slice(0, 8)} has been placed. We have queued the bouquet for
              florist review and rider scheduling.
            </p>
            <div className="action-row action-row-dual action-row-full">
              <Link to="/customer/orders">
                <Button fullWidth>View Orders</Button>
              </Link>
              <Link to="/shop">
                <Button variant="secondary" fullWidth>
                  Keep Shopping
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <section className="section">
              <div className="section-heading">
                <div className="section">
                  <span className="eyebrow">Checkout</span>
                  <h2>Schedule delivery in three calm steps.</h2>
                  <p>Address, payment, and a final review before Bloom takes over.</p>
                </div>
              </div>
              <CheckoutStepper currentStep={step} />
            </section>

            <section className="checkout-layout">
              <Card className="summary-card">
                {step === 0 ? (
                  <div className="section">
                    {addresses.length ? (
                      <div className="field-stack">
                        <label>Saved Addresses</label>
                        <div className="time-slot-grid">
                          {addresses.map((address) => (
                            <button
                              key={address.id}
                              className={selectedAddressId === address.id ? 'payment-card active' : 'payment-card'}
                              type="button"
                              onClick={() => handleSelectAddress(address.id)}
                            >
                              <div className="section" style={{ gap: '0.2rem', textAlign: 'left' }}>
                                <strong>{address.label}</strong>
                                <span>{address.address}</span>
                                {address.is_default ? <span className="badge badge-success">Default</span> : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <DeliveryScheduler value={delivery} onChange={setDelivery} errors={errors} />
                  </div>
                ) : null}
                {step === 1 ? (
                  <PaymentSelector
                    method={paymentMethod}
                    onMethodChange={setPaymentMethod}
                    couponCode={couponCode}
                    onCouponCodeChange={setCouponCode}
                    onApplyCoupon={handleApplyCoupon}
                    appliedCoupon={coupon}
                    availablePoints={profile?.points ?? 0}
                    rewardPointsApplied={rewardPointsApplied}
                    onRewardPointsApplied={setRewardPointsApplied}
                    gcashReference={gcashReference}
                    onGcashReferenceChange={setGcashReference}
                    cardState={cardState}
                    onCardStateChange={setCardState}
                  />
                ) : null}
                {step === 2 ? (
                  <div className="section">
                    <Card className="summary-card">
                      <div className="summary-row">
                        <span>Delivery Address</span>
                        <strong>{delivery.address}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Date & Time</span>
                        <strong>
                          {delivery.deliveryDate} / {delivery.deliveryTime}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Payment Method</span>
                        <strong>{paymentMethod.toUpperCase()}</strong>
                      </div>
                      <div className="summary-row">
                        <span>Points to Earn</span>
                        <strong className="success">{pointsPreview}</strong>
                      </div>
                      {delivery.notes ? (
                        <div className="section" style={{ gap: '0.25rem' }}>
                          <span>Gift Note</span>
                          <p>{delivery.notes}</p>
                        </div>
                      ) : null}
                    </Card>
                  </div>
                ) : null}

                <div className="summary-row" style={{ marginTop: '1rem' }}>
                  <Button variant="secondary" onClick={handleBack} disabled={step === 0}>
                    Back
                  </Button>
                  {step < 2 ? (
                    <Button onClick={handleNext}>Continue</Button>
                  ) : (
                    <Button onClick={handlePlaceOrder} disabled={placing}>
                      {placing ? 'Placing Order...' : 'Place Order'}
                    </Button>
                  )}
                </div>
              </Card>

              <OrderSummary
                items={items}
                subtotal={totals.subtotal}
                deliveryFee={totals.deliveryFee}
                discount={totals.discount}
                total={totals.total}
                pointsToEarn={pointsPreview}
              />
            </section>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
