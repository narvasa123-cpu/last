import type { HTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '../../lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'neutral';
}

export function Badge({
  children,
  className,
  variant = 'primary',
  ...props
}: PropsWithChildren<BadgeProps>) {
  return (
    <span className={cn('badge', `badge-${variant}`, className)} {...props}>
      {children}
    </span>
  );
}
