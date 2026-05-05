import { useEffect } from 'react';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '../lib/supabase';

type RealtimeEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE';

interface RealtimeInvalidationConfig {
  table: string;
  queryKeys: QueryKey[];
  event?: RealtimeEvent;
  filter?: string;
  schema?: string;
}

export function useRealtimeQueryInvalidation(configs: RealtimeInvalidationConfig[], enabled = true) {
  const queryClient = useQueryClient();
  const signature = JSON.stringify(
    configs.map((config) => ({
      table: config.table,
      event: config.event,
      filter: config.filter,
      schema: config.schema,
      queryKeys: config.queryKeys,
    })),
  );

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !configs.length) {
      return;
    }

    const channels = configs.map((config, index) =>
      supabase
        .channel(`realtime-${config.table}-${index}-${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          {
            event: config.event ?? '*',
            schema: config.schema ?? 'public',
            table: config.table,
            filter: config.filter,
          },
          () => {
            for (const queryKey of config.queryKeys) {
              void queryClient.invalidateQueries({ queryKey });
            }
          },
        )
        .subscribe(),
    );

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient, signature]);
}
