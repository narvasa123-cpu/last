import { CheckCircle2, CreditCard, MapPin, Receipt } from 'lucide-react';

import { cn } from '../../lib/utils';

const icons = [MapPin, CreditCard, Receipt];

interface CheckoutStepperProps {
  currentStep: number;
}

export function CheckoutStepper({ currentStep }: CheckoutStepperProps) {
  const steps = [
    { title: 'Delivery Details', subtitle: 'Address, date, and gift note' },
    { title: 'Payment', subtitle: 'Method, coupon, and points' },
    { title: 'Summary', subtitle: 'Review and place the order' },
  ];

  return (
    <div className="stepper">
      {steps.map((step, index) => {
        const Icon = index < currentStep ? CheckCircle2 : icons[index];
        return (
          <div
            className={cn('step', index === currentStep && 'active', index < currentStep && 'complete')}
            key={step.title}
          >
            <div className="timeline-icon">
              <Icon size={18} />
            </div>
            <div className="section" style={{ gap: '0.2rem' }}>
              <strong>{step.title}</strong>
              <p>{step.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
