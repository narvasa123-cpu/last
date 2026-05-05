import { Crown, Medal, Sparkles } from 'lucide-react';

import type { Tier } from '../../lib/types';
import { Badge } from '../ui/Badge';

const iconMap: Record<Tier, React.ReactNode> = {
  Bronze: <Medal size={16} />,
  Silver: <Sparkles size={16} />,
  Gold: <Crown size={16} />,
};

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <Badge variant={tier === 'Gold' ? 'success' : 'primary'}>
      {iconMap[tier]}
      {tier} Tier
    </Badge>
  );
}
