import { CalendarDays, Clock3, MapPinned } from 'lucide-react';

import { getTodayISO } from '../../lib/utils';
import { Input, Textarea } from '../ui/Input';

export interface DeliveryFormState {
  address: string;
  deliveryDate: string;
  deliveryTime: string;
  notes: string;
}

interface DeliverySchedulerProps {
  value: DeliveryFormState;
  onChange: (next: DeliveryFormState) => void;
  errors?: Partial<Record<keyof DeliveryFormState, string>>;
}

const slots = ['Morning (8-12)', 'Afternoon (12-5)', 'Evening (5-8)'];

export function DeliveryScheduler({ value, onChange, errors }: DeliverySchedulerProps) {
  return (
    <div className="section">
      <Input
        label="Delivery Address"
        id="delivery-address"
        icon={<MapPinned size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
        value={value.address}
        onChange={(event) => onChange({ ...value, address: event.target.value })}
        error={errors?.address}
      />
      <div className="search-row">
        <Input
          label="Delivery Date"
          id="delivery-date"
          icon={<CalendarDays size={18} style={{ marginLeft: '1rem', color: 'var(--bloom-rose)' }} />}
          type="date"
          min={getTodayISO()}
          value={value.deliveryDate}
          onChange={(event) => onChange({ ...value, deliveryDate: event.target.value })}
          error={errors?.deliveryDate}
        />
        <div className="field-stack">
          <label>Time Slot</label>
          <div className="time-slot-grid">
            {slots.map((slot) => (
              <button
                key={slot}
                className={value.deliveryTime === slot ? 'payment-card active' : 'payment-card'}
                onClick={() => onChange({ ...value, deliveryTime: slot })}
                type="button"
              >
                <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
                  <Clock3 size={16} color="var(--bloom-rose)" />
                  <span>{slot}</span>
                </div>
              </button>
            ))}
          </div>
          {errors?.deliveryTime ? <span className="field-error">{errors.deliveryTime}</span> : null}
        </div>
      </div>
      <Textarea
        label="Gift Note"
        id="gift-note"
        value={value.notes}
        onChange={(event) => onChange({ ...value, notes: event.target.value })}
        hint="Optional note to include with the bouquet."
      />
    </div>
  );
}
