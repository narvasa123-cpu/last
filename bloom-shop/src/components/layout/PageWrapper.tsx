import type { PropsWithChildren } from 'react';

import { cn } from '../../lib/utils';

interface PageWrapperProps {
  className?: string;
}

export function PageWrapper({ children, className }: PropsWithChildren<PageWrapperProps>) {
  return <div className={cn('page-wrapper', className)}>{children}</div>;
}
