import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const sizeMap: Record<ButtonSize, string> = {
  sm: '0.75rem 1rem',
  md: '0.95rem 1.4rem',
  lg: '1.05rem 1.7rem',
};

export const Button = forwardRef<HTMLButtonElement, PropsWithChildren<ButtonProps>>(
  ({ children, className, style, variant = 'primary', size = 'md', fullWidth, ...props }, ref) => (
    <button
      ref={ref}
      className={cn('button-base', `button-${variant}`, className)}
      style={{ padding: sizeMap[size], width: fullWidth ? '100%' : undefined, ...style }}
      {...props}
    >
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
