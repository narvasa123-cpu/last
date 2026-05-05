import {
  createElement,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { MOCK_NOTIFICATIONS } from '../lib/constants';
import { isSupabaseConfigured, supabase, withFallback } from '../lib/supabase';
import type { NotificationItem } from '../lib/types';
import { useAuth } from './useAuth';

interface ToastItem {
  id: string;
  title: string;
  message: string;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: ToastItem[];
  loading: boolean;
  showToast: (title: string, message: string) => void;
  dismissToast: (id: string) => void;
  markAllAsRead: () => Promise<void>;
  refetchNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [loading, setLoading] = useState(false);

  const showToast = (title: string, message: string) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, title, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  };

  const dismissToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const refetchNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    const fallback = MOCK_NOTIFICATIONS.filter((item) => item.user_id === user.id);

    const data = await withFallback(
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      fallback,
    );

    setNotifications(data);
    setLoading(false);
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));

    if (isSupabaseConfigured) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    }
  };

  useEffect(() => {
    refetchNotifications();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const incoming = payload.new as NotificationItem;
          setNotifications((current) => [incoming, ...current]);
          showToast(incoming.title, incoming.message);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.is_read).length,
      toasts,
      loading,
      showToast,
      dismissToast,
      markAllAsRead,
      refetchNotifications,
    }),
    [loading, notifications, toasts],
  );

  return createElement(NotificationsContext.Provider, { value }, children);
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
