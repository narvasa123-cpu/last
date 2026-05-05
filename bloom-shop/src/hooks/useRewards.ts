import { useEffect, useMemo, useState } from 'react';

import { MOCK_COUPONS } from '../lib/constants';
import { supabase, withFallback } from '../lib/supabase';
import type { Coupon, RewardLog } from '../lib/types';
import { getTierProgress } from '../lib/utils';
import { useAuth } from './useAuth';

const mockRewardLog: RewardLog[] = [
  {
    id: 'reward-1',
    user_id: '11111111-1111-1111-1111-111111111111',
    order_id: 'o2',
    points: 25,
    description: 'Earned from Orchid Whisper order',
    created_at: '2026-04-19T05:30:00.000Z',
  },
  {
    id: 'reward-2',
    user_id: '11111111-1111-1111-1111-111111111111',
    order_id: 'o1',
    points: 19,
    description: 'Earned from Rose Sonata order',
    created_at: '2026-04-26T01:30:00.000Z',
  },
  {
    id: 'reward-3',
    user_id: '11111111-1111-1111-1111-111111111111',
    points: -99,
    description: 'Redeemed points on checkout',
    created_at: '2026-04-10T11:15:00.000Z',
  },
];

export function useRewards() {
  const { profile } = useAuth();
  const [history, setHistory] = useState<RewardLog[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchRewards() {
      if (!profile?.id) return;
      setLoading(true);

      const [rewardHistory, availableCoupons] = await Promise.all([
        withFallback(
          supabase
            .from('rewards_log')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false }),
          mockRewardLog.filter((entry) => entry.user_id === profile.id),
        ),
        withFallback(
          supabase
            .from('coupons')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
          MOCK_COUPONS,
        ),
      ]);

      setHistory(rewardHistory);
      setCoupons(availableCoupons);
      setLoading(false);
    }

    fetchRewards();
  }, [profile?.id]);

  const progress = useMemo(
    () => getTierProgress(profile?.points ?? 0),
    [profile?.points],
  );

  return {
    loading,
    history,
    coupons,
    progress,
    points: profile?.points ?? 0,
    tier: profile?.tier ?? 'Bronze',
  };
}
