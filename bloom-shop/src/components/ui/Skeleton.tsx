import type { CSSProperties } from 'react';

import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn('skeleton glass-card', className)} style={style} />;
}
