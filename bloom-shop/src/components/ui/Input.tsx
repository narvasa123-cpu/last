import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

interface BaseFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, BaseFieldProps {}
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseFieldProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, ...props }, ref) => (
    <div className="field-stack">
      {label ? <label htmlFor={props.id}>{label}</label> : null}
      <div className={cn('input-shell', className)}>
        {icon}
        <input ref={ref} {...props} />
      </div>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="muted">{hint}</span> : null}
    </div>
  ),
);

Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, icon, ...props }, ref) => (
    <div className="field-stack">
      {label ? <label htmlFor={props.id}>{label}</label> : null}
      <div className={cn('textarea-shell', className)}>
        {icon}
        <textarea ref={ref} {...props} />
      </div>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="muted">{hint}</span> : null}
    </div>
  ),
);

Textarea.displayName = 'Textarea';
